export const RECOGNITION_CONTRACT_VERSION = "recognition.v1" as const;

export type RecognitionContractVersion = typeof RECOGNITION_CONTRACT_VERSION;
export type RecognitionSourceType =
  | "staff-image"
  | "jianpu-image"
  | "mixed-image"
  | "manual-input";

export interface SourceRegion {
  readonly regionId: string;
  readonly pageNumber: number;
  readonly systemNumber: number;
  readonly measureStart: number;
  readonly measureEnd: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type ReaderRole = "reader_a" | "reader_b" | "reader_fallback";
export type JudgeRole = "judge";
export type CodeRole = "code_primary" | "code_secondary";
export type ModelRole = ReaderRole | JudgeRole | CodeRole;
export type CandidateRole = ReaderRole | "judge_merged";

export interface ModelSettingResolution {
  readonly requested: string;
  readonly status: "applied" | "unsupported";
  readonly applied: string | null;
  readonly reason: string | null;
}

export interface ModelExecutionMetadata {
  readonly profileId: string;
  readonly provider: string;
  readonly model: string;
  readonly role: ModelRole;
  readonly executionId: string;
  readonly startedAtIso: string;
  readonly completedAtIso: string;
  readonly contextTier: ModelSettingResolution;
  readonly reasoningEffort: ModelSettingResolution;
  readonly requestTokenCount: number | null;
  readonly responseTokenCount: number | null;
  readonly notes: readonly string[];
}

export interface MeasureMetadata {
  readonly measureNumber: number;
  readonly durationBeats: number;
  readonly timeSignatureBeats: number;
  readonly timeSignatureBeatUnit: number;
  readonly regionIds: readonly string[];
}

export type PitchStep = "A" | "B" | "C" | "D" | "E" | "F" | "G";
export type PitchAccidental = "bb" | "b" | "natural" | "#" | "##";

export interface PitchSpelling {
  readonly step: PitchStep;
  readonly accidental: PitchAccidental;
  readonly octave: number;
}

export interface EventEvidence {
  readonly confidence: number;
  readonly rationale: string;
  readonly observedSymbols: readonly string[];
}

export interface RecognitionEventCandidate {
  readonly eventKey: string;
  readonly measureNumber: number;
  readonly eventIndex: number;
  readonly offsetBeats: number;
  readonly durationBeats: number;
  readonly midi: number | null;
  readonly isRest: boolean;
  readonly pitchSpelling: PitchSpelling | null;
  readonly lyric: string | null;
  readonly evidence: EventEvidence;
  readonly regionId: string;
}

export interface CoverageRange {
  readonly measureStart: number;
  readonly measureEnd: number;
  readonly regionIds: readonly string[];
}

export interface RecognitionCoverage {
  readonly isComplete: boolean;
  readonly coveredMeasures: readonly number[];
  readonly uncoveredMeasures: readonly number[];
  readonly ranges: readonly CoverageRange[];
}

export interface RecognitionCandidate {
  readonly contractVersion: RecognitionContractVersion;
  readonly sourceId: string;
  readonly sourceType: RecognitionSourceType;
  readonly role: CandidateRole;
  readonly execution: ModelExecutionMetadata;
  readonly regions: readonly SourceRegion[];
  readonly measures: readonly MeasureMetadata[];
  readonly events: readonly RecognitionEventCandidate[];
  readonly coverage: RecognitionCoverage;
}

export type DeterministicIssueCode =
  | "contract_version_mismatch"
  | "source_id_mismatch"
  | "source_type_mismatch"
  | "role_mismatch"
  | "source_region_mismatch"
  | "measure_metadata_mismatch"
  | "duplicate_measure_number"
  | "invalid_measure_duration"
  | "unknown_region_reference"
  | "coverage_missing_measure"
  | "coverage_overlap"
  | "coverage_complete_flag_mismatch"
  | "coverage_range_invalid"
  | "duplicate_event_key"
  | "unstable_event_key"
  | "event_measure_missing"
  | "event_index_invalid"
  | "invalid_offset"
  | "invalid_duration"
  | "event_out_of_range"
  | "invalid_rest_encoding"
  | "invalid_midi"
  | "invalid_pitch_spelling"
  | "invalid_lyric"
  | "invalid_confidence"
  | "uncovered_measure_has_events"
  | "measure_occupancy_gap_or_overlap"
  | "measure_occupancy_incomplete";

export interface DeterministicIssue {
  readonly code: DeterministicIssueCode;
  readonly message: string;
  readonly severity: "error";
  readonly measureNumber: number | null;
  readonly eventKey: string | null;
}

export interface DeterministicValidationResult {
  readonly ok: boolean;
  readonly issues: readonly DeterministicIssue[];
}

export type EventDifferenceKind =
  | "missing_event"
  | "pitch_class_difference"
  | "octave_only_difference"
  | "timing_or_duration_difference"
  | "rest_difference"
  | "lyric_difference"
  | "spelling_difference"
  | "measure_structure_difference"
  | "coverage_difference";

export type DifferenceRisk = "high" | "medium" | "low";

export interface EventLevelDifference {
  readonly kind: EventDifferenceKind;
  readonly risk: DifferenceRisk;
  readonly eventKey: string | null;
  readonly measureNumber: number | null;
  readonly leftEvent: RecognitionEventCandidate | null;
  readonly rightEvent: RecognitionEventCandidate | null;
  readonly message: string;
}

export interface JudgeRequest {
  readonly contractVersion: RecognitionContractVersion;
  readonly sourceId: string;
  readonly sourceType: RecognitionSourceType;
  readonly readerA: RecognitionCandidate;
  readonly readerB: RecognitionCandidate;
  readonly readerAValidation: DeterministicValidationResult;
  readonly readerBValidation: DeterministicValidationResult;
  readonly differences: readonly EventLevelDifference[];
}

export type JudgeDecisionSource = "reader_a" | "reader_b";

export interface JudgeEventResolution {
  readonly eventKey: string;
  readonly status: "selected" | "unresolved";
  readonly selectedFrom: JudgeDecisionSource | null;
  readonly reason: string;
}

export interface JudgeResolution {
  readonly contractVersion: RecognitionContractVersion;
  readonly execution: ModelExecutionMetadata;
  readonly eventResolutions: readonly JudgeEventResolution[];
  readonly notes: readonly string[];
}

export interface ReaderAssessment {
  readonly candidate: RecognitionCandidate;
  readonly validation: DeterministicValidationResult;
}

export type VerificationStatus =
  | "reader-agreed"
  | "judge-confirmed"
  | "manual-confirmed"
  | "unresolved";

export interface VerificationReport {
  readonly contractVersion: RecognitionContractVersion;
  readonly status: VerificationStatus;
  readonly readerA: ReaderAssessment;
  readonly readerB: ReaderAssessment;
  readonly differences: readonly EventLevelDifference[];
  readonly judgeRequest: JudgeRequest | null;
  readonly judgeResolution: JudgeResolution | null;
  readonly unresolvedEventKeys: readonly string[];
  readonly mergedValidation: DeterministicValidationResult | null;
  readonly confirmedCandidate: RecognitionCandidate | null;
}

export interface ReaderInvocationRequest {
  readonly contractVersion: RecognitionContractVersion;
  readonly role: "reader_a" | "reader_b";
  readonly sourceId: string;
  readonly sourceType: RecognitionSourceType;
  readonly regions: readonly SourceRegion[];
  readonly measures: readonly MeasureMetadata[];
}

export interface ReaderAdapter {
  readonly role: "reader_a" | "reader_b";
  recognize(request: ReaderInvocationRequest): Promise<RecognitionCandidate>;
}

export interface JudgeAdapter {
  judge(request: JudgeRequest): Promise<JudgeResolution>;
}

export interface RecognitionOrchestrationRequest {
  readonly sourceId: string;
  readonly sourceType: RecognitionSourceType;
  readonly regions: readonly SourceRegion[];
  readonly measures: readonly MeasureMetadata[];
  readonly readerA: ReaderAdapter;
  readonly readerB: ReaderAdapter;
  readonly judge?: JudgeAdapter;
}

export interface CandidateValidationExpectations {
  readonly sourceId: string;
  readonly sourceType: RecognitionSourceType;
  readonly expectedRole: CandidateRole;
  readonly regions: readonly SourceRegion[];
  readonly measures: readonly MeasureMetadata[];
}

export function buildStableEventKey(
  measureNumber: number,
  eventIndex: number,
): string {
  return `m${measureNumber}:e${eventIndex}`;
}

export function pitchSpellingToText(spelling: PitchSpelling | null): string {
  if (spelling === null) {
    return "rest";
  }
  return `${spelling.step}${spelling.accidental}${spelling.octave}`;
}
