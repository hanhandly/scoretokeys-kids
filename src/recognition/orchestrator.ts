import {
  type EventLevelDifference,
  type JudgeRequest,
  type JudgeResolution,
  type ReaderInvocationRequest,
  type RecognitionCandidate,
  RECOGNITION_CONTRACT_VERSION,
  type RecognitionOrchestrationRequest,
  type VerificationReport,
} from "./contracts";
import { diffRecognitionCandidates } from "./diff";
import { validateRecognitionCandidate } from "./validation";

function buildReaderRequest(
  request: RecognitionOrchestrationRequest,
  role: "reader_a" | "reader_b",
): ReaderInvocationRequest {
  return {
    contractVersion: RECOGNITION_CONTRACT_VERSION,
    role,
    sourceId: request.sourceId,
    sourceType: request.sourceType,
    regions: request.regions.map((region) => ({ ...region })),
    measures: request.measures.map((measure) => ({
      ...measure,
      regionIds: [...measure.regionIds],
    })),
  };
}

function buildJudgeRequest(
  request: RecognitionOrchestrationRequest,
  readerA: VerificationReport["readerA"],
  readerB: VerificationReport["readerB"],
  differences: readonly EventLevelDifference[],
): JudgeRequest {
  return {
    contractVersion: RECOGNITION_CONTRACT_VERSION,
    sourceId: request.sourceId,
    sourceType: request.sourceType,
    readerA: readerA.candidate,
    readerB: readerB.candidate,
    readerAValidation: readerA.validation,
    readerBValidation: readerB.validation,
    differences,
  };
}

interface MergeOutcome {
  readonly mergedCandidate: RecognitionCandidate | null;
  readonly unresolvedEventKeys: readonly string[];
}

function eventSort(
  left: RecognitionCandidate["events"][number],
  right: RecognitionCandidate["events"][number],
): number {
  return (
    left.measureNumber - right.measureNumber ||
    left.eventIndex - right.eventIndex ||
    left.eventKey.localeCompare(right.eventKey)
  );
}

function mergeJudgeResolution(
  readerA: RecognitionCandidate,
  readerB: RecognitionCandidate,
  differences: readonly EventLevelDifference[],
  judgeResolution: JudgeResolution,
): MergeOutcome {
  const structuralDifference = differences.some(
    (difference) => difference.eventKey === null,
  );
  if (structuralDifference) {
    return {
      mergedCandidate: null,
      unresolvedEventKeys: Object.freeze(["__structural_difference__"]),
    };
  }

  const diffEventKeySet = new Set(
    differences
      .map((difference) => difference.eventKey)
      .filter((eventKey): eventKey is string => eventKey !== null),
  );
  const leftEventMap = new Map(readerA.events.map((event) => [event.eventKey, event]));
  const rightEventMap = new Map(readerB.events.map((event) => [event.eventKey, event]));
  const resolutionByEventKey = new Map(
    judgeResolution.eventResolutions.map((resolution) => [
      resolution.eventKey,
      resolution,
    ]),
  );

  const unresolvedEventKeys: string[] = [];
  for (const eventKey of diffEventKeySet) {
    const resolution = resolutionByEventKey.get(eventKey);
    if (!resolution || resolution.status !== "selected" || !resolution.selectedFrom) {
      unresolvedEventKeys.push(eventKey);
      continue;
    }
    const chosenEvent =
      resolution.selectedFrom === "reader_a"
        ? leftEventMap.get(eventKey)
        : rightEventMap.get(eventKey);
    if (!chosenEvent) {
      unresolvedEventKeys.push(eventKey);
    }
  }

  if (unresolvedEventKeys.length > 0) {
    return {
      mergedCandidate: null,
      unresolvedEventKeys: Object.freeze(
        [...new Set(unresolvedEventKeys)].sort((left, right) =>
          left.localeCompare(right),
        ),
      ),
    };
  }

  const allEventKeys = new Set<string>([
    ...leftEventMap.keys(),
    ...rightEventMap.keys(),
  ]);
  const mergedEvents: RecognitionCandidate["events"][number][] = [];

  for (const eventKey of allEventKeys) {
    if (diffEventKeySet.has(eventKey)) {
      const resolution = resolutionByEventKey.get(eventKey);
      if (!resolution || resolution.status !== "selected" || !resolution.selectedFrom) {
        unresolvedEventKeys.push(eventKey);
        continue;
      }
      const chosenEvent =
        resolution.selectedFrom === "reader_a"
          ? leftEventMap.get(eventKey)
          : rightEventMap.get(eventKey);
      if (!chosenEvent) {
        unresolvedEventKeys.push(eventKey);
        continue;
      }
      mergedEvents.push({ ...chosenEvent });
      continue;
    }

    const leftEvent = leftEventMap.get(eventKey);
    if (leftEvent) {
      mergedEvents.push({ ...leftEvent });
      continue;
    }
    const rightEvent = rightEventMap.get(eventKey);
    if (rightEvent) {
      mergedEvents.push({ ...rightEvent });
    }
  }

  if (unresolvedEventKeys.length > 0) {
    return {
      mergedCandidate: null,
      unresolvedEventKeys: Object.freeze(
        [...new Set(unresolvedEventKeys)].sort((left, right) =>
          left.localeCompare(right),
        ),
      ),
    };
  }

  const mergedCandidate: RecognitionCandidate = {
    ...readerA,
    role: "judge_merged",
    execution: {
      ...judgeResolution.execution,
      notes: [...judgeResolution.execution.notes],
    },
    events: Object.freeze(mergedEvents.sort(eventSort)),
  };

  return {
    mergedCandidate,
    unresolvedEventKeys: Object.freeze([]),
  };
}

