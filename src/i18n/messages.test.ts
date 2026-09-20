import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPerformanceTimeline, harmonize } from "../core/arrangement";
import { createMusicXml } from "../core/exporters";
import { SAMPLE_SONGS } from "../data/samples";
import type { SongModel } from "../types";
import {
  EN_MESSAGES,
  extractPlaceholders,
  localizeSongPresentation,
  localizeTechnicalError,
  resolveLanguage,
  translate,
  ZH_CN_MESSAGES,
} from "./messages";

describe("typed product localization", () => {
  it("keeps both locale dictionaries complete with matching placeholders", () => {
    const chineseKeys = Object.keys(ZH_CN_MESSAGES).sort();
    const englishKeys = Object.keys(EN_MESSAGES).sort();
    assert.deepEqual(englishKeys, chineseKeys);

    for (const key of chineseKeys) {
      assert.deepEqual(
        extractPlaceholders(
          EN_MESSAGES[key as keyof typeof EN_MESSAGES],
        ),
        extractPlaceholders(
          ZH_CN_MESSAGES[key as keyof typeof ZH_CN_MESSAGES],
        ),
        `placeholder mismatch for ${key}`,
      );
    }
  });

  it("uses exact locale-specific brand and document titles", () => {
    assert.equal(
      translate("zh-CN", "brand.name"),
      "小琴伴 (ScoreToKeys Kids)",
    );
    assert.equal(translate("zh-CN", "meta.title"), "小琴伴 (ScoreToKeys Kids)");
    assert.equal(
      translate("en", "brand.name"),
      "小琴伴 (ScoreToKeys Kids)",
    );
    assert.equal(translate("en", "meta.title"), "小琴伴 (ScoreToKeys Kids)");
  });

  it("keeps English interface copy free of Chinese outside the language switch", () => {
    for (const [key, message] of Object.entries(EN_MESSAGES)) {
      if (
        key === "language.chinese" ||
        key === "brand.name" ||
        key === "meta.title"
      ) {
        continue;
      }
      assert.doesNotMatch(message, /[\u3400-\u9fff]/u, key);
    }

    for (const song of SAMPLE_SONGS) {
      const localized = localizeSongPresentation(song, "en");
      assert.doesNotMatch(
        [
          localized.title,
          localized.subtitle,
          localized.suggestedTempo,
          localized.source.coverage,
          localized.source.attribution,
          localized.source.recognizer,
          ...localized.source.notes,
        ].join(" "),
        /[\u3400-\u9fff]/u,
      );
    }
  });

  it("resolves only supported persisted languages", () => {
    assert.equal(resolveLanguage("zh-CN", "en-US"), "zh-CN");
    assert.equal(resolveLanguage("en", "zh-CN"), "en");
    assert.equal(resolveLanguage("fr", "zh-Hans"), "zh-CN");
    assert.equal(resolveLanguage(null, "en-GB"), "en");
  });

  it("localizes built-in presentation without changing score identity or source paths", () => {
    const song = {
      id: "labor",
      title: "劳动最光荣",
      subtitle: "raw subtitle",
      key: "Bb",
      tonicMidi: 58,
      timeSignature: { beats: 2, beatType: 4 },
      tempo: 118,
      suggestedTempo: "raw tempo",
      measures: [],
      source: {
        imagePath: "/劳动最光荣.gif",
        notation: "jianpu",
        overallConfidence: 0.9,
        coverage: "raw coverage",
        attribution: "raw attribution",
        recognizer: "raw recognizer",
        verificationStatus: "manual-required",
        notes: ["raw note"],
      },
    } satisfies SongModel;

    const localized = localizeSongPresentation(song, "en");
    assert.equal(localized.id, song.id);
    assert.equal(localized.source.imagePath, song.source.imagePath);
    assert.equal(localized.title, "Labor Is Most Glorious");
    assert.match(localized.subtitle, /B♭ major/);
    assert.equal(song.subtitle, "raw subtitle");
  });

  it("translates known core failures and preserves unknown technical details", () => {
    assert.equal(
      localizeTechnicalError("第 3 小节的音符超出小节长度。", "en"),
      "A note extends beyond measure 3.",
    );
    assert.equal(
      localizeTechnicalError("provider request abc-123 failed", "en"),
      "provider request abc-123 failed",
    );
    assert.equal(
      localizeTechnicalError("provider request abc-123 failed", "zh-CN"),
      "技术详情：provider request abc-123 failed",
    );
  });

  it("writes localized presentation and part names into English MusicXML", () => {
    const song = localizeSongPresentation(SAMPLE_SONGS[0], "en");
    const harmony = harmonize(song);
    const timeline = buildPerformanceTimeline(song, harmony, "root-fifth");
    const xml = createMusicXml(song, timeline, harmony, {
      rightHandPart: translate("en", "export.rightHandPart"),
      leftHandPart: translate("en", "export.leftHandPart"),
    });

    assert.match(xml, /<work-title>If You&apos;re Happy and You Know It<\/work-title>/);
    assert.match(xml, /<part-name>Right-hand melody<\/part-name>/);
    assert.match(xml, /<part-name>Left-hand accompaniment<\/part-name>/);
  });
});
