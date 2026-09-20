export type Hand = "right" | "left";
export type Voice = "melody" | "accompaniment";
export type SourceNotation = "staff" | "jianpu" | "manual";
export type AccompanimentMode = "root" | "root-fifth" | "block" | "arpeggio";
export type SourceVerificationStatus =
  | "development-fixture"
  | "manual-required"
  | "reader-agreed"
  | "judge-confirmed"
  | "manual-confirmed"
  | "unresolved";

export interface TimeSignature {
  beats: number;
  beatType: number;
}

export interface ScoreEvent {
  id: string;
  /** Quarter-note units from the start of the measure. */
  offsetBeats: number;
  /** Duration in quarter-note units. */
  durationBeats: number;
  midi: number | null;
  /** Original numbered-notation pitch token, when available (for example 3'). */
  sourcePitchToken?: string;
  lyric?: string;
  confidence: number;
  finger?: number;
  fingerLocked?: boolean;
  tieToNext?: boolean;
  slurToNext?: boolean;
}

export interface MeasureModel {
  id: string;
  number: number;
  durationBeats: number;
  events: ScoreEvent[];
  chordHint?: string;
  phraseEnd?: boolean;
}

export interface SourceInfo {
  imagePath: string;
  imagePaths?: string[];
  notation: SourceNotation;
  overallConfidence: number;
  coverage: string;
  attribution: string;
  recognizer: string;
  verificationStatus: SourceVerificationStatus;
  notes: string[];
  layoutSystems?: number[][];
  pageBreakBeforeSystem?: number[];
}

export interface SongModel {
  id: string;
  title: string;
  subtitle: string;
  key: string;
  tonicMidi: number;
  timeSignature: TimeSignature;
  /** Quarter-note beats per minute. */
  tempo: number;
  suggestedTempo: string;
  measures: MeasureModel[];
  source: SourceInfo;
}

export interface ChordDefinition {
  symbol: string;
  degree: number;
  quality: "major" | "minor";
  rootPc: number;
  pitchClasses: number[];
}

export interface ChordOverride {
  symbol: string;
  locked: boolean;
}

export type ChordOverrides = Record<string, ChordOverride>;

export interface ChordAssignment extends ChordDefinition {
  measureNumber: number;
  pitches: number[];
  confidence: number;
  locked: boolean;
}

export interface PerformanceEvent {
  id: string;
  sourceEventId?: string;
  /** Absolute position in quarter-note units from the start of the song. */
  startBeat: number;
  /** Duration in quarter-note units. */
  durationBeats: number;
  midi: number;
  hand: Hand;
  finger: number;
  voice: Voice;
  velocity: number;
  measureNumber: number;
  cue?: string;
  chord?: string;
  tieFromPrevious?: boolean;
  tieToNext?: boolean;
}

export interface MeasureSpan {
  number: number;
  startBeat: number;
  endBeat: number;
}

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
  measureNumber?: number;
  eventId?: string;
}

export interface SessionSong {
  id: string;
  song: SongModel;
  imageUrls: string[];
  status: "reading" | "ready" | "error";
  error?: string;
}

export type TeachingGenerationStage =
  | "idle"
  | "validating-score"
  | "building-timeline"
  | "verifying-opening"
  | "preparing-audio"
  | "finalizing"
  | "ready"
  | "error";

export interface TeachingGenerationState {
  stage: TeachingGenerationStage;
  progress: number;
  message?: string;
}