export async function runRecognitionOrchestrator(
  request: RecognitionOrchestrationRequest,
): Promise<VerificationReport> {
  const readerARequest = buildReaderRequest(request, "reader_a");
  const readerBRequest = buildReaderRequest(request, "reader_b");

  const [readerACandidate, readerBCandidate] = await Promise.all([
    request.readerA.recognize(readerARequest),
    request.readerB.recognize(readerBRequest),
  ]);

  const readerAValidation = validateRecognitionCandidate(readerACandidate, {
    sourceId: request.sourceId,
    sourceType: request.sourceType,
    expectedRole: "reader_a",
    regions: request.regions,
    measures: request.measures,
  });
  const readerBValidation = validateRecognitionCandidate(readerBCandidate, {
    sourceId: request.sourceId,
    sourceType: request.sourceType,
    expectedRole: "reader_b",
    regions: request.regions,
    measures: request.measures,
  });

  const readerA = { candidate: readerACandidate, validation: readerAValidation };
  const readerB = { candidate: readerBCandidate, validation: readerBValidation };
  const differences = diffRecognitionCandidates(readerACandidate, readerBCandidate);
  const deterministicValid = readerAValidation.ok && readerBValidation.ok;

  if (!deterministicValid) {
    return {
      contractVersion: RECOGNITION_CONTRACT_VERSION,
      status: "unresolved",
      readerA,
      readerB,
      differences,
      judgeRequest: null,
      judgeResolution: null,
      unresolvedEventKeys: Object.freeze([]),
      mergedValidation: null,
      confirmedCandidate: null,
    };
  }

  if (differences.length === 0) {
    return {
      contractVersion: RECOGNITION_CONTRACT_VERSION,
      status: "reader-agreed",
      readerA,
      readerB,
      differences,
      judgeRequest: null,
      judgeResolution: null,
      unresolvedEventKeys: Object.freeze([]),
      mergedValidation: readerAValidation,
      confirmedCandidate: readerACandidate,
    };
  }

  if (!request.judge) {
    return {
      contractVersion: RECOGNITION_CONTRACT_VERSION,
      status: "unresolved",
      readerA,
      readerB,
      differences,
      judgeRequest: null,
      judgeResolution: null,
      unresolvedEventKeys: Object.freeze([]),
      mergedValidation: null,
      confirmedCandidate: null,
    };
  }

  const judgeRequest = buildJudgeRequest(request, readerA, readerB, differences);
  const judgeResolution = await request.judge.judge(judgeRequest);
  const mergeOutcome = mergeJudgeResolution(
    readerACandidate,
    readerBCandidate,
    differences,
    judgeResolution,
  );

  if (!mergeOutcome.mergedCandidate) {
    return {
      contractVersion: RECOGNITION_CONTRACT_VERSION,
      status: "unresolved",
      readerA,
      readerB,
      differences,
      judgeRequest,
      judgeResolution,
      unresolvedEventKeys: mergeOutcome.unresolvedEventKeys,
      mergedValidation: null,
      confirmedCandidate: null,
    };
  }

  const mergedValidation = validateRecognitionCandidate(mergeOutcome.mergedCandidate, {
    sourceId: request.sourceId,
    sourceType: request.sourceType,
    expectedRole: "judge_merged",
    regions: request.regions,
    measures: request.measures,
  });

  if (!mergedValidation.ok) {
    return {
      contractVersion: RECOGNITION_CONTRACT_VERSION,
      status: "unresolved",
      readerA,
      readerB,
      differences,
      judgeRequest,
      judgeResolution,
      unresolvedEventKeys: Object.freeze([]),
      mergedValidation,
      confirmedCandidate: null,
    };
  }

  return {
    contractVersion: RECOGNITION_CONTRACT_VERSION,
    status: "judge-confirmed",
    readerA,
    readerB,
    differences,
    judgeRequest,
    judgeResolution,
    unresolvedEventKeys: Object.freeze([]),
    mergedValidation,
    confirmedCandidate: mergeOutcome.mergedCandidate,
  };
}
