import {
  buildStableEventKey,
  type CandidateValidationExpectations,
  type DeterministicIssue,
  type DeterministicValidationResult,
  type PitchAccidental,
  type PitchStep,
  type RecognitionCandidate,
  type RecognitionEventCandidate,
  RECOGNITION_CONTRACT_VERSION,
} from "./contracts";

const FLOAT_EPSILON = 1e-6;
const PITCH_CLASS_BY_STEP = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
} as const;
const ACCIDENTAL_OFFSET = {
  bb: -2,
  b: -1,
  natural: 0,
  "#": 1,
  "##": 2,
} as const;

function pitchSpellingToMidi(
  spelling: NonNullable<RecognitionEventCandidate["pitchSpelling"]>,
): number {
  return (
    (spelling.octave + 1) * 12 +
    PITCH_CLASS_BY_STEP[spelling.step] +
    ACCIDENTAL_OFFSET[spelling.accidental]
  );
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function isInteger(value: number): boolean {
  return Number.isInteger(value);
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= FLOAT_EPSILON;
}

function isPitchStep(value: string): value is PitchStep {
  return (
    value === "A" ||
    value === "B" ||
    value === "C" ||
    value === "D" ||
    value === "E" ||
    value === "F" ||
    value === "G"
  );
}

function isPitchAccidental(value: string): value is PitchAccidental {
  return (
    value === "bb" ||
    value === "b" ||
    value === "natural" ||
    value === "#" ||
    value === "##"
  );
}

function issue(
  issues: DeterministicIssue[],
  payload: DeterministicIssue,
): void {
  issues.push(payload);
}

function sameNumberSet(
  left: readonly number[],
  right: readonly number[],
): boolean {
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

function validateCoverage(
  candidate: RecognitionCandidate,
  expectations: CandidateValidationExpectations,
  issues: DeterministicIssue[],
  candidateRegionIds: Set<string>,
): void {
  const expectedMeasureNumbers = expectations.measures.map(
    (measure) => measure.measureNumber,
  );
  const coveredSet = new Set(candidate.coverage.coveredMeasures);
  const uncoveredSet = new Set(candidate.coverage.uncoveredMeasures);
  const expectedSet = new Set(expectedMeasureNumbers);

  if (
    candidate.coverage.coveredMeasures.length !== coveredSet.size ||
    candidate.coverage.uncoveredMeasures.length !== uncoveredSet.size
  ) {
    issue(issues, {
      code: "coverage_overlap",
      severity: "error",
      message: "Coverage contains duplicate measure numbers.",
      measureNumber: null,
      eventKey: null,
    });
  }

  for (const measureNumber of coveredSet) {
    if (uncoveredSet.has(measureNumber)) {
      issue(issues, {
        code: "coverage_overlap",
        severity: "error",
        message: `Measure ${measureNumber} cannot be both covered and uncovered.`,
        measureNumber,
        eventKey: null,
      });
    }
  }

  for (const measureNumber of expectedSet) {
    if (!coveredSet.has(measureNumber) && !uncoveredSet.has(measureNumber)) {
      issue(issues, {
        code: "coverage_missing_measure",
        severity: "error",
        message: `Coverage omits expected measure ${measureNumber}.`,
        measureNumber,
        eventKey: null,
      });
    }
  }

  for (const measureNumber of coveredSet) {
    if (!expectedSet.has(measureNumber)) {
      issue(issues, {
        code: "coverage_missing_measure",
        severity: "error",
        message: `Coverage includes unexpected measure ${measureNumber}.`,
        measureNumber,
        eventKey: null,
      });
    }
  }

  for (const measureNumber of uncoveredSet) {
    if (!expectedSet.has(measureNumber)) {
      issue(issues, {
        code: "coverage_missing_measure",
        severity: "error",
        message: `Uncovered list includes unexpected measure ${measureNumber}.`,
        measureNumber,
        eventKey: null,
      });
    }
  }

  if (candidate.coverage.isComplete !== (uncoveredSet.size === 0)) {
    issue(issues, {
      code: "coverage_complete_flag_mismatch",
      severity: "error",
      message:
        "coverage.isComplete must explicitly match whether uncoveredMeasures is empty.",
      measureNumber: null,
      eventKey: null,
    });
  }

  if (coveredSet.size > 0 && candidate.coverage.ranges.length === 0) {
    issue(issues, {
      code: "coverage_range_invalid",
      severity: "error",
      message: "Coverage must include explicit ranges for covered measures.",
      measureNumber: null,
      eventKey: null,
    });
  }

  for (const range of candidate.coverage.ranges) {
    if (
      !isInteger(range.measureStart) ||
      !isInteger(range.measureEnd) ||
      range.measureStart > range.measureEnd
    ) {
      issue(issues, {
        code: "coverage_range_invalid",
        severity: "error",
        message: "Coverage range measure boundaries are invalid.",
        measureNumber: null,
        eventKey: null,
      });
      continue;
    }

    if (range.regionIds.length === 0) {
      issue(issues, {
        code: "coverage_range_invalid",
        severity: "error",
        message: "Coverage ranges must reference at least one source region.",
        measureNumber: range.measureStart,
        eventKey: null,
      });
    }

    for (const regionId of range.regionIds) {
      if (!candidateRegionIds.has(regionId)) {
        issue(issues, {
          code: "unknown_region_reference",
          severity: "error",
          message: `Coverage range references unknown region '${regionId}'.`,
          measureNumber: range.measureStart,
          eventKey: null,
        });
      }
    }

    for (
      let measureNumber = range.measureStart;
      measureNumber <= range.measureEnd;
      measureNumber += 1
    ) {
      if (!coveredSet.has(measureNumber)) {
        issue(issues, {
          code: "coverage_range_invalid",
          severity: "error",
          message:
            "Coverage range references a measure that is not listed in coveredMeasures.",
          measureNumber,
          eventKey: null,
        });
      }
    }
  }

  const candidateMeasureNumbers = candidate.measures.map(
    (measure) => measure.measureNumber,
  );
  if (!sameNumberSet(candidateMeasureNumbers, expectedMeasureNumbers)) {
    issue(issues, {
      code: "measure_metadata_mismatch",
      severity: "error",
      message: "Candidate measure list does not match expected measures.",
      measureNumber: null,
      eventKey: null,
    });
  }
}

export function validateRecognitionCandidate(
  candidate: RecognitionCandidate,
  expectations: CandidateValidationExpectations,
): DeterministicValidationResult {
  const issues: DeterministicIssue[] = [];

  if (candidate.contractVersion !== RECOGNITION_CONTRACT_VERSION) {
    issue(issues, {
      code: "contract_version_mismatch",
      severity: "error",
      message: `Expected contract '${RECOGNITION_CONTRACT_VERSION}' but received '${candidate.contractVersion}'.`,
      measureNumber: null,
      eventKey: null,
    });
  }

  if (candidate.sourceId !== expectations.sourceId) {
    issue(issues, {
      code: "source_id_mismatch",
      severity: "error",
      message: `Expected sourceId '${expectations.sourceId}' but received '${candidate.sourceId}'.`,
      measureNumber: null,
      eventKey: null,
    });
  }

  if (candidate.sourceType !== expectations.sourceType) {
    issue(issues, {
      code: "source_type_mismatch",
      severity: "error",
      message: `Expected sourceType '${expectations.sourceType}' but received '${candidate.sourceType}'.`,
      measureNumber: null,
      eventKey: null,
    });
  }

  if (candidate.role !== expectations.expectedRole) {
    issue(issues, {
      code: "role_mismatch",
      severity: "error",
      message: `Expected role '${expectations.expectedRole}' but received '${candidate.role}'.`,
      measureNumber: null,
      eventKey: null,
    });
  }

  const expectedRegionIds = new Set(
    expectations.regions.map((region) => region.regionId),
  );
  const candidateRegionIds = new Set(
    candidate.regions.map((region) => region.regionId),
  );

  if (candidateRegionIds.size !== expectedRegionIds.size) {
    issue(issues, {
      code: "source_region_mismatch",
      severity: "error",
      message: "Source region count does not match expected regions.",
      measureNumber: null,
      eventKey: null,
    });
  }
  for (const expectedRegionId of expectedRegionIds) {
    if (!candidateRegionIds.has(expectedRegionId)) {
      issue(issues, {
        code: "source_region_mismatch",
        severity: "error",
        message: `Missing expected source region '${expectedRegionId}'.`,
        measureNumber: null,
        eventKey: null,
      });
    }
  }

  const measureByNumber = new Map<number, (typeof candidate.measures)[number]>();
  for (const measure of candidate.measures) {
    if (measureByNumber.has(measure.measureNumber)) {
      issue(issues, {
        code: "duplicate_measure_number",
        severity: "error",
        message: `Duplicate measure metadata for measure ${measure.measureNumber}.`,
        measureNumber: measure.measureNumber,
        eventKey: null,
      });
      continue;
    }
    measureByNumber.set(measure.measureNumber, measure);

    if (!isFiniteNumber(measure.durationBeats) || measure.durationBeats <= 0) {
      issue(issues, {
        code: "invalid_measure_duration",
        severity: "error",
        message: `Measure ${measure.measureNumber} has invalid duration ${measure.durationBeats}.`,
        measureNumber: measure.measureNumber,
        eventKey: null,
      });
    }

    for (const regionId of measure.regionIds) {
      if (!candidateRegionIds.has(regionId)) {
        issue(issues, {
          code: "unknown_region_reference",
          severity: "error",
          message: `Measure ${measure.measureNumber} references unknown region '${regionId}'.`,
          measureNumber: measure.measureNumber,
          eventKey: null,
        });
      }
    }
  }

  for (const expectedMeasure of expectations.measures) {
    const found = measureByNumber.get(expectedMeasure.measureNumber);
    if (!found) {
      issue(issues, {
        code: "measure_metadata_mismatch",
        severity: "error",
        message: `Missing expected measure metadata for measure ${expectedMeasure.measureNumber}.`,
        measureNumber: expectedMeasure.measureNumber,
        eventKey: null,
      });
      continue;
    }

    if (
      !nearlyEqual(found.durationBeats, expectedMeasure.durationBeats) ||
      found.timeSignatureBeats !== expectedMeasure.timeSignatureBeats ||
      found.timeSignatureBeatUnit !== expectedMeasure.timeSignatureBeatUnit
    ) {
      issue(issues, {
        code: "measure_metadata_mismatch",
        severity: "error",
        message: `Measure ${expectedMeasure.measureNumber} metadata does not match expectations.`,
        measureNumber: expectedMeasure.measureNumber,
        eventKey: null,
      });
    }
  }

  validateCoverage(candidate, expectations, issues, candidateRegionIds);

  const coveredMeasures = new Set(candidate.coverage.coveredMeasures);
  const eventsByMeasure = new Map<number, (typeof candidate.events)>();
  const eventKeys = new Set<string>();

  for (const event of candidate.events) {
    if (eventKeys.has(event.eventKey)) {
      issue(issues, {
        code: "duplicate_event_key",
        severity: "error",
        message: `Duplicate event key '${event.eventKey}'.`,
        measureNumber: event.measureNumber,
        eventKey: event.eventKey,
      });
    } else {
      eventKeys.add(event.eventKey);
    }

    const expectedKey = buildStableEventKey(event.measureNumber, event.eventIndex);
    if (event.eventKey !== expectedKey) {
      issue(issues, {
        code: "unstable_event_key",
        severity: "error",
        message: `Event key '${event.eventKey}' must be '${expectedKey}'.`,
        measureNumber: event.measureNumber,
        eventKey: event.eventKey,
      });
    }

    if (!isInteger(event.eventIndex) || event.eventIndex < 0) {
      issue(issues, {
        code: "event_index_invalid",
        severity: "error",
        message: `Event '${event.eventKey}' has invalid eventIndex ${event.eventIndex}.`,
        measureNumber: event.measureNumber,
        eventKey: event.eventKey,
      });
    }

    const measure = measureByNumber.get(event.measureNumber);
    if (!measure) {
      issue(issues, {
        code: "event_measure_missing",
        severity: "error",
        message: `Event '${event.eventKey}' references missing measure ${event.measureNumber}.`,
        measureNumber: event.measureNumber,
        eventKey: event.eventKey,
      });
      continue;
    }

    if (!coveredMeasures.has(event.measureNumber)) {
      issue(issues, {
        code: "uncovered_measure_has_events",
        severity: "error",
        message: `Event '${event.eventKey}' appears in uncovered measure ${event.measureNumber}.`,
        measureNumber: event.measureNumber,
        eventKey: event.eventKey,
      });
    }

    if (!isFiniteNumber(event.offsetBeats) || event.offsetBeats < 0) {
      issue(issues, {
        code: "invalid_offset",
        severity: "error",
        message: `Event '${event.eventKey}' has invalid offset ${event.offsetBeats}.`,
        measureNumber: event.measureNumber,
        eventKey: event.eventKey,
      });
    }

    if (!isFiniteNumber(event.durationBeats) || event.durationBeats <= 0) {
      issue(issues, {
        code: "invalid_duration",
        severity: "error",
        message: `Event '${event.eventKey}' has invalid duration ${event.durationBeats}.`,
        measureNumber: event.measureNumber,
        eventKey: event.eventKey,
      });
    }

    if (
      isFiniteNumber(event.offsetBeats) &&
      isFiniteNumber(event.durationBeats) &&
      event.offsetBeats + event.durationBeats > measure.durationBeats + FLOAT_EPSILON
    ) {
      issue(issues, {
        code: "event_out_of_range",
        severity: "error",
        message: `Event '${event.eventKey}' exceeds measure ${event.measureNumber} duration.`,
        measureNumber: event.measureNumber,
        eventKey: event.eventKey,
      });
    }

    if (!candidateRegionIds.has(event.regionId)) {
      issue(issues, {
        code: "unknown_region_reference",
        severity: "error",
        message: `Event '${event.eventKey}' references unknown region '${event.regionId}'.`,
        measureNumber: event.measureNumber,
        eventKey: event.eventKey,
      });
    }

    if (
      !isFiniteNumber(event.evidence.confidence) ||
      event.evidence.confidence < 0 ||
      event.evidence.confidence > 1
    ) {
      issue(issues, {
        code: "invalid_confidence",
        severity: "error",
        message: `Event '${event.eventKey}' has invalid evidence confidence.`,
        measureNumber: event.measureNumber,
        eventKey: event.eventKey,
      });
    }

    if (event.evidence.rationale.trim().length === 0) {
      issue(issues, {
        code: "invalid_confidence",
        severity: "error",
        message: `Event '${event.eventKey}' must include non-empty evidence rationale.`,
        measureNumber: event.measureNumber,
        eventKey: event.eventKey,
      });
    }

    if (candidate.sourceType === "jianpu-image") {
      const jianpu = event.evidence.jianpu;
      if (jianpu === undefined) {
        issue(issues, {
          code: "missing_jianpu_evidence",
          severity: "error",
          message: `Event '${event.eventKey}' must include structured jianpu glyph evidence.`,
          measureNumber: event.measureNumber,
          eventKey: event.eventKey,
        });
      } else {
        const expectedDotPosition =
          jianpu.octaveShift > 0 ? "above" : "below";
        const octaveDotsValid =
          Number.isInteger(jianpu.octaveShift) &&
          Math.abs(jianpu.octaveShift) <= 2 &&
          jianpu.octaveDots.length === Math.abs(jianpu.octaveShift) &&
          jianpu.octaveDots.every(
            (dot) =>
              dot.position === expectedDotPosition &&
              isFiniteNumber(dot.horizontalOffset) &&
              Math.abs(dot.horizontalOffset) <= 0.35 &&
              isFiniteNumber(dot.verticalGap) &&
              dot.verticalGap >= 0.05 &&
              dot.verticalGap <= 1.25 &&
              isFiniteNumber(dot.diameter) &&
              dot.diameter >= 0.08 &&
              dot.diameter <= 0.45,
          );
        const digitValid =
          Number.isInteger(jianpu.digit) &&
          jianpu.digit >= 0 &&
          jianpu.digit <= 7 &&
          (event.isRest ? jianpu.digit === 0 : jianpu.digit >= 1);
        const rhythmEvidenceValid =
          Number.isInteger(jianpu.underlineCount) &&
          jianpu.underlineCount >= 0 &&
          jianpu.underlineCount <= 3 &&
          Number.isInteger(jianpu.durationDotCount) &&
          jianpu.durationDotCount >= 0 &&
          jianpu.durationDotCount <= 2 &&
          Number.isInteger(jianpu.sustainDashCount) &&
          jianpu.sustainDashCount >= 0 &&
          jianpu.sustainDashCount <= 3;
        const baseDuration = 1 / 2 ** jianpu.underlineCount;
        const dottedMultiplier =
          jianpu.durationDotCount === 0
            ? 1
            : jianpu.durationDotCount === 1
              ? 1.5
              : 1.75;
        const evidencedDuration =
          baseDuration * dottedMultiplier + jianpu.sustainDashCount;
        const durationMatchesEvidence =
          Math.abs(event.durationBeats - evidencedDuration) <= 0.0001;

        if (
          !octaveDotsValid ||
          !digitValid ||
          !rhythmEvidenceValid ||
          !durationMatchesEvidence
        ) {
          issue(issues, {
            code: "invalid_jianpu_evidence",
            severity: "error",
            message:
              `Event '${event.eventKey}' has invalid or geometrically unaligned jianpu evidence.`,
            measureNumber: event.measureNumber,
            eventKey: event.eventKey,
          });
        }
      }
    }

    if (event.lyric !== null && event.lyric.trim().length === 0) {
      issue(issues, {
        code: "invalid_lyric",
        severity: "error",
        message: `Event '${event.eventKey}' lyric must be null or non-empty text.`,
        measureNumber: event.measureNumber,
        eventKey: event.eventKey,
      });
    }

    if (event.isRest) {
      if (event.midi !== null || event.pitchSpelling !== null) {
        issue(issues, {
          code: "invalid_rest_encoding",
          severity: "error",
          message:
            "Rest events must set midi and pitchSpelling to null explicitly.",
          measureNumber: event.measureNumber,
          eventKey: event.eventKey,
        });
      }
    } else {
      if (event.midi === null || event.pitchSpelling === null) {
        issue(issues, {
          code: "invalid_rest_encoding",
          severity: "error",
          message:
            "Non-rest events must include both midi and explicit pitchSpelling.",
          measureNumber: event.measureNumber,
          eventKey: event.eventKey,
        });
      } else {
        if (!isInteger(event.midi) || event.midi < 0 || event.midi > 127) {
          issue(issues, {
            code: "invalid_midi",
            severity: "error",
            message: `Event '${event.eventKey}' has invalid midi value ${event.midi}.`,
            measureNumber: event.measureNumber,
            eventKey: event.eventKey,
          });
        }

        if (
          !isPitchStep(event.pitchSpelling.step) ||
          !isPitchAccidental(event.pitchSpelling.accidental) ||
          !isInteger(event.pitchSpelling.octave)
        ) {
          issue(issues, {
            code: "invalid_pitch_spelling",
            severity: "error",
            message: `Event '${event.eventKey}' has invalid pitch spelling.`,
            measureNumber: event.measureNumber,
            eventKey: event.eventKey,
          });
        } else if (pitchSpellingToMidi(event.pitchSpelling) !== event.midi) {
          issue(issues, {
            code: "pitch_midi_mismatch",
            severity: "error",
            message: `Event '${event.eventKey}' pitch spelling does not match MIDI ${event.midi}.`,
            measureNumber: event.measureNumber,
            eventKey: event.eventKey,
          });
        }
      }
    }

    const measureEvents = eventsByMeasure.get(event.measureNumber);
    if (measureEvents) {
      eventsByMeasure.set(event.measureNumber, [...measureEvents, event]);
    } else {
      eventsByMeasure.set(event.measureNumber, [event]);
    }
  }

  for (const measure of candidate.measures) {
    const measureEvents = eventsByMeasure.get(measure.measureNumber) ?? [];

    if (!coveredMeasures.has(measure.measureNumber)) {
      if (measureEvents.length > 0) {
        issue(issues, {
          code: "uncovered_measure_has_events",
          severity: "error",
          message: `Uncovered measure ${measure.measureNumber} includes events.`,
          measureNumber: measure.measureNumber,
          eventKey: null,
        });
      }
      continue;
    }

    if (measureEvents.length === 0) {
      issue(issues, {
        code: "measure_occupancy_incomplete",
        severity: "error",
        message: `Covered measure ${measure.measureNumber} has no events; rests must be explicit.`,
        measureNumber: measure.measureNumber,
        eventKey: null,
      });
      continue;
    }

    const sorted = [...measureEvents].sort(
      (left, right) =>
        left.eventIndex - right.eventIndex ||
        left.offsetBeats - right.offsetBeats ||
        left.durationBeats - right.durationBeats,
    );
    let cursor = 0;

    for (let index = 0; index < sorted.length; index += 1) {
      const event = sorted[index];
      if (event.eventIndex !== index) {
        issue(issues, {
          code: "event_index_invalid",
          severity: "error",
          message: `Measure ${measure.measureNumber} event indices must be contiguous from zero.`,
          measureNumber: measure.measureNumber,
          eventKey: event.eventKey,
        });
      }

      if (!nearlyEqual(event.offsetBeats, cursor)) {
        issue(issues, {
          code: "measure_occupancy_gap_or_overlap",
          severity: "error",
          message: `Measure ${measure.measureNumber} has a timing gap/overlap at event '${event.eventKey}'.`,
          measureNumber: measure.measureNumber,
          eventKey: event.eventKey,
        });
      }
      cursor = event.offsetBeats + event.durationBeats;
    }

    if (!nearlyEqual(cursor, measure.durationBeats)) {
      issue(issues, {
        code: "measure_occupancy_incomplete",
        severity: "error",
        message: `Measure ${measure.measureNumber} occupancy must equal ${measure.durationBeats} beats including explicit rests.`,
        measureNumber: measure.measureNumber,
        eventKey: null,
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues: Object.freeze(issues),
  };
}
