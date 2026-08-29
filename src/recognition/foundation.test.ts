import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildStableEventKey,
  RECOGNITION_CONTRACT_VERSION,
  type CandidateRole,
  type JudgeAdapter,
  type JudgeResolution,
  type MeasureMetadata,
  type ModelExecutionMetadata,
  type ModelRole,
  type ReaderAdapter,
  type ReaderInvocationRequest,
  type RecognitionCandidate,
  type RecognitionCoverage,
  type RecognitionEventCandidate,
  type RecognitionSourceType,
  type SourceRegion,
} from "./contracts";
import { diffRecognitionCandidates } from "./diff";
import { RECOGNITION_MODEL_PROFILES } from "./modelProfiles";
import { runRecognitionOrchestrator } from "./orchestrator";
import { validateRecognitionCandidate } from "./validation";

const SOURCE_ID = "source-1";
const SOURCE_TYPE: RecognitionSourceType = "staff-image";
const REGION_ONE: SourceRegion = {
  regionId: "region-1",
  pageNumber: 1,
  systemNumber: 1,
  measureStart: 1,
  measureEnd: 2,
  x: 0.1,
  y: 0.2,
  width: 0.6,
  height: 0.3,
};
const SINGLE_MEASURE: readonly MeasureMetadata[] = [
  {
    measureNumber: 1,
    durationBeats: 4,
    timeSignatureBeats: 4,
    timeSignatureBeatUnit: 4,
    regionIds: ["region-1"],
  },
];

function appliedSetting(value: string) {
  return {
    requested: value,
    status: "applied" as const,
    applied: value,
    reason: null,
  };
}

function createExecution(role: ModelRole, profileId: string): ModelExecutionMetadata {
  return {
    profileId,
    provider: "test",
    model: "test-model",
    role,
    executionId: `${profileId}-run`,
    startedAtIso: "2026-01-01T00:00:00.000Z",
    completedAtIso: "2026-01-01T00:00:01.000Z",
    contextTier: appliedSetting("long_context"),
    reasoningEffort: appliedSetting("xhigh"),
    requestTokenCount: 10,
    responseTokenCount: 20,
    notes: [],
  };
}

function createNoteEvent(
  measureNumber: number,
  eventIndex: number,
  offsetBeats: number,
  durationBeats: number,
  midi: number,
  step: "A" | "B" | "C" | "D" | "E" | "F" | "G",
  accidental: "bb" | "b" | "natural" | "#" | "##",
  octave: number,
  lyric: string | null = null,
): RecognitionEventCandidate {
  return {
    eventKey: buildStableEventKey(measureNumber, eventIndex),
    measureNumber,
    eventIndex,
    offsetBeats,
    durationBeats,
    midi,
    isRest: false,
    pitchSpelling: {
      step,
      accidental,
      octave,
    },
    lyric,
    evidence: {
      confidence: 0.95,
      rationale: "glyph-match",
      observedSymbols: ["notehead", "stem"],
    },
    regionId: "region-1",
  };
}

function createRestEvent(
  measureNumber: number,
  eventIndex: number,
  offsetBeats: number,
  durationBeats: number,
): RecognitionEventCandidate {
  return {
    eventKey: buildStableEventKey(measureNumber, eventIndex),
    measureNumber,
    eventIndex,
    offsetBeats,
    durationBeats,
    midi: null,
    isRest: true,
    pitchSpelling: null,
    lyric: null,
    evidence: {
      confidence: 0.9,
      rationale: "rest-glyph-match",
      observedSymbols: ["rest"],
    },
    regionId: "region-1",
  };
}

