import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  candidateToSong,
  validatePages,
} from "./recognition.mjs";

function evidence(overrides = {}) {
  return {
    digit: 1,
    octaveShift: 0,
    octaveDots: [],
    underlineCount: 0,
    durationDotCount: 0,
    sustainDashCount: 0,
    observedSymbols: ["digit:1"],
    rationale: "digit and rhythm geometry agree",
    ...overrides,
  };
}

function event(pitchToken, lyric) {
  return {
    pitchToken,
    pitchName: null,
    durationBeats: 1,
    lyric,
    confidence: 0.96,
    tieToNext: false,
    slurToNext: false,
    evidence: evidence({
      digit: Number(pitchToken[0]),
      octaveShift: pitchToken.includes("'") ? 1 : 0,
      octaveDots: pitchToken.includes("'")
        ? [
            {
              position: "above",
              horizontalOffset: 0,
              verticalGap: 0.35,
              diameter: 0.2,
            },
          ]
        : [],
    }),
  };
}

function candidate() {
  return {
    title: "Two page song",
    subtitle: "recognized",
    notation: "jianpu",
    key: "C",
    tonicPitch: "C4",
    tempo: 96,
    timeSignature: { beats: 2, beatType: 4 },
    pages: [
      {
        pageNumber: 2,
        measures: [
          {
            sourceMeasureNumber: 3,
            systemNumber: 1,
            durationBeats: 2,
            events: [event("5", "third"), event("1'", null)],
          },
        ],
      },
      {
        pageNumber: 1,
        measures: [
          {
            sourceMeasureNumber: 1,
            systemNumber: 1,
            durationBeats: 2,
            events: [event("1", "first"), event("2", null)],
          },
        ],
      },
    ],
    unresolvedEvents: [],
    notes: [],
  };
}

describe("product recognition conversion", () => {
  it("merges multiple pages in upload order and renumbers measures continuously", () => {
    const song = candidateToSong(candidate(), "multi");

    assert.deepEqual(
      song.measures.map((measure) => measure.number),
      [1, 2],
    );
    assert.equal(song.measures[0].events[0].lyric, "first");
    assert.equal(song.measures[1].events[0].lyric, "third");
    assert.equal(song.measures[1].events[1].midi, 72);
    assert.equal(song.source.coverage, "完整识别 2 页，2 小节");
    assert.deepEqual(song.source.layoutSystems, [[1], [2]]);
    assert.deepEqual(song.source.pageBreakBeforeSystem, [1]);
  });

  it("rejects an octave dot that is not aligned with its digit", () => {
    const invalid = candidate();
    invalid.pages[1].measures[0].events[0].pitchToken = "1'";
    invalid.pages[1].measures[0].events[0].evidence = evidence({
      octaveShift: 1,
      octaveDots: [
        {
          position: "above",
          horizontalOffset: 0.8,
          verticalGap: 0.35,
          diameter: 0.2,
        },
      ],
    });

    assert.throws(
      () => candidateToSong(invalid, "invalid"),
      /八度点没有可靠的数字对齐证据/,
    );
  });

  it("accepts one to four ordered image pages only", () => {
    const dataUrl = `data:image/png;base64,${Buffer.from("image").toString("base64")}`;
    assert.equal(
      validatePages([
        { pageNumber: 1, fileName: "1.png", dataUrl },
        { pageNumber: 2, fileName: "2.png", dataUrl },
      ]).length,
      2,
    );
    assert.throws(
      () => validatePages([{ pageNumber: 2, fileName: "2.png", dataUrl }]),
      /页码必须从 1 开始连续排列/,
    );
  });

  it("forces unresolved Judge decisions into the manual review gate", () => {
    const unresolved = candidate();
    unresolved.unresolvedEvents = [
      {
        pageNumber: 1,
        pageMeasureIndex: 0,
        eventIndex: 0,
        reason: "Readers disagree about the printed digit.",
      },
    ];

    const song = candidateToSong(unresolved, "unresolved", "unresolved");

    assert.equal(song.measures[0].events[0].confidence, 0.5);
    assert.equal(song.source.verificationStatus, "unresolved");
    assert.match(song.source.notes.at(-1), /Readers disagree/);
  });

  it("rejects incomplete page coverage and invalid unresolved locations", () => {
    const incomplete = candidate();
    incomplete.pages = incomplete.pages.slice(0, 1);
    assert.throws(
      () => candidateToSong(incomplete, "incomplete", "judge-confirmed", 2),
      /没有完整且唯一地覆盖所有上传页面/,
    );

    const invalidLocation = candidate();
    invalidLocation.unresolvedEvents = [
      {
        pageNumber: 1,
        pageMeasureIndex: 0,
        eventIndex: 99,
        reason: "invalid location",
      },
    ];
    assert.throws(
      () => candidateToSong(invalidLocation, "invalid-location"),
      /无法定位到乐谱事件/,
    );
  });
});
