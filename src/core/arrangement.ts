import type {
  AccompanimentMode,
  ChordAssignment,
  ChordDefinition,
  ChordOverrides,
  MeasureModel,
  PerformanceEvent,
  ScoreEvent,
  SongModel,
} from "../types";
import { getMeasureSpans } from "./model";
import {
  buildChordPalette,
  isBlackKey,
  positiveModulo,
} from "./theory";

function fingeringStartCost(event: ScoreEvent, finger: number, centerMidi: number): number {
  if (event.midi === null) return 0;
  const expectedFinger = Math.max(
    1,
    Math.min(5, Math.round((event.midi - (centerMidi - 4)) / 2) + 1),
  );
  return Math.abs(finger - expectedFinger) * 0.45 +
    (finger === 1 && isBlackKey(event.midi) ? 1.1 : 0);
}

function fingeringTransitionCost(
  previous: ScoreEvent,
  previousFinger: number,
  current: ScoreEvent,
  currentFinger: number,
): number {
  if (previous.midi === null || current.midi === null) return 0;

  const pitchDelta = current.midi - previous.midi;
  const fingerDelta = currentFinger - previousFinger;
  const pitchDirection = Math.sign(pitchDelta);
  const fingerDirection = Math.sign(fingerDelta);
  let cost = 0;

  if (pitchDelta === 0) {
    cost += Math.abs(fingerDelta) * 0.5;
  } else {
    if (fingerDelta === 0) cost += 7;

    if (pitchDirection !== fingerDirection) {
      const naturalCrossing =
        (pitchDelta > 0 && currentFinger === 1 && previousFinger >= 3) ||
        (pitchDelta < 0 && previousFinger === 1 && currentFinger >= 3);
      cost += naturalCrossing ? 1.35 : 6.5;
    }

    const comfortableSpan = Math.abs(fingerDelta) * 2 + 1;
    if (Math.abs(pitchDelta) > comfortableSpan) {
      cost += (Math.abs(pitchDelta) - comfortableSpan) * 1.25;
    }

    cost += Math.abs(Math.abs(pitchDelta) - Math.abs(fingerDelta) * 1.7) * 0.18;
  }

  if (currentFinger === 1 && isBlackKey(current.midi)) cost += 1.2;
  if (Math.abs(pitchDelta) > 12) cost += 5;
  return cost;
}

export function recommendFingering(song: SongModel): SongModel {
  const notes = song.measures
    .flatMap((measure) => measure.events)
    .filter((event): event is ScoreEvent & { midi: number } => event.midi !== null);
  if (notes.length === 0) return song;

  const sortedPitches = notes.map((event) => event.midi).sort((a, b) => a - b);
  const centerMidi = sortedPitches[Math.floor(sortedPitches.length / 2)];
  const costs: number[][] = [];
  const parents: number[][] = [];

  notes.forEach((event, noteIndex) => {
    const availableFingers =
      event.fingerLocked && event.finger ? [event.finger] : [1, 2, 3, 4, 5];
    costs[noteIndex] = Array(6).fill(Number.POSITIVE_INFINITY);
    parents[noteIndex] = Array(6).fill(0);

    for (const finger of availableFingers) {
      if (noteIndex === 0) {
        costs[noteIndex][finger] = fingeringStartCost(event, finger, centerMidi);
        continue;
      }

      for (let previousFinger = 1; previousFinger <= 5; previousFinger += 1) {
        const previousCost = costs[noteIndex - 1][previousFinger];
        if (!Number.isFinite(previousCost)) continue;
        const cost =
          previousCost +
          fingeringTransitionCost(
            notes[noteIndex - 1],
            previousFinger,
            event,
            finger,
          );
        if (cost < costs[noteIndex][finger]) {
          costs[noteIndex][finger] = cost;
          parents[noteIndex][finger] = previousFinger;
        }
      }
    }
  });

  let finger = costs.at(-1)!.slice(1).reduce(
    (best, value, index, values) => (value < values[best - 1] ? index + 1 : best),
    1,
  );
  const result = new Map<string, number>();
  for (let noteIndex = notes.length - 1; noteIndex >= 0; noteIndex -= 1) {
    result.set(notes[noteIndex].id, finger);
    finger = parents[noteIndex][finger] || finger;
  }

  return {
    ...song,
    measures: song.measures.map((measure) => ({
      ...measure,
      events: measure.events.map((event) => ({
        ...event,
        finger: event.midi === null ? undefined : result.get(event.id) ?? event.finger,
      })),
    })),
  };
}

