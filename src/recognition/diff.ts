import {
  pitchSpellingToText,
  type EventDifferenceKind,
  type EventLevelDifference,
  type MeasureMetadata,
  type RecognitionCandidate,
  type RecognitionCoverage,
  type RecognitionEventCandidate,
} from "./contracts";

const FLOAT_EPSILON = 1e-6;

const HIGH_RISK_DIFFERENCE_KINDS = new Set<EventDifferenceKind>([
  "missing_event",
  "octave_only_difference",
  "notation_evidence_difference",
  "timing_or_duration_difference",
  "coverage_difference",
]);

const EVENT_DIFFERENCE_ORDER: Record<EventDifferenceKind, number> = {
  missing_event: 0,
  pitch_class_difference: 1,
  octave_only_difference: 2,
  timing_or_duration_difference: 3,
  rest_difference: 4,
  lyric_difference: 5,
  spelling_difference: 6,
  notation_evidence_difference: 7,
  measure_structure_difference: 8,
  coverage_difference: 9,
};

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= FLOAT_EPSILON;
}

function moduloTwelve(value: number): number {
  const normalized = value % 12;
  return normalized >= 0 ? normalized : normalized + 12;
}

function eventComparator(
  left: RecognitionEventCandidate,
  right: RecognitionEventCandidate,
): number {
  return (
    left.measureNumber - right.measureNumber ||
    left.eventIndex - right.eventIndex ||
    left.eventKey.localeCompare(right.eventKey)
  );
}

function numberSetEqual(left: readonly number[], right: readonly number[]): boolean {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size !== rightSet.size) {
    return false;
  }
  for (const value of leftSet) {
    if (!rightSet.has(value)) {
      return false;
    }
  }
  return true;
}

function normalizeRanges(
  coverage: RecognitionCoverage,
): readonly { start: number; end: number; regions: readonly string[] }[] {
  return [...coverage.ranges]
    .map((range) => ({
      start: range.measureStart,
      end: range.measureEnd,
      regions: [...range.regionIds].sort((left, right) =>
        left.localeCompare(right),
      ),
    }))
    .sort(
      (left, right) =>
        left.start - right.start ||
        left.end - right.end ||
        left.regions.join("|").localeCompare(right.regions.join("|")),
    );
}

function sameCoverage(
  left: RecognitionCoverage,
  right: RecognitionCoverage,
): boolean {
  if (left.isComplete !== right.isComplete) {
    return false;
  }
  if (!numberSetEqual(left.coveredMeasures, right.coveredMeasures)) {
    return false;
  }
  if (!numberSetEqual(left.uncoveredMeasures, right.uncoveredMeasures)) {
    return false;
  }

  const leftRanges = normalizeRanges(left);
  const rightRanges = normalizeRanges(right);
  if (leftRanges.length !== rightRanges.length) {
    return false;
  }
  for (let index = 0; index < leftRanges.length; index += 1) {
    const leftRange = leftRanges[index];
    const rightRange = rightRanges[index];
    if (
      leftRange.start !== rightRange.start ||
      leftRange.end !== rightRange.end ||
      leftRange.regions.join("|") !== rightRange.regions.join("|")
    ) {
      return false;
    }
  }
  return true;
}

