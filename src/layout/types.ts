export type LayoutMode = "source-faithful" | "practice";

export interface SourceLayoutHint {
  systems: readonly (readonly number[])[];
  pageBreakAfterSystem?: readonly number[];
}

export interface A4MeasureLayout {
  measureNumber: number;
  columnWeight: number;
}

export interface A4SystemLayout {
  id: string;
  sourceSystemIndex: number | null;
  measures: A4MeasureLayout[];
  lyricText: string;
}

export interface A4PageLayout {
  id: string;
  pageNumber: number;
  systems: A4SystemLayout[];
}

export interface A4LayoutPlan {
  schemaVersion: "scoretokeys/layout-plan/v1";
  mode: LayoutMode;
  pageWidthMm: 210;
  pageHeightMm: 297;
  pages: A4PageLayout[];
}