function melodyFitScore(measure: MeasureModel, chord: ChordDefinition): number {
  return measure.events.reduce((score, event) => {
    if (event.midi === null) return score;
    const strength =
      event.offsetBeats === 0 ? 2.2 : Number.isInteger(event.offsetBeats) ? 1.35 : 0.8;
    return (
      score +
      (chord.pitchClasses.includes(positiveModulo(event.midi, 12))
        ? strength * 2.4
        : -strength * 0.75)
    );
  }, 0);
}

function transitionScore(previous: ChordDefinition, current: ChordDefinition): number {
  if (previous.degree === current.degree) return -0.2;
  const favored = new Set(["1-4", "1-5", "4-1", "4-5", "5-1", "6-4", "6-5"]);
  return favored.has(`${previous.degree}-${current.degree}`) ? 1.2 : -0.35;
}

function candidateVoicings(chord: ChordDefinition): number[][] {
  const root = bassRootPitch(chord);
  const intervals = chord.quality === "major" ? [0, 4, 7] : [0, 3, 7];
  const close = intervals.map((interval) => root + interval);
  return [
    close,
    [close[1], close[2], close[0] + 12],
    [close[2], close[0] + 12, close[1] + 12],
    close.map((pitch) => pitch + 12),
  ];
}

function bassRootPitch(chord: ChordDefinition): number {
  return 36 + positiveModulo(chord.rootPc - 36, 12);
}

function chooseVoicing(
  chord: ChordDefinition,
  previousPitches: number[] | undefined,
): number[] {
  return candidateVoicings(chord).reduce((best, candidate) => {
    const centerPenalty =
      Math.abs(candidate.reduce((sum, pitch) => sum + pitch, 0) / candidate.length - 47) *
      0.18;
    const movementPenalty = previousPitches
      ? candidate.reduce(
          (sum, pitch, index) => sum + Math.abs(pitch - previousPitches[index]),
          0,
        )
      : 0;
    const bestMovement = previousPitches
      ? best.reduce(
          (sum, pitch, index) => sum + Math.abs(pitch - previousPitches[index]),
          0,
        )
      : 0;
    const bestCenter =
      Math.abs(best.reduce((sum, pitch) => sum + pitch, 0) / best.length - 47) * 0.18;
    return movementPenalty + centerPenalty < bestMovement + bestCenter ? candidate : best;
  });
}

export function harmonize(
  song: SongModel,
  overrides: ChordOverrides = {},
): ChordAssignment[] {
  const palette = buildChordPalette(song.key);
  const measures = song.measures.filter((measure) => measure.number > 0);
  if (measures.length === 0) return [];

  const costs: number[][] = [];
  const parents: number[][] = [];

  measures.forEach((measure, measureIndex) => {
    costs[measureIndex] = Array(palette.length).fill(Number.NEGATIVE_INFINITY);
    parents[measureIndex] = Array(palette.length).fill(0);
    const override = overrides[String(measure.number)];

    palette.forEach((chord, chordIndex) => {
      if (override && override.symbol !== chord.symbol) return;
      let localScore = melodyFitScore(measure, chord);
      if (measure.chordHint === chord.symbol) localScore += 4;
      if (measure.phraseEnd && chord.degree === 1) localScore += 2.4;
      if (measureIndex === measures.length - 1 && chord.degree === 1) localScore += 3;

      if (measureIndex === 0) {
        costs[measureIndex][chordIndex] = localScore + (chord.degree === 1 ? 1.2 : 0);
        return;
      }

      palette.forEach((previous, previousIndex) => {
        const previousScore = costs[measureIndex - 1][previousIndex];
        if (!Number.isFinite(previousScore)) return;
        const score = previousScore + localScore + transitionScore(previous, chord);
        if (score > costs[measureIndex][chordIndex]) {
          costs[measureIndex][chordIndex] = score;
          parents[measureIndex][chordIndex] = previousIndex;
        }
      });
    });
  });

  let chordIndex = costs.at(-1)!.reduce(
    (best, value, index, values) => (value > values[best] ? index : best),
    0,
  );
  const chosen: ChordDefinition[] = Array(measures.length);
  for (let index = measures.length - 1; index >= 0; index -= 1) {
    chosen[index] = palette[chordIndex];
    chordIndex = parents[index][chordIndex];
  }

  let previousPitches: number[] | undefined;
  return chosen.map((chord, index) => {
    const pitches = chooseVoicing(chord, previousPitches);
    previousPitches = pitches;
    const override = overrides[String(measures[index].number)];
    const fit = melodyFitScore(measures[index], chord);
    return {
      ...chord,
      measureNumber: measures[index].number,
      pitches,
      confidence: Math.max(0.55, Math.min(0.98, 0.72 + fit / 40)),
      locked: Boolean(override?.locked),
    };
  });
}

