import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LEGACY_AUDIO_CALIBRATION_STORAGE_KEYS,
  clearAudioCalibrationProfile,
} from "./audioCalibration";
import { LANGUAGE_STORAGE_KEY } from "../i18n/messages";

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe("obsolete audio calibration cleanup", () => {
  it("clears every released compensation version without clearing other data", () => {
    assert.deepEqual(
      LEGACY_AUDIO_CALIBRATION_STORAGE_KEYS,
      [
        "scoretokeys-kids.audio-calibration.v1",
        "scoretokeys-kids.audio-calibration.v2",
        "scoretokeys-kids.audio-calibration.v3",
      ],
    );
    const storage = createStorage();
    storage.setItem(LANGUAGE_STORAGE_KEY, "en");
    storage.setItem("unrelated", "preserved");
    for (const key of LEGACY_AUDIO_CALIBRATION_STORAGE_KEYS) {
      storage.setItem(key, JSON.stringify({ residualLatencyMs: 800 }));
    }

    clearAudioCalibrationProfile(storage);

    assert.ok(LEGACY_AUDIO_CALIBRATION_STORAGE_KEYS.every((key) => storage.getItem(key) === null));
    assert.equal(storage.getItem(LANGUAGE_STORAGE_KEY), "en");
    assert.equal(storage.getItem("unrelated"), "preserved");
    assert.equal(storage.length, 2);
  });

  it("does not read profiles or write replacement settings", () => {
    const removed: string[] = [];
    clearAudioCalibrationProfile({
      removeItem: (key) => removed.push(key),
    });
    assert.deepEqual(removed, LEGACY_AUDIO_CALIBRATION_STORAGE_KEYS);
  });

  it("can run repeatedly without introducing any browser data", () => {
    const storage = createStorage();
    clearAudioCalibrationProfile(storage);
    clearAudioCalibrationProfile(storage);
    assert.equal(storage.length, 0);
  });

  it("surfaces storage failures for the application's warning", () => {
    assert.throws(() => clearAudioCalibrationProfile({
      removeItem: () => { throw new Error("storage blocked"); },
    }), /storage blocked/);
  });
});
