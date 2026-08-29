import type {
  MeasureModel,
  MeasureSpan,
  ScoreEvent,
  SongModel,
  ValidationIssue,
} from "../types";

export function getMeasureSpans(song: SongModel): MeasureSpan[] {
  let cursor = 0;
  return song.measures.map((measure) => {
    const span = {
      number: measure.number,
      startBeat: cursor,
      endBeat: cursor + measure.durationBeats,
    };
    cursor = span.endBeat;
    return span;
  });
}

export function groupMeasuresIntoSystems(
  measures: MeasureModel[],
  measuresPerSystem = 4,
): MeasureModel[][] {
  if (measuresPerSystem < 1) {
    throw new Error("每行小节数必须至少为 1。");
  }

  const pickupMeasures = measures.filter((measure) => measure.number <= 0);
  const numberedMeasures = measures.filter((measure) => measure.number > 0);
  const systems: MeasureModel[][] = [];

  for (let index = 0; index < numberedMeasures.length; index += measuresPerSystem) {
    systems.push(numberedMeasures.slice(index, index + measuresPerSystem));
  }

  if (systems.length === 0) {
    return pickupMeasures.length > 0 ? [pickupMeasures] : [];
  }
  if (pickupMeasures.length > 0) {
    systems[0] = [...pickupMeasures, ...systems[0]];
  }
  return systems;
}

export function getTotalBeats(song: SongModel): number {
  return song.measures.reduce((sum, measure) => sum + measure.durationBeats, 0);
}

export function getMeasureAtBeat(song: SongModel, beat: number): number {
  const spans = getMeasureSpans(song);
  return (
    spans.find((span) => beat >= span.startBeat && beat < span.endBeat)?.number ??
    spans.at(-1)?.number ??
    1
  );
}

export function cloneSong(song: SongModel): SongModel {
  return {
    ...song,
    timeSignature: { ...song.timeSignature },
    source: {
      ...song.source,
      notes: [...song.source.notes],
    },
    measures: song.measures.map((measure) => ({
      ...measure,
      events: measure.events.map((event) => ({ ...event })),
    })),
  };
}

export function relayoutEvents(
  measure: MeasureModel,
  events: ScoreEvent[],
): MeasureModel {
  let cursor = 0;
  const nextEvents = events.map((event) => {
    const nextEvent = {
      ...event,
      offsetBeats: cursor,
    };
    cursor += event.durationBeats;
    return nextEvent;
  });

  return {
    ...measure,
    events: nextEvents,
  };
}

export function averageRecognitionConfidence(song: SongModel): number {
  const events = song.measures.flatMap((measure) => measure.events);
  if (events.length === 0) return 0;
  return events.reduce((sum, event) => sum + event.confidence, 0) / events.length;
}

export function getLowConfidenceEvents(
  song: SongModel,
  threshold = 0.8,
): ScoreEvent[] {
  return song.measures
    .flatMap((measure) => measure.events)
    .filter((event) => event.confidence < threshold);
}

export function validateSong(song: SongModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const measure of song.measures) {
    for (const event of measure.events) {
      if (event.durationBeats <= 0) {
        issues.push({
          level: "error",
          message: "音符时值必须大于 0。",
          measureNumber: measure.number,
          eventId: event.id,
        });
      }
      if (event.offsetBeats + event.durationBeats > measure.durationBeats + 0.0001) {
        issues.push({
          level: "error",
          message: `第 ${measure.number} 小节的音符超出小节长度。`,
          measureNumber: measure.number,
          eventId: event.id,
        });
      }
      if (event.midi !== null && (event.midi < 21 || event.midi > 108)) {
        issues.push({
          level: "error",
          message: "音高超出标准钢琴范围。",
          measureNumber: measure.number,
          eventId: event.id,
        });
      }
    }

    const occupied = measure.events.reduce(
      (end, event) => Math.max(end, event.offsetBeats + event.durationBeats),
      0,
    );
    if (occupied < measure.durationBeats - 0.0001) {
      issues.push({
        level: "warning",
        message: `第 ${measure.number} 小节末尾有 ${(
          measure.durationBeats - occupied
        ).toFixed(2)} 拍空白，将按休止处理。`,
        measureNumber: measure.number,
      });
    }
  }

  return issues;
}
