import type { MeasureModel, SongModel } from "../types";
import { groupMeasuresIntoSystems } from "../core/model";
import type {
  A4LayoutPlan,
  A4SystemLayout,
  LayoutMode,
  SourceLayoutHint,
} from "./types";

export interface CreateA4LayoutOptions {
  mode: LayoutMode;
  sourceHint?: SourceLayoutHint;
}

function validateSourceSystems(
  song: SongModel,
  systems: readonly (readonly number[])[],
): void {
  const expected = song.measures.map((measure) => measure.number);
  const actual = systems.flatMap((system) => [...system]);
  const duplicates = actual.filter(
    (number, index) => actual.indexOf(number) !== index,
  );
  const missing = expected.filter((number) => !actual.includes(number));
  const unknown = actual.filter((number) => !expected.includes(number));

  if (
    systems.some((system) => system.length === 0) ||
    duplicates.length > 0 ||
    missing.length > 0 ||
    unknown.length > 0 ||
    actual.length !== expected.length
  ) {
    throw new Error(
      [
        "来源谱行不能完整且唯一地映射全部小节。",
        duplicates.length > 0
          ? `重复：${[...new Set(duplicates)].join("、")}`
          : "",
        missing.length > 0 ? `缺少：${missing.join("、")}` : "",
        unknown.length > 0 ? `未知：${unknown.join("、")}` : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }
}

function fallbackSystems(song: SongModel): number[][] {
  return groupMeasuresIntoSystems(song.measures, 4).map((system) =>
    system.map((measure) => measure.number),
  );
}

function splitForPractice(
  systems: readonly (readonly number[])[],
): number[][] {
  const allMeasures = systems.flatMap((system) => [...system]);
  const pickup = allMeasures.filter((number) => number <= 0);
  const numbered = allMeasures.filter((number) => number > 0);
  const result: number[][] = [];

  for (let index = 0; index < numbered.length; index += 4) {
    result.push(numbered.slice(index, index + 4));
  }
  if (result.length === 0) result.push([]);
  if (pickup.length > 0) result[0] = [...pickup, ...result[0]];
  return result.filter((item) => item.length > 0);
}

function measureWeight(measure: MeasureModel): number {
  if (measure.number <= 0) return 0.42;
  const rhythmicDensity = measure.events.length / 4;
  return Number(Math.max(1, rhythmicDensity).toFixed(3));
}

function createSystem(
  song: SongModel,
  measureNumbers: readonly number[],
  index: number,
  sourceSystemIndex: number | null,
): A4SystemLayout {
  const measuresByNumber = new Map(
    song.measures.map((measure) => [measure.number, measure]),
  );
  const measures = measureNumbers.map((number) => {
    const measure = measuresByNumber.get(number);
    if (!measure) {
      throw new Error(`A4 布局引用了不存在的第 ${number} 小节。`);
    }
    return measure;
  });

  return {
    id: `layout-system-${index + 1}`,
    sourceSystemIndex,
    measures: measures.map((measure) => ({
      measureNumber: measure.number,
      columnWeight: measureWeight(measure),
    })),
    lyricText: measures
      .flatMap((measure) =>
        measure.events.flatMap((event) => (event.lyric ? [event.lyric] : [])),
      )
      .join(""),
  };
}

function shouldBreakPage(
  systemIndex: number,
  currentPageLength: number,
  maxSystemsPerPage: number,
  explicitBreaks: ReadonlySet<number>,
): boolean {
  return (
    currentPageLength >= maxSystemsPerPage ||
    explicitBreaks.has(systemIndex)
  );
}

export function createA4LayoutPlan(
  song: SongModel,
  options: CreateA4LayoutOptions,
): A4LayoutPlan {
  const hintedSystems = options.sourceHint?.systems;
  if (hintedSystems) validateSourceSystems(song, hintedSystems);

  const sourceSystems = hintedSystems ?? fallbackSystems(song);
  const systemNumbers =
    options.mode === "source-faithful"
      ? sourceSystems.map((system) => [...system])
      : splitForPractice(sourceSystems);
  const sourceSystemKey = new Map(
    sourceSystems.map((system, index) => [system.join(","), index]),
  );
  const systems = systemNumbers.map((measureNumbers, index) =>
    createSystem(
      song,
      measureNumbers,
      index,
      sourceSystemKey.get(measureNumbers.join(",")) ?? null,
    ),
  );
  const maxSystemsPerPage = options.mode === "source-faithful" ? 7 : 5;
  const explicitBreaks = new Set(
    options.mode === "source-faithful"
      ? options.sourceHint?.pageBreakAfterSystem ?? []
      : [],
  );
  const pages: A4LayoutPlan["pages"] = [];
  let currentPage: A4SystemLayout[] = [];

  systems.forEach((system, index) => {
    if (
      currentPage.length > 0 &&
      shouldBreakPage(
        index,
        currentPage.length,
        maxSystemsPerPage,
        explicitBreaks,
      )
    ) {
      pages.push({
        id: `layout-page-${pages.length + 1}`,
        pageNumber: pages.length + 1,
        systems: currentPage,
      });
      currentPage = [];
    }
    currentPage.push(system);
  });

  if (currentPage.length > 0) {
    pages.push({
      id: `layout-page-${pages.length + 1}`,
      pageNumber: pages.length + 1,
      systems: currentPage,
    });
  }

  return {
    schemaVersion: "scoretokeys/layout-plan/v1",
    mode: options.mode,
    pageWidthMm: 210,
    pageHeightMm: 297,
    pages,
  };
}
