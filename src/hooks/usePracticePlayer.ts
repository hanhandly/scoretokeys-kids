import { useCallback, useEffect, useRef, useState } from "react";
import type { MeasureSpan, PerformanceEvent } from "../types";
import { PianoSynth } from "../core/audio";
import type { AudioPlaybackClock } from "../core/audio";
import { useI18n } from "../i18n/I18nProvider";

export type PlayerStatus = "idle" | "starting" | "playing" | "paused" | "ended";

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
  playFrom: (beat: number) => void;
  restart: () => void;
  prepare: () => Promise<void>;
  clearError: () => void;
}

export function usePracticePlayer(options: PracticePlayerOptions): PracticePlayer {
  const { localizeError } = useI18n();
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [positionBeat, setPositionBeat] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const synthRef = useRef<PianoSynth | null>(null);
  const frameRef = useRef<number | null>(null);
  const generationRef = useRef(0);
  const playingRef = useRef(false);
  const startingRef = useRef(false);
  const positionRef = useRef(0);
  const clockRef = useRef<AudioPlaybackClock | null>(null);
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
    startingRef.current = false;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    synthRef.current?.stop();
    clockRef.current = null;
  }, []);

  const startAt = useCallback(
    async (requestedBeat: number) => {
      const current = optionsRef.current;
      if (!current.enabled) {
        setError("PLAYER_CONFIRM_REQUIRED");
        return;
      }
      if (!current.rightEnabled && !current.leftEnabled && !current.metronome) {
        setError("PLAYER_NO_OUTPUT");
        return;
      }

      cancelCurrent();
      const generation = generationRef.current;
      startingRef.current = true;
      setStatus("starting");
      const loop = current.loopSpan;
      const lowerBound = loop?.startBeat ?? 0;
      const upperBound = loop?.endBeat ?? current.totalBeats;
      const startBeat =
        requestedBeat >= upperBound || requestedBeat < lowerBound
          ? lowerBound
          : requestedBeat;
      setPosition(startBeat);

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
        clockRef.current = playbackClock;
        let lastPaint = 0;
        const tick = (now: number) => {
          if (
            (!playingRef.current && !startingRef.current) ||
            generation !== generationRef.current
          ) return;
          const snapshot = playbackClock.sample();
          const firstOutputFrame = startingRef.current;
          if (firstOutputFrame) {
            if (!snapshot.outputStarted) {
              frameRef.current = requestAnimationFrame(tick);
              return;
            }
            startingRef.current = false;
            playingRef.current = true;
            setStatus("playing");
          }
          const nextPosition = snapshot.positionBeat;

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
          if (firstOutputFrame || now - lastPaint >= 28) {
            setPositionBeat(nextPosition);
            lastPaint = now;
          }
          frameRef.current = requestAnimationFrame(tick);
        };

        frameRef.current = requestAnimationFrame(tick);
      } catch (cause) {
        if (generation !== generationRef.current) return;
        cancelCurrent();
        const message =
          cause instanceof Error ? cause.message : "AUDIO_INIT_FAILED";
        setError(message);
        setStatus("paused");
      }
    },
    [cancelCurrent, setPosition],
  );
  startAtRef.current = startAt;

  const pause = useCallback(() => {
    if (!playingRef.current && !startingRef.current) return;
    const currentPosition =
      clockRef.current?.getPositionBeat() ?? positionRef.current;
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
    if (playingRef.current || startingRef.current) {
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
      if (clamped >= current.totalBeats - 0.0001) {
        cancelCurrent();
        setPosition(current.totalBeats);
        setStatus("ended");
        return;
      }
      if (playingRef.current || startingRef.current) {
        void startAtRef.current(clamped);
      } else {
        setPosition(clamped);
        setStatus(clamped >= current.totalBeats ? "ended" : "paused");
      }
    },
    [cancelCurrent, setPosition],
  );

  const playFrom = useCallback((beat: number) => {
    const current = optionsRef.current;
    const clamped = Math.max(0, Math.min(current.totalBeats, beat));
    void startAtRef.current(clamped);
  }, []);

  const restart = useCallback(() => {
    void startAtRef.current(0);
  }, []);

  const prepare = useCallback(async () => {
    if (!synthRef.current) synthRef.current = new PianoSynth();
    try {
      return await synthRef.current.prepare();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "AUDIO_INIT_FAILED";
      setError(message);
      throw cause;
    }
  }, []);

  useEffect(() => {
    if (playingRef.current || startingRef.current) {
      const currentPosition =
        clockRef.current?.getPositionBeat() ?? positionRef.current;
      void startAtRef.current(currentPosition);
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
    error: error ? localizeError(error) : null,
    toggle,
    pause,
    stop,
    seek,
    playFrom,
    restart,
    prepare,
    clearError: () => setError(null),
  };
}