function leftFinger(pitches: number[], pitch: number): number {
  const ordered = [...new Set(pitches)].sort((a, b) => a - b);
  if (ordered.length === 1) return 5;
  const index = ordered.indexOf(pitch);
  return ordered.length === 2 ? [5, 1][index] : [5, 3, 1][index] ?? 1;
}

export function buildPerformanceTimeline(
  song: SongModel,
  harmony: ChordAssignment[],
  mode: AccompanimentMode,
): PerformanceEvent[] {
  const spans = getMeasureSpans(song);
  const spanByMeasure = new Map(spans.map((span) => [span.number, span]));
  const measureByNumber = new Map(
    song.measures.map((measure) => [measure.number, measure]),
  );
  const melody: PerformanceEvent[] = song.measures.flatMap((measure) => {
    const span = spanByMeasure.get(measure.number)!;
    return measure.events.flatMap((event) =>
      event.midi === null
        ? []
        : [
            {
              id: `rh-${event.id}`,
              sourceEventId: event.id,
              startBeat: span.startBeat + event.offsetBeats,
              durationBeats: event.durationBeats,
              midi: event.midi,
              hand: "right" as const,
              finger: event.finger ?? 1,
              voice: "melody" as const,
              velocity: 0.78,
              measureNumber: measure.number,
            },
          ],
    );
  });

  const accompaniment: PerformanceEvent[] = harmony.flatMap((chord) => {
    const span = spanByMeasure.get(chord.measureNumber);
    if (!span) return [];
    const measureLength = span.endBeat - span.startBeat;
    const measure = measureByNumber.get(chord.measureNumber);
    const soundingLength = Math.min(
      measureLength,
      measure?.events.reduce(
        (end, event) =>
          event.midi === null
            ? end
            : Math.max(end, event.offsetBeats + event.durationBeats),
        0,
      ) ?? measureLength,
    );
    if (soundingLength <= 0) return [];

    const root = bassRootPitch(chord);
    const fifth = root + 7;
    const makeEvent = (
      pitch: number,
      offset: number,
      duration: number,
      index: number,
      fingeringPitches = chord.pitches,
    ): PerformanceEvent => ({
      id: `lh-${chord.measureNumber}-${mode}-${index}`,
      startBeat: span.startBeat + offset,
      durationBeats: duration,
      midi: pitch,
      hand: "left",
      finger: leftFinger(fingeringPitches, pitch),
      voice: "accompaniment",
      velocity: 0.55,
      measureNumber: chord.measureNumber,
      chord: chord.symbol,
    });

    if (mode === "root") {
      return [makeEvent(root, 0, soundingLength, 0, [root])];
    }

    if (mode === "root-fifth") {
      if (soundingLength < measureLength - 0.001) {
        return [makeEvent(root, 0, soundingLength, 0, [root])];
      }
      const half = measureLength / 2;
      const pitches = [root, fifth];
      return [
        makeEvent(root, 0, half, 0, pitches),
        makeEvent(fifth, half, half, 1, pitches),
      ];
    }

    if (mode === "block") {
      return chord.pitches.map((pitch, index) =>
        makeEvent(pitch, 0, soundingLength, index),
      );
    }

    const step = 0.5;
    const pattern = [chord.pitches[0], chord.pitches[1], chord.pitches[2], chord.pitches[1]];
    const events: PerformanceEvent[] = [];
    for (let offset = 0, index = 0; offset < soundingLength; offset += step, index += 1) {
      events.push(
        makeEvent(
          pattern[index % pattern.length],
          offset,
          Math.min(step, soundingLength - offset),
          index,
        ),
      );
    }
    return events;
  });

  return [...melody, ...accompaniment].sort(
    (a, b) => a.startBeat - b.startBeat || a.midi - b.midi,
  );
}
