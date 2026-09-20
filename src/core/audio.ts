import type { PerformanceEvent } from "../types";
import { mergeTiedPerformanceEvents } from "./model";
import { getSecondsPerBeat } from "./tempo";
import { midiToFrequency } from "./theory";

interface AudioWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

export interface AudioSchedule {
  events: PerformanceEvent[];
  fromBeat: number;
  toBeat: number;
  tempo: number;
  speed: number;
  rightEnabled: boolean;
  leftEnabled: boolean;
  metronome: boolean;
  measureStarts: number[];
}

export interface AudioPlaybackClock {
  sample: () => AudioPlaybackSnapshot;
  getPositionBeat: () => number;
}

export interface AudioPlaybackSnapshot {
  positionBeat: number;
  outputStarted: boolean;
}

export interface AudioOutputClock {
  currentTime: number;
  baseLatency: number;
  outputLatency?: number;
  getOutputTimestamp?: () => AudioTimestamp;
}

export interface AudioEventWindow {
  event: PerformanceEvent;
  startBeat: number;
  endBeat: number;
  startOffsetSeconds: number;
  durationSeconds: number;
}

export function buildAudioEventWindows(
  schedule: AudioSchedule,
): AudioEventWindow[] {
  const secondsPerBeat = getSecondsPerBeat(schedule.tempo, schedule.speed);
  return mergeTiedPerformanceEvents(
    schedule.events.filter(
      (event) =>
        (event.hand === "right"
          ? schedule.rightEnabled
          : schedule.leftEnabled) &&
        event.startBeat < schedule.toBeat &&
        event.startBeat + event.durationBeats > schedule.fromBeat,
    ),
  ).flatMap((event) => {
    const startBeat = Math.max(event.startBeat, schedule.fromBeat);
    const endBeat = Math.min(
      event.startBeat + event.durationBeats,
      schedule.toBeat,
    );
    const durationSeconds = (endBeat - startBeat) * secondsPerBeat;
    return durationSeconds < 0.003
      ? []
      : [
          {
            event,
            startBeat,
            endBeat,
            startOffsetSeconds:
              (startBeat - schedule.fromBeat) * secondsPerBeat,
            durationSeconds,
          },
        ];
  });
}

export function getToneEnvelopeTimes(
  startTime: number,
  durationSeconds: number,
): { attackEnd: number; releaseStart: number; endTime: number } {
  const endTime = startTime + durationSeconds;
  const attackEnd = Math.min(endTime, startTime + 0.004);
  const releaseWindow = Math.min(0.045, durationSeconds * 0.35);
  return {
    attackEnd,
    releaseStart: Math.max(attackEnd, endTime - releaseWindow),
    endTime,
  };
}

export function getAudibleContextTime(
  context: AudioOutputClock,
  performanceTime = performance.now(),
): number {
  if (typeof context.getOutputTimestamp === "function") {
    const timestamp = context.getOutputTimestamp();
    const contextTime = timestamp.contextTime;
    const outputPerformanceTime = timestamp.performanceTime;
    if (
      typeof contextTime === "number" &&
      typeof outputPerformanceTime === "number" &&
      outputPerformanceTime > 0 &&
      Number.isFinite(contextTime) &&
      Number.isFinite(outputPerformanceTime)
    ) {
      const elapsed = (performanceTime - outputPerformanceTime) / 1000;
      if (Number.isFinite(elapsed) && Math.abs(elapsed) <= 1) {
        return Math.max(0, contextTime + elapsed);
      }
    }
  }

  const outputLatency =
    Number.isFinite(context.outputLatency) && (context.outputLatency ?? 0) > 0
      ? context.outputLatency ?? 0
      : 0;
  const baseLatency =
    Number.isFinite(context.baseLatency) && context.baseLatency > 0
      ? context.baseLatency
      : 0;
  const latency = outputLatency || baseLatency;
  return Math.max(0, context.currentTime - latency);
}

export function createAudioPlaybackClock(
  context: AudioOutputClock,
  startTime: number,
  fromBeat: number,
  toBeat: number,
  secondsPerBeat: number,
): AudioPlaybackClock {
  const sample = (): AudioPlaybackSnapshot => {
    const outputTime = getAudibleContextTime(context);
    const position =
      fromBeat + Math.max(0, outputTime - startTime) / secondsPerBeat;
    return {
      positionBeat: Math.min(toBeat, position),
      outputStarted: outputTime >= startTime,
    };
  };
  return {
    sample,
    getPositionBeat: () => sample().positionBeat,
  };
}

export class PianoSynth {
  private context: AudioContext | null = null;
  private activeOscillators = new Set<OscillatorNode>();
  private scheduleGeneration = 0;

  constructor(
    private readonly contextFactory?: () => AudioContext,
  ) {}