function createCoverage(
  coveredMeasures: readonly number[],
  uncoveredMeasures: readonly number[],
): RecognitionCoverage {
  const sortedCovered = [...coveredMeasures].sort((left, right) => left - right);
  const sortedUncovered = [...uncoveredMeasures].sort((left, right) => left - right);
  if (sortedCovered.length === 0) {
    return {
      isComplete: sortedUncovered.length === 0,
      coveredMeasures: sortedCovered,
      uncoveredMeasures: sortedUncovered,
      ranges: [],
    };
  }

  const firstCovered = sortedCovered[0];
  const lastCovered = sortedCovered[sortedCovered.length - 1];
  return {
    isComplete: sortedUncovered.length === 0,
    coveredMeasures: sortedCovered,
    uncoveredMeasures: sortedUncovered,
    ranges: [
      {
        measureStart: firstCovered,
        measureEnd: lastCovered,
        regionIds: ["region-1"],
      },
    ],
  };
}

function createCandidate(
  role: CandidateRole,
  executionRole: ModelRole,
  events: readonly RecognitionEventCandidate[],
  options?: {
    sourceId?: string;
    sourceType?: RecognitionSourceType;
    measures?: readonly MeasureMetadata[];
    coverage?: RecognitionCoverage;
  },
): RecognitionCandidate {
  const measures = options?.measures ?? SINGLE_MEASURE;
  const coverage =
    options?.coverage ??
    createCoverage(
      measures.map((measure) => measure.measureNumber),
      [],
    );
  return {
    contractVersion: RECOGNITION_CONTRACT_VERSION,
    sourceId: options?.sourceId ?? SOURCE_ID,
    sourceType: options?.sourceType ?? SOURCE_TYPE,
    role,
    execution: createExecution(executionRole, `${role}-profile`),
    regions: [REGION_ONE],
    measures: measures.map((measure) => ({
      ...measure,
      regionIds: [...measure.regionIds],
    })),
    events: events.map((event) => ({ ...event })),
    coverage,
  };
}

function createReader(
  role: "reader_a" | "reader_b",
  candidate: RecognitionCandidate,
  onInvoke?: (request: ReaderInvocationRequest) => void,
): ReaderAdapter {
  return {
    role,
    recognize: async (request) => {
      onInvoke?.(request);
      return candidate;
    },
  };
}

function createDeferred(): { promise: Promise<void>; resolve: () => void } {
  let resolvePending = (): void => {
    throw new Error("Deferred promise not initialized.");
  };
  const promise = new Promise<void>((resolve) => {
    resolvePending = resolve;
  });
  return {
    promise,
    resolve: () => resolvePending(),
  };
}

function requireCapturedRequest(
  request: ReaderInvocationRequest | null,
  label: string,
): ReaderInvocationRequest {
  if (request === null) {
    throw new Error(`${label} request was not captured.`);
  }
  return request;
}

