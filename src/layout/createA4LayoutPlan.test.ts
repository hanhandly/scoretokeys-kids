import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SAMPLE_SONGS } from "../data/samples";
import { createA4LayoutPlan } from "./createA4LayoutPlan";
import { SOURCE_LAYOUT_HINTS } from "./sourceLayoutHints";

describe("A4 source-aware layout", () => {
  it("preserves the source systems for the staff fixture", () => {
    const song = SAMPLE_SONGS[0];
    const plan = createA4LayoutPlan(song, {
      mode: "source-faithful",
      sourceHint: SOURCE_LAYOUT_HINTS[song.id],
    });

    assert.equal(plan.pages.length, 1);
    assert.deepEqual(
      plan.pages[0].systems.map((system) =>
        system.measures.map((measure) => measure.measureNumber),
      ),
      [
        [0, 1, 2],
        [3, 4],
        [5, 6],
        [7, 8],
      ],
    );
  });

  it("keeps all seven source lines of the jianpu fixture on one A4 page", () => {
    const song = SAMPLE_SONGS[1];
    const plan = createA4LayoutPlan(song, {
      mode: "source-faithful",
      sourceHint: SOURCE_LAYOUT_HINTS[song.id],
    });

    assert.equal(plan.pages.length, 1);
    assert.equal(plan.pages[0].systems.length, 7);
    assert.deepEqual(
      plan.pages[0].systems[0].measures.map(
        (measure) => measure.measureNumber,
      ),
      [1, 2, 3, 4, 5],
    );
    assert.deepEqual(
      plan.pages[0].systems.at(-1)?.measures.map(
        (measure) => measure.measureNumber,
      ),
      [31, 32, 33, 34, 35],
    );
  });

  it("splits dense source lines into larger practice systems and pages", () => {
    const song = SAMPLE_SONGS[1];
    const plan = createA4LayoutPlan(song, {
      mode: "practice",
      sourceHint: SOURCE_LAYOUT_HINTS[song.id],
    });

    assert.equal(plan.pages.length, 2);
    assert.deepEqual(
      plan.pages.flatMap((page) =>
        page.systems.flatMap((system) =>
          system.measures.map((measure) => measure.measureNumber),
        ),
      ),
      song.measures.map((measure) => measure.number),
    );
  });

  it("rejects incomplete or duplicate source mappings", () => {
    const song = SAMPLE_SONGS[0];

    assert.throws(
      () =>
        createA4LayoutPlan(song, {
          mode: "source-faithful",
          sourceHint: {
            systems: [
              [0, 1, 2],
              [2, 3, 4],
            ],
          },
        }),
      /完整且唯一/,
    );
  });
});
