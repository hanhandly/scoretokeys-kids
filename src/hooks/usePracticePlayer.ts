import { useCallback, useEffect, useRef, useState } from "react";
import type { MeasureSpan, PerformanceEvent } from "../types";
import { PianoSynth } from "../core/audio";

export type PlayerStatus = "idle" | "playing" | "paused" | "ended";

export interface PracticePlayerOptions {
  events: PerformanceEvent[];
  totalBeats: number;
  tempo: number;
  speed: number;
  rightEnabled: boolean;
  leftEnabled: boolean;
  metronome: boolean;
  measureStarts: number[];
  loopSpan: MeasureSpan | null;
  enabled: boolean;
}

export interface PracticePlayer {
  status: PlayerStatus;
  positionBeat: number;
  error: string | null;
  toggle: () => void;
  pause: () => void;
  stop: () => void;
  seek: (beat: number) => void;
  clearError: () => void;
}

export function usePracticePlayer(options: PracticePlayerOptions): PracticePlayer {
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [positionBeat, setPositionBeat] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const synthRef = useRef<PianoSynth | null>(null);
  const frameRef = useRef<number | null>(null);
  const generationRef = useRef(0);
  const playingRef = useRef(false);
  const positionRef = useRef(0);
  const optionsRef = useRef(options);
  const startAtRef = useRef<(beat: number) => Promise<void>>(async () => undefined);
  optionsRef.current = options;

  const setPosition = useCallback((beat: number) => {
    positionRef.current = beat;
    setPositionBeat(beat);
  }, []);

  const cancelCurrent = useCallback(() => {
    generationRef.current += 1;
    playingRef.current = false;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    synthRef.current?.stop();
  }, []);

  const startAt = useCallback(
    async (requestedBeat: number) => {
      const current = optionsRef.current;
      if (!current.enabled) {
        setError("请先确认识别结果，再开始练习。");
        return;
      }
      if (!current.rightEnabled && !current.leftEnabled && !current.metronome) {
        setError("右手、左手和节拍器均已关闭，没有可播放的声部。");
        return;
      }

      cancelCurrent();
      const generation = generationRef.current;
      const loop = current.loopSpan;
      const lowerBound = loop?.startBeat ?? 0;
      const upperBound = loop?.endBeat ?? current.totalBeats;
      const startBeat =
        requestedBeat >= upperBound || requestedBeat < lowerBound
          ? lowerBound
          : requestedBeat;

      if (!synthRef.current) synthRef.current = new PianoSynth();

      try {
        const playbackClock = await synthRef.current.schedule({
          events: current.events,
          fromBeat: startBeat,
          toBeat: upperBound,
          tempo: current.tempo,
          speed: current.speed,
          rightEnabled: current.rightEnabled,
          leftEnabled: current.leftEnabled,
          metronome: current.metronome,
          measureStarts: current.measureStarts,
        });
        if (generation !== generationRef.current) return;

        setError(null);
        setStatus("playing");
        playingRef.current = true;
        setPosition(startBeat);
        let lastPaint = 0;

        const tick = (now: number) => {
          if (!playingRef.current || generation !== generationRef.current) return;
          const nextPosition = playbackClock.getPositionBeat();

          if (nextPosition >= upperBound - 0.001) {
            setPosition(upperBound);
            if (loop) {
              void startAtRef.current(loop.startBeat);
            } else {
              cancelCurrent();
              setStatus("ended");
            }
            return;
          }

          positionRef.current = nextPosition;
          if (now - lastPaint >= 28) {
            setPositionBeat(nextPosition);
            lastPaint = now;
          }
          frameRef.current = requestAnimationFrame(tick);
        };

        frameRef.current = requestAnimationFrame(tick);
      } catch (cause) {
        cancelCurrent();
        const message =
          cause instanceof Error ? cause.message : "浏览器音频初始化失败。";
        setError(message);
        setStatus("paused");
      }
    },
    [cancelCurrent, setPosition],
  );
  startAtRef.current = startAt;

  const pause = useCallback(() => {
    if (!playingRef.current) return;
    const currentPosition = positionRef.current;
    cancelCurrent();
    setPosition(currentPosition);
    setStatus("paused");
  }, [cancelCurrent, setPosition]);

  const stop = useCallback(() => {
    cancelCurrent();
    setPosition(0);
    setStatus("idle");
  }, [cancelCurrent, setPosition]);

  const toggle = useCallback(() => {
    if (playingRef.current) {
      pause();
      return;
    }
    const current = optionsRef.current;
    const restartAt =
      positionRef.current >= current.totalBeats - 0.001
        ? current.loopSpan?.startBeat ?? 0
        : positionRef.current;
    void startAtRef.current(restartAt);
  }, [pause]);

  const seek = useCallback(
    (beat: number) => {
      const current = optionsRef.current;
      const clamped = Math.max(0, Math.min(current.totalBeats, beat));
      if (playingRef.current) {
        void startAtRef.current(clamped);
      } else {
        setPosition(clamped);
        setStatus(clamped >= current.totalBeats ? "ended" : "paused");
      }
    },
    [setPosition],
  );

  useEffect(() => {
    if (playingRef.current) {
      void startAtRef.current(positionRef.current);
    }
  }, [
    options.events,
    options.tempo,
    options.speed,
    options.rightEnabled,
    options.leftEnabled,
    options.metronome,
    options.measureStarts,
    options.loopSpan,
  ]);

  useEffect(
    () => () => {
      cancelCurrent();
      synthRef.current?.dispose();
      synthRef.current = null;
    },
    [cancelCurrent],
  );

  return {
    status,
    positionBeat,
    error,
    toggle,
    pause,
    stop,
    seek,
    clearError: () => setError(null),
  };
}
