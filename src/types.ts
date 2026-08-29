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
  offsetBeats: number;
  durationBeats: number;
  midi: number | null;
  lyric?: string;
  confidence: number;
  finger?: number;
  fingerLocked?: boolean;
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
  notation: SourceNotation;
  overallConfidence: number;
  coverage: string;
  attribution: string;
  recognizer: string;
  verificationStatus: SourceVerificationStatus;
  notes: string[];
}

export interface SongModel {
  id: string;
  title: string;
  subtitle: string;
  key: string;
  tonicMidi: number;
  timeSignature: TimeSignature;
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
  startBeat: number;
  durationBeats: number;
  midi: number;
  hand: Hand;
  finger: number;
  voice: Voice;
  velocity: number;
  measureNumber: number;
  chord?: string;
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