function sameMeasureMetadata(
  left: readonly MeasureMetadata[],
  right: readonly MeasureMetadata[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const leftSorted = [...left].sort(
    (first, second) => first.measureNumber - second.measureNumber,
  );
  const rightSorted = [...right].sort(
    (first, second) => first.measureNumber - second.measureNumber,
  );

  for (let index = 0; index < leftSorted.length; index += 1) {
    const leftMeasure = leftSorted[index];
    const rightMeasure = rightSorted[index];
    if (
      leftMeasure.measureNumber !== rightMeasure.measureNumber ||
      !nearlyEqual(leftMeasure.durationBeats, rightMeasure.durationBeats) ||
      leftMeasure.timeSignatureBeats !== rightMeasure.timeSignatureBeats ||
      leftMeasure.timeSignatureBeatUnit !== rightMeasure.timeSignatureBeatUnit
    ) {
      return false;
    }
    if (
      [...leftMeasure.regionIds].sort().join("|") !==
      [...rightMeasure.regionIds].sort().join("|")
    ) {
      return false;
    }
  }

  return true;
}

function riskForDifference(kind: EventDifferenceKind): "high" | "medium" | "low" {
  if (HIGH_RISK_DIFFERENCE_KINDS.has(kind)) {
    return "high";
  }
  if (kind === "lyric_difference" || kind === "spelling_difference") {
    return "low";
  }
  return "medium";
}

function sameJianpuEvidence(
  left: RecognitionEventCandidate,
  right: RecognitionEventCandidate,
): boolean {
  return (
    JSON.stringify(left.evidence.jianpu ?? null) ===
    JSON.stringify(right.evidence.jianpu ?? null)
  );
}

function addDifference(
  differences: EventLevelDifference[],
  kind: EventDifferenceKind,
  eventKey: string | null,
  measureNumber: number | null,
  leftEvent: RecognitionEventCandidate | null,
  rightEvent: RecognitionEventCandidate | null,
  message: string,
): void {
  differences.push({
    kind,
    risk: riskForDifference(kind),
    eventKey,
    measureNumber,
    leftEvent,
    rightEvent,
    message,
  });
}

function preferredMeasureNumber(
  difference: EventLevelDifference,
): number {
  if (difference.measureNumber !== null) {
    return difference.measureNumber;
  }
  if (difference.leftEvent !== null) {
    return difference.leftEvent.measureNumber;
  }
  if (difference.rightEvent !== null) {
    return difference.rightEvent.measureNumber;
  }
  return Number.MAX_SAFE_INTEGER;
}

function preferredEventIndex(
  difference: EventLevelDifference,
): number {
  if (difference.leftEvent !== null) {
    return difference.leftEvent.eventIndex;
  }
  if (difference.rightEvent !== null) {
    return difference.rightEvent.eventIndex;
  }
  return Number.MAX_SAFE_INTEGER;
}

function canonicalDifferenceComparator(
  left: EventLevelDifference,
  right: EventLevelDifference,
): number {
  return (
    preferredMeasureNumber(left) - preferredMeasureNumber(right) ||
    preferredEventIndex(left) - preferredEventIndex(right) ||
    EVENT_DIFFERENCE_ORDER[left.kind] - EVENT_DIFFERENCE_ORDER[right.kind] ||
    (left.eventKey ?? "~").localeCompare(right.eventKey ?? "~")
  );
}

export function isHighRiskDifference(kind: EventDifferenceKind): boolean {
  return HIGH_RISK_DIFFERENCE_KINDS.has(kind);
}

export function diffRecognitionCandidates(
  left: RecognitionCandidate,
  right: RecognitionCandidate,
): readonly EventLevelDifference[] {
  const differences: EventLevelDifference[] = [];

  if (!sameMeasureMetadata(left.measures, right.measures)) {
    addDifference(
      differences,
      "measure_structure_difference",
      null,
      null,
      null,
      null,
      "Measure metadata does not match between candidates.",
    );
  }

  if (!sameCoverage(left.coverage, right.coverage)) {
    addDifference(
      differences,
      "coverage_difference",
      null,
      null,
      null,
      null,
      "Coverage declaration differs between candidates.",
    );
  }

  const leftEventMap = new Map(left.events.map((event) => [event.eventKey, event]));
  const rightEventMap = new Map(
    right.events.map((event) => [event.eventKey, event]),
  );
  const allEventKeys = new Set<string>([
    ...leftEventMap.keys(),
    ...rightEventMap.keys(),
  ]);

  const sortedEventKeys = [...allEventKeys].sort((leftKey, rightKey) => {
    const leftEvent = leftEventMap.get(leftKey) ?? rightEventMap.get(leftKey);
    const rightEvent =
      leftEventMap.get(rightKey) ?? rightEventMap.get(rightKey);
    if (leftEvent && rightEvent) {
      return eventComparator(leftEvent, rightEvent);
    }
    return leftKey.localeCompare(rightKey);
  });

  for (const eventKey of sortedEventKeys) {
    const leftEvent = leftEventMap.get(eventKey) ?? null;
    const rightEvent = rightEventMap.get(eventKey) ?? null;

    if (leftEvent === null || rightEvent === null) {
      const presentEvent = leftEvent ?? rightEvent;
      addDifference(
        differences,
        "missing_event",
        eventKey,
        presentEvent?.measureNumber ?? null,
        leftEvent,
        rightEvent,
        `Event '${eventKey}' is missing from one candidate.`,
      );
      continue;
    }

    if (
      leftEvent.measureNumber !== rightEvent.measureNumber ||
      leftEvent.eventIndex !== rightEvent.eventIndex
    ) {
      addDifference(
        differences,
        "measure_structure_difference",
        eventKey,
        leftEvent.measureNumber,
        leftEvent,
        rightEvent,
        `Event '${eventKey}' has mismatched structural metadata.`,
      );
    }

    if (!sameJianpuEvidence(leftEvent, rightEvent)) {
      addDifference(
        differences,
        "notation_evidence_difference",
        eventKey,
        leftEvent.measureNumber,
        leftEvent,
        rightEvent,
        `Event '${eventKey}' has different source-glyph evidence.`,
      );
    }

    if (
      !nearlyEqual(leftEvent.offsetBeats, rightEvent.offsetBeats) ||
      !nearlyEqual(leftEvent.durationBeats, rightEvent.durationBeats)
    ) {
      addDifference(
        differences,
        "timing_or_duration_difference",
        eventKey,
        leftEvent.measureNumber,
        leftEvent,
        rightEvent,
        `Event '${eventKey}' has timing or duration differences.`,
      );
    }

    if (leftEvent.isRest !== rightEvent.isRest) {
      addDifference(
        differences,
        "rest_difference",
        eventKey,
        leftEvent.measureNumber,
        leftEvent,
        rightEvent,
        `Event '${eventKey}' disagrees on rest-vs-note classification.`,
      );
    } else if (!leftEvent.isRest && leftEvent.midi !== null && rightEvent.midi !== null) {
      if (leftEvent.midi !== rightEvent.midi) {
        if (moduloTwelve(leftEvent.midi) === moduloTwelve(rightEvent.midi)) {
          addDifference(
            differences,
            "octave_only_difference",
            eventKey,
            leftEvent.measureNumber,
            leftEvent,
            rightEvent,
            `Event '${eventKey}' differs by octave only.`,
          );
        } else {
          addDifference(
            differences,
            "pitch_class_difference",
            eventKey,
            leftEvent.measureNumber,
            leftEvent,
            rightEvent,
            `Event '${eventKey}' differs by pitch class.`,
          );
        }
      }
    }

    if (leftEvent.lyric !== rightEvent.lyric) {
      addDifference(
        differences,
        "lyric_difference",
        eventKey,
        leftEvent.measureNumber,
        leftEvent,
        rightEvent,
        `Event '${eventKey}' differs in lyric annotation.`,
      );
    }

    if (
      !leftEvent.isRest &&
      !rightEvent.isRest &&
      leftEvent.midi === rightEvent.midi &&
      pitchSpellingToText(leftEvent.pitchSpelling) !==
        pitchSpellingToText(rightEvent.pitchSpelling)
    ) {
      addDifference(
        differences,
        "spelling_difference",
        eventKey,
        leftEvent.measureNumber,
        leftEvent,
        rightEvent,
        `Event '${eventKey}' differs in pitch spelling.`,
      );
    }
  }

  differences.sort(canonicalDifferenceComparator);
  return Object.freeze(differences);
}
