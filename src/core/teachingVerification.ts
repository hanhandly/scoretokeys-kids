import type { PerformanceEvent, SongModel } from "../types";
import { buildAudioEventWindows } from "./audio";
import {
  getMeasureSpans,
  validatePerformanceTimeline,
  validateSong,
} from "./model";
import { getActivePerformanceEvents } from "./transport";

export interface TeachingVerificationReport {
  checkedMeasures: number;
  checkedScoreEvents: number;
  checkedAudioWindows: number;
}

function assertValid(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function verifyTeachingMaterialOpening(
  song: SongModel,
  timeline: PerformanceEvent[],
  measureCount = 4,
): TeachingVerificationReport {
  const scoreError = validateSong(song).find((issue) => issue.level === "error");
  if (scoreError) throw new Error(scoreError.message);

  const timelineError = validatePerformanceTimeline(song, timeline).find(
    (issue) => issue.level === "error",
  );
  if (timelineError) throw new Error(timelineError.message);

  const openingMeasures = song.measures.slice(
    0,
    Math.min(measureCount, song.measures.length),
  );
  assertValid(openingMeasures.length > 0, "教学谱没有可检查的小节。");
  const spans = getMeasureSpans(song);
  const openingEndBeat = spans[openingMeasures.length - 1].endBeat;
  const openingScoreEvents = openingMeasures.flatMap((measure) =>
    measure.events.map((event) => ({ event, measure })),
  );
  const audioWindows = buildAudioEventWindows({
    events: timeline,
    fromBeat: 0,
    toBeat: openingEndBeat,
    tempo: song.tempo,
    speed: 1,
    rightEnabled: true,
    leftEnabled: true,
    metronome: false,
    measureStarts: spans.map((span) => span.startBeat),
  });

  for (const { event, measure } of openingScoreEvents) {
    const span = spans.find((candidate) => candidate.number === measure.number);
    assertValid(span, `找不到第 ${measure.number} 小节的时间范围。`);
    const expectedStart = span.startBeat + event.offsetBeats;
    const rightEvents = timeline.filter(
      (candidate) =>
        candidate.hand === "right" && candidate.sourceEventId === event.id,
    );

    if (event.midi === null) {
      assertValid(
        rightEvents.length === 0,
        `休止符 ${event.id} 被错误转换为右手声音。`,
      );
      continue;
    }

    assertValid(
      rightEvents.length === 1,
      `音符 ${event.id} 没有唯一对应的右手演奏事件。`,
    );
    const performanceEvent = rightEvents[0];
    assertValid(
      Math.abs(performanceEvent.startBeat - expectedStart) < 0.0001,
      `音符 ${event.id} 的谱面与演奏起点不一致。`,
    );
    assertValid(
      performanceEvent.midi === event.midi &&
        Math.abs(performanceEvent.durationBeats - event.durationBeats) < 0.0001,
      `音符 ${event.id} 的音高或时值与演奏事件不一致。`,
    );

    const sampleBeat =
      performanceEvent.startBeat +
      Math.min(0.001, performanceEvent.durationBeats / 2);
    const activeEvents = getActivePerformanceEvents(timeline, sampleBeat, {
      right: true,
      left: true,
    });
    assertValid(
      activeEvents.some((candidate) => candidate.id === performanceEvent.id),
      `音符 ${event.id} 无法驱动键盘和谱面动画。`,
    );
    assertValid(
      audioWindows.some(
        (window) =>
          window.event.hand === "right" &&
          window.event.midi === event.midi &&
          sampleBeat >= window.startBeat &&
          sampleBeat < window.endBeat,
      ),
      `音符 ${event.id} 不在实际音频排程窗口中。`,
    );
  }

  return {
    checkedMeasures: openingMeasures.length,
    checkedScoreEvents: openingScoreEvents.length,
    checkedAudioWindows: audioWindows.length,
  };
}