  private getContext(): AudioContext {
    if (this.context?.state === "closed") this.context = null;
    if (!this.context) {
      if (this.contextFactory) {
        this.context = this.contextFactory();
        return this.context;
      }
      const Context = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
      if (!Context) {
        throw new Error("当前浏览器不支持 Web Audio，无法播放声音。");
      }
      this.context = new Context();
    }
    return this.context;
  }

  async prepare(): Promise<void> {
    const context = this.getContext();
    await context.resume();
    if (this.context !== context || context.state !== "running") {
      throw new Error("AUDIO_DEVICE_NOT_READY");
    }
  }

  async schedule(schedule: AudioSchedule): Promise<AudioPlaybackClock> {
    const generation = ++this.scheduleGeneration;
    this.stopActiveOscillators();
    await this.prepare();
    if (generation !== this.scheduleGeneration) {
      return {
        sample: () => ({
          positionBeat: schedule.fromBeat,
          outputStarted: false,
        }),
        getPositionBeat: () => schedule.fromBeat,
      };
    }
    const context = this.getContext();

    const delaySeconds = 0.05;
    const baseTime = context.currentTime + delaySeconds;
    const secondsPerBeat = getSecondsPerBeat(schedule.tempo, schedule.speed);
    const audioWindows = buildAudioEventWindows(schedule);

    for (const window of audioWindows) {
      this.schedulePianoTone(
        context,
        window.event.midi,
        baseTime + window.startOffsetSeconds,
        window.durationSeconds,
        window.event.velocity,
        window.event.hand === "right" ? 0.03 : -0.18,
      );
    }

    if (schedule.metronome) {
      for (
        let beat = Math.ceil(schedule.fromBeat);
        beat < schedule.toBeat;
        beat += 1
      ) {
        const startTime = baseTime + (beat - schedule.fromBeat) * secondsPerBeat;
        const accent = schedule.measureStarts.some(
          (measureStart) => Math.abs(measureStart - beat) < 0.001,
        );
        this.scheduleClick(context, startTime, accent);
      }
    }

    return createAudioPlaybackClock(
      context,
      baseTime,
      schedule.fromBeat,
      schedule.toBeat,
      secondsPerBeat,
    );
  }

  private schedulePianoTone(
    context: AudioContext,
    midi: number,
    startTime: number,
    durationSeconds: number,
    velocity: number,
    pan: number,
  ): void {
    const frequency = midiToFrequency(midi);
    const output = context.createGain();
    const panner = context.createStereoPanner();
    panner.pan.value = pan;
    output.connect(panner).connect(context.destination);

    const { attackEnd, releaseStart, endTime } = getToneEnvelopeTimes(
      startTime,
      durationSeconds,
    );
    output.gain.setValueAtTime(0.0001, startTime);
    output.gain.exponentialRampToValueAtTime(
      Math.max(0.015, velocity * 0.22),
      attackEnd,
    );
    output.gain.exponentialRampToValueAtTime(
      Math.max(0.004, velocity * 0.07),
      releaseStart,
    );
    output.gain.exponentialRampToValueAtTime(
      0.0001,
      endTime,
    );

    const partials = [
      { ratio: 1, type: "triangle" as OscillatorType, gain: 1 },
      { ratio: 2, type: "sine" as OscillatorType, gain: 0.22 },
      { ratio: 3, type: "sine" as OscillatorType, gain: 0.07 },
    ];

    partials.forEach((partial) => {
      const oscillator = context.createOscillator();
      const partialGain = context.createGain();
      oscillator.type = partial.type;
      oscillator.frequency.value = frequency * partial.ratio;
      partialGain.gain.value = partial.gain;
      oscillator.connect(partialGain).connect(output);
      oscillator.start(startTime);
      oscillator.stop(endTime + 0.01);
      this.activeOscillators.add(oscillator);
      oscillator.addEventListener(
        "ended",
        () => this.activeOscillators.delete(oscillator),
        { once: true },
      );
    });
  }

  private scheduleClick(
    context: AudioContext,
    startTime: number,
    accent: boolean,
  ): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "square";
    oscillator.frequency.value = accent ? 1320 : 920;
    gain.gain.setValueAtTime(accent ? 0.12 : 0.065, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.045);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.05);
    this.activeOscillators.add(oscillator);
    oscillator.addEventListener(
      "ended",
      () => this.activeOscillators.delete(oscillator),
      { once: true },
    );
  }

  stop(): void {
    this.scheduleGeneration += 1;
    this.stopActiveOscillators();
  }

  private stopActiveOscillators(): void {
    for (const oscillator of this.activeOscillators) {
      try {
        oscillator.stop();
      } catch {
        // An oscillator may already have reached its scheduled stop time.
      }
    }
    this.activeOscillators.clear();
  }

  dispose(): void {
    this.stop();
    if (this.context && this.context.state !== "closed") {
      void this.context.close();
    }
    this.context = null;
  }
}
