import type {
  MeasureModel,
  MeasureSpan,
  PerformanceEvent,
  ScoreEvent,
  SongModel,
  ValidationIssue,
} from "../types";
import { degreeToMidi } from "./theory";

export const REVIEW_CONFIDENCE_THRESHOLD = 0.9;

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

export function getScoreEventStartBeat(
  song: SongModel,
  eventId: string,
): number | null {
  const spans = getMeasureSpans(song);
  for (
    let measureIndex = 0;
    measureIndex < song.measures.length;
    measureIndex += 1
  ) {
    const event = song.measures[measureIndex].events.find(
      (candidate) => candidate.id === eventId,
    );
    if (event) return spans[measureIndex].startBeat + event.offsetBeats;
  }
  return null;
}

export function cloneSong(song: SongModel): SongModel {
  return {
    ...song,
    timeSignature: { ...song.timeSignature },
    source: {
      ...song.source,
      imagePaths: song.source.imagePaths
        ? [...song.source.imagePaths]
        : undefined,
      layoutSystems: song.source.layoutSystems?.map((system) => [...system]),
      pageBreakBeforeSystem: song.source.pageBreakBeforeSystem
        ? [...song.source.pageBreakBeforeSystem]
        : undefined,
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
  threshold = REVIEW_CONFIDENCE_THRESHOLD,
): ScoreEvent[] {
  return song.measures
    .flatMap((measure) => measure.events)
    .filter((event) => event.confidence < threshold);
}

export function confirmAllScoreEvents(song: SongModel): SongModel {
  return {
    ...song,
    measures: song.measures.map((measure) => ({
      ...measure,
      events: measure.events.map((event) => ({
        ...event,
        confidence: 1,
      })),
    })),
  };
}

export function mergeTiedPerformanceEvents(
  events: PerformanceEvent[],
): PerformanceEvent[] {
  const merged: PerformanceEvent[] = [];
  const latestByVoiceAndPitch = new Map<string, number>();
  for (const event of [...events].sort(
    (left, right) =>
      left.startBeat - right.startBeat ||
      left.hand.localeCompare(right.hand) ||
      left.midi - right.midi,
  )) {
    const key = `${event.hand}:${event.voice}:${event.midi}`;
    const previousIndex = latestByVoiceAndPitch.get(key);
    const previous =
      previousIndex === undefined ? undefined : merged[previousIndex];
    if (
      previous?.tieToNext &&
      Math.abs(
        previous.startBeat + previous.durationBeats - event.startBeat,
      ) < 0.0001
    ) {
      previous.durationBeats =
        event.startBeat + event.durationBeats - previous.startBeat;
      previous.tieToNext = event.tieToNext;
      continue;
    }
    merged.push({ ...event });
    latestByVoiceAndPitch.set(key, merged.length - 1);
  }
  return merged;
}

export function validateSong(song: SongModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const measureNumbers = new Set<number>();
  const eventIds = new Set<string>();

  if (!Number.isFinite(song.tempo) || song.tempo <= 0) {
    issues.push({
      level: "error",
      message: "速度必须是大于 0 的有限数值。",
    });
  }
  if (
    !Number.isInteger(song.timeSignature.beats) ||
    song.timeSignature.beats <= 0 ||
    !Number.isInteger(song.timeSignature.beatType) ||
    song.timeSignature.beatType <= 0 ||
    (song.timeSignature.beatType & (song.timeSignature.beatType - 1)) !== 0
  ) {
    issues.push({
      level: "error",
      message: "拍号必须使用有效的正整数拍数和 2 的幂次拍值。",
    });
  }

  for (const measure of song.measures) {
    if (measureNumbers.has(measure.number)) {
      issues.push({
        level: "error",
        message: `第 ${measure.number} 小节编号重复。`,
        measureNumber: measure.number,
      });
    }
    measureNumbers.add(measure.number);

    if (!Number.isFinite(measure.durationBeats) || measure.durationBeats <= 0) {
      issues.push({
        level: "error",
        message: `第 ${measure.number} 小节长度必须是大于 0 的有限数值。`,
        measureNumber: measure.number,
      });
    }

    const sortedEvents = [...measure.events].sort(
      (left, right) => left.offsetBeats - right.offsetBeats,
    );
    let previousEnd = 0;

    for (const event of sortedEvents) {
      if (eventIds.has(event.id)) {
        issues.push({
          level: "error",
          message: `音符标识 ${event.id} 重复。`,
          measureNumber: measure.number,
          eventId: event.id,
        });
      }
      eventIds.add(event.id);

      if (
        !Number.isFinite(event.offsetBeats) ||
        event.offsetBeats < 0
      ) {
        issues.push({
          level: "error",
          message: "音符起始位置必须是非负有限数值。",
          measureNumber: measure.number,
          eventId: event.id,
        });
      }
      if (!Number.isFinite(event.durationBeats) || event.durationBeats <= 0) {
        issues.push({
          level: "error",
          message: "音符时值必须是大于 0 的有限数值。",
          measureNumber: measure.number,
          eventId: event.id,
        });
      }
      if (
        Number.isFinite(event.offsetBeats) &&
        Number.isFinite(event.durationBeats) &&
        event.offsetBeats + event.durationBeats >
          measure.durationBeats + 0.0001
      ) {
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
      if (event.sourcePitchToken !== undefined) {
        if (!/^[1-7][',]*$/.test(event.sourcePitchToken)) {
          issues.push({
            level: "error",
            message: `无法解析原始简谱音符 ${event.sourcePitchToken}。`,
            measureNumber: measure.number,
            eventId: event.id,
          });
        } else if (
          event.midi !== degreeToMidi(event.sourcePitchToken, song.tonicMidi)
        ) {
          issues.push({
            level: "error",
            message: `音符 ${event.sourcePitchToken} 与实际播放音高不一致。`,
            measureNumber: measure.number,
            eventId: event.id,
          });
        }
      }
      if (
        event.midi !== null &&
        (!Number.isInteger(event.midi) ||
          (event.finger !== undefined &&
            (!Number.isInteger(event.finger) ||
              event.finger < 1 ||
              event.finger > 5)))
      ) {
        issues.push({
          level: "error",
          message: "音高必须是整数，指法必须是 1 到 5 的整数。",
          measureNumber: measure.number,
          eventId: event.id,
        });
      }
      if (event.tieToNext && event.slurToNext) {
        issues.push({
          level: "error",
          message: "同一音符不能同时标记延音线和圆滑线。",
          measureNumber: measure.number,
          eventId: event.id,
        });
      }
      if (
        !Number.isFinite(event.confidence) ||
        event.confidence < 0 ||
        event.confidence > 1
      ) {
        issues.push({
          level: "error",
          message: "识别置信度必须位于 0 到 1 之间。",
          measureNumber: measure.number,
          eventId: event.id,
        });
      }
      if (
        Number.isFinite(event.offsetBeats) &&
        event.offsetBeats < previousEnd - 0.0001
      ) {
        issues.push({
          level: "error",
          message: `第 ${measure.number} 小节存在重叠音符；当前模型只接受单声部简谱。`,
          measureNumber: measure.number,
          eventId: event.id,
        });
      }
      if (
        Number.isFinite(event.offsetBeats) &&
        Number.isFinite(event.durationBeats)
      ) {
        previousEnd = Math.max(
          previousEnd,
          event.offsetBeats + event.durationBeats,
        );
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

  const orderedEvents = song.measures.flatMap((measure, measureIndex) =>
    measure.events.map((event) => ({
      event,
      measureNumber: measure.number,
      startBeat:
        song.measures
          .slice(0, measureIndex)
          .reduce((sum, item) => sum + item.durationBeats, 0) +
        event.offsetBeats,
    })),
  );
  orderedEvents.forEach(({ event, measureNumber, startBeat }, index) => {
    const next = orderedEvents[index + 1];
    const isContiguous =
      next &&
      Math.abs(startBeat + event.durationBeats - next.startBeat) <= 0.0001;
    if (
      event.tieToNext &&
      (event.midi === null ||
        !next ||
        next.event.midi !== event.midi ||
        !isContiguous)
    ) {
      issues.push({
        level: "error",
        message: `第 ${measureNumber} 小节的连音必须连接到紧邻的同音高音符。`,
        measureNumber,
        eventId: event.id,
      });
    }
    if (
      event.slurToNext &&
      (event.midi === null || !next || next.event.midi === null || !isContiguous)
    ) {
      issues.push({
        level: "error",
        message: `第 ${measureNumber} 小节的圆滑线必须连接到紧邻音符。`,
        measureNumber,
        eventId: event.id,
      });
    }
  });

  return issues;
}

export function validatePerformanceTimeline(
  song: SongModel,
  events: PerformanceEvent[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const spans = getMeasureSpans(song);
  const totalBeats = getTotalBeats(song);
  const performanceIds = new Set<string>();
  const rightBySource = new Map<string, PerformanceEvent[]>();

  for (const event of events) {
    if (performanceIds.has(event.id)) {
      issues.push({
        level: "error",
        message: `演奏事件标识 ${event.id} 重复。`,
        measureNumber: event.measureNumber,
      });
    }
    performanceIds.add(event.id);

    if (
      !Number.isFinite(event.startBeat) ||
      !Number.isFinite(event.durationBeats) ||
      event.startBeat < 0 ||
      event.durationBeats <= 0 ||
      event.startBeat + event.durationBeats > totalBeats + 0.0001
    ) {
      issues.push({
        level: "error",
        message: `第 ${event.measureNumber} 小节存在越界或无效的演奏时间。`,
        measureNumber: event.measureNumber,
      });
    }
    if (
      !Number.isInteger(event.midi) ||
      event.midi < 21 ||
      event.midi > 108 ||
      !Number.isInteger(event.finger) ||
      event.finger < 1 ||
      event.finger > 5 ||
      !Number.isFinite(event.velocity) ||
      event.velocity <= 0 ||
      event.velocity > 1
    ) {
      issues.push({
        level: "error",
        message: `第 ${event.measureNumber} 小节存在无效的音高、指法或力度。`,
        measureNumber: event.measureNumber,
      });
    }

    const span = spans.find((item) => item.number === event.measureNumber);
    if (
      !span ||
      event.startBeat < span.startBeat - 0.0001 ||
      event.startBeat + event.durationBeats > span.endBeat + 0.0001
    ) {
      issues.push({
        level: "error",
        message: `演奏事件 ${event.id} 不在对应小节范围内。`,
        measureNumber: event.measureNumber,
      });
    }

    if (event.hand === "right") {
      if (!event.sourceEventId) {
        issues.push({
          level: "error",
          message: `右手演奏事件 ${event.id} 缺少谱面来源。`,
          measureNumber: event.measureNumber,
        });
      } else {
        rightBySource.set(event.sourceEventId, [
          ...(rightBySource.get(event.sourceEventId) ?? []),
          event,
        ]);
      }
    }
  }

  song.measures.forEach((measure, measureIndex) => {
    const span = spans[measureIndex];
    for (const source of measure.events) {
      const derived = rightBySource.get(source.id) ?? [];
      if (source.midi === null) {
        if (derived.length > 0) {
          issues.push({
            level: "error",
            message: `休止事件 ${source.id} 不应生成右手发声事件。`,
            measureNumber: measure.number,
            eventId: source.id,
          });
        }
        continue;
      }
      if (derived.length !== 1) {
        issues.push({
          level: "error",
          message: `谱面事件 ${source.id} 必须且只能生成一个右手演奏事件。`,
          measureNumber: measure.number,
          eventId: source.id,
        });
        continue;
      }
      const event = derived[0];
      if (
        Math.abs(event.startBeat - (span.startBeat + source.offsetBeats)) >
          0.0001 ||
        Math.abs(event.durationBeats - source.durationBeats) > 0.0001 ||
        event.midi !== source.midi ||
        event.finger !== (source.finger ?? 1) ||
        event.measureNumber !== measure.number
      ) {
        issues.push({
          level: "error",
          message: `谱面事件 ${source.id} 与演奏时间线不一致。`,
          measureNumber: measure.number,
          eventId: source.id,
        });
      }
    }
  });

  const sourceIds = new Set(
    song.measures.flatMap((measure) =>
      measure.events.flatMap((event) =>
        event.midi === null ? [] : [event.id],
      ),
    ),
  );
  for (const sourceId of rightBySource.keys()) {
    if (!sourceIds.has(sourceId)) {
      issues.push({
        level: "error",
        message: `演奏时间线引用了不存在的谱面事件 ${sourceId}。`,
      });
    }
  }

  return issues;
}