describe("recognition foundation", () => {
  it("returns reader-agreed for exact agreement with deterministic validity", async () => {
    const sharedEvents = [
      createNoteEvent(1, 0, 0, 2, 60, "C", "natural", 4, "la"),
      createRestEvent(1, 1, 2, 2),
    ];
    const readerA = createReader(
      "reader_a",
      createCandidate("reader_a", "reader_a", sharedEvents),
    );
    const readerB = createReader(
      "reader_b",
      createCandidate("reader_b", "reader_b", sharedEvents),
    );

    const report = await runRecognitionOrchestrator({
      sourceId: SOURCE_ID,
      sourceType: SOURCE_TYPE,
      regions: [REGION_ONE],
      measures: SINGLE_MEASURE,
      readerA,
      readerB,
    });

    assert.equal(report.status, "reader-agreed");
    assert.equal(report.differences.length, 0);
    assert.notEqual(report.confirmedCandidate, null);
  });

  it("classifies octave-only differences as high risk", () => {
    const left = createCandidate("reader_a", "reader_a", [
      createNoteEvent(1, 0, 0, 4, 60, "C", "natural", 4),
    ]);
    const right = createCandidate("reader_b", "reader_b", [
      createNoteEvent(1, 0, 0, 4, 72, "C", "natural", 5),
    ]);
    const differences = diffRecognitionCandidates(left, right);

    assert.equal(differences.length, 1);
    assert.equal(differences[0].kind, "octave_only_difference");
    assert.equal(differences[0].risk, "high");
  });

  it("invokes reader A and reader B independently in parallel", async () => {
    const gate = createDeferred();
    const events = [createNoteEvent(1, 0, 0, 4, 60, "C", "natural", 4)];
    const readerACandidate = createCandidate("reader_a", "reader_a", events);
    const readerBCandidate = createCandidate("reader_b", "reader_b", events);

    let readerAStarted = false;
    let readerBStarted = false;
    let readerARequest: ReaderInvocationRequest | null = null;
    let readerBRequest: ReaderInvocationRequest | null = null;

    const readerA: ReaderAdapter = {
      role: "reader_a",
      recognize: async (request) => {
        readerAStarted = true;
        readerARequest = request;
        await gate.promise;
        return readerACandidate;
      },
    };
    const readerB: ReaderAdapter = {
      role: "reader_b",
      recognize: async (request) => {
        readerBStarted = true;
        readerBRequest = request;
        await gate.promise;
        return readerBCandidate;
      },
    };

    const runPromise = runRecognitionOrchestrator({
      sourceId: SOURCE_ID,
      sourceType: SOURCE_TYPE,
      regions: [REGION_ONE],
      measures: SINGLE_MEASURE,
      readerA,
      readerB,
    });

    await Promise.resolve();
    assert.equal(readerAStarted, true);
    assert.equal(readerBStarted, true);
    const capturedReaderARequest = requireCapturedRequest(
      readerARequest,
      "readerA",
    );
    const capturedReaderBRequest = requireCapturedRequest(
      readerBRequest,
      "readerB",
    );
    assert.equal(capturedReaderARequest === capturedReaderBRequest, false);
    assert.equal(capturedReaderARequest.role, "reader_a");
    assert.equal(capturedReaderBRequest.role, "reader_b");

    gate.resolve();
    const report = await runPromise;
    assert.equal(report.status, "reader-agreed");
  });

  it("uses judge event-level decisions and revalidates merged output", async () => {
    const readerAEvents = [createNoteEvent(1, 0, 0, 4, 60, "C", "natural", 4)];
    const readerBEvents = [createNoteEvent(1, 0, 0, 4, 62, "D", "natural", 4)];
    const readerA = createReader(
      "reader_a",
      createCandidate("reader_a", "reader_a", readerAEvents),
    );
    const readerB = createReader(
      "reader_b",
      createCandidate("reader_b", "reader_b", readerBEvents),
    );
    const judge: JudgeAdapter = {
      judge: async () => {
        const resolution: JudgeResolution = {
          contractVersion: RECOGNITION_CONTRACT_VERSION,
          execution: createExecution("judge", "judge-profile"),
          eventResolutions: [
            {
              eventKey: buildStableEventKey(1, 0),
              status: "selected",
              selectedFrom: "reader_b",
              reason: "Reader B aligns better with region evidence.",
            },
          ],
          notes: ["selected reader_b for event m1:e0"],
        };
        return resolution;
      },
    };

    const report = await runRecognitionOrchestrator({
      sourceId: SOURCE_ID,
      sourceType: SOURCE_TYPE,
      regions: [REGION_ONE],
      measures: SINGLE_MEASURE,
      readerA,
      readerB,
      judge,
    });

    assert.equal(report.status, "judge-confirmed");
    assert.notEqual(report.confirmedCandidate, null);
    assert.equal(report.confirmedCandidate?.events[0].midi, 62);
    assert.equal(report.mergedValidation?.ok, true);
  });

  it("keeps unresolved states explicit when judge cannot resolve", async () => {
    const readerA = createReader(
      "reader_a",
      createCandidate("reader_a", "reader_a", [
        createNoteEvent(1, 0, 0, 4, 60, "C", "natural", 4),
      ]),
    );
    const readerB = createReader(
      "reader_b",
      createCandidate("reader_b", "reader_b", [
        createNoteEvent(1, 0, 0, 4, 62, "D", "natural", 4),
      ]),
    );
    const judge: JudgeAdapter = {
      judge: async () => ({
        contractVersion: RECOGNITION_CONTRACT_VERSION,
        execution: createExecution("judge", "judge-profile"),
        eventResolutions: [
          {
            eventKey: buildStableEventKey(1, 0),
            status: "unresolved",
            selectedFrom: null,
            reason: "Ambiguous source symbols.",
          },
        ],
        notes: ["unable to resolve m1:e0"],
      }),
    };

    const report = await runRecognitionOrchestrator({
      sourceId: SOURCE_ID,
      sourceType: SOURCE_TYPE,
      regions: [REGION_ONE],
      measures: SINGLE_MEASURE,
      readerA,
      readerB,
      judge,
    });

    assert.equal(report.status, "unresolved");
    assert.equal(report.confirmedCandidate, null);
    assert.deepEqual(report.unresolvedEventKeys, [buildStableEventKey(1, 0)]);
  });

  it("flags invalid coverage and incomplete monophonic measure occupancy", () => {
    const twoMeasureExpectation: readonly MeasureMetadata[] = [
      {
        measureNumber: 1,
        durationBeats: 4,
        timeSignatureBeats: 4,
        timeSignatureBeatUnit: 4,
        regionIds: ["region-1"],
      },
      {
        measureNumber: 2,
        durationBeats: 4,
        timeSignatureBeats: 4,
        timeSignatureBeatUnit: 4,
        regionIds: ["region-1"],
      },
    ];
    const invalidCandidate = createCandidate(
      "reader_a",
      "reader_a",
      [createNoteEvent(1, 0, 0, 3, 60, "C", "natural", 4)],
      {
        measures: twoMeasureExpectation,
        coverage: {
          isComplete: false,
          coveredMeasures: [1],
          uncoveredMeasures: [],
          ranges: [
            {
              measureStart: 1,
              measureEnd: 1,
              regionIds: ["region-1"],
            },
          ],
        },
      },
    );

    const result = validateRecognitionCandidate(invalidCandidate, {
      sourceId: SOURCE_ID,
      sourceType: SOURCE_TYPE,
      expectedRole: "reader_a",
      regions: [REGION_ONE],
      measures: twoMeasureExpectation,
    });

    assert.equal(result.ok, false);
    assert.equal(
      result.issues.some((entry) => entry.code === "coverage_missing_measure"),
      true,
    );
    assert.equal(
      result.issues.some((entry) => entry.code === "measure_occupancy_incomplete"),
      true,
    );
  });

  it("keeps unsupported settings explicit and rejects source/role mismatches", async () => {
    assert.equal(
      RECOGNITION_MODEL_PROFILES.readerB.reasoningEffort.status,
      "unsupported",
    );

    const readerA = createReader(
      "reader_a",
      createCandidate("reader_a", "reader_a", [
        createNoteEvent(1, 0, 0, 4, 60, "C", "natural", 4),
      ]),
    );
    const mismatchedReaderB = createReader(
      "reader_b",
      createCandidate(
        "reader_a",
        "reader_a",
        [createNoteEvent(1, 0, 0, 4, 60, "C", "natural", 4)],
        {
          sourceType: "jianpu-image",
        },
      ),
    );

    const report = await runRecognitionOrchestrator({
      sourceId: SOURCE_ID,
      sourceType: SOURCE_TYPE,
      regions: [REGION_ONE],
      measures: SINGLE_MEASURE,
      readerA,
      readerB: mismatchedReaderB,
    });

    assert.equal(report.status, "unresolved");
    assert.equal(
      report.readerB.validation.issues.some((entry) => entry.code === "role_mismatch"),
      true,
    );
    assert.equal(
      report.readerB.validation.issues.some(
        (entry) => entry.code === "source_type_mismatch",
      ),
      true,
    );
  });
});
