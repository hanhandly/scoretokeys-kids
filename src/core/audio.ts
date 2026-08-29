import type { PerformanceEvent } from "../types";
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
  getPositionBeat: () => number;
}

export interface AudioOutputClock {
  currentTime: number;
  baseLatency: number;
  outputLatency?: number;
  getOutputTimestamp?: () => AudioTimestamp;
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

  const outputLatency = context.outputLatency ?? 0;
  const latency =
    Number.isFinite(outputLatency) && outputLatency > 0
      ? outputLatency
      : Math.max(0, context.baseLatency);
  return Math.max(0, context.currentTime - latency);
}

export class PianoSynth {
  private context: AudioContext | null = null;
  private activeOscillators = new Set<OscillatorNode>();

  private getContext(): AudioContext {
    if (this.context?.state === "closed") this.context = null;
    if (!this.context) {
      const Context = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
      if (!Context) {
        throw new Error("当前浏览器不支持 Web Audio，无法播放声音。");
      }
      this.context = new Context();
    }
    return this.context;
  }

  async schedule(schedule: AudioSchedule): Promise<AudioPlaybackClock> {
    this.stop();
    const context = this.getContext();
    await context.resume();

    const delaySeconds = 0.05;
    const baseTime = context.currentTime + delaySeconds;
    const secondsPerBeat = 60 / schedule.tempo / schedule.speed;
    const audibleEvents = schedule.events.filter(
      (event) =>
        (event.hand === "right" ? schedule.rightEnabled : schedule.leftEnabled) &&
        event.startBeat < schedule.toBeat &&
        event.startBeat + event.durationBeats > schedule.fromBeat,
    );

    for (const event of audibleEvents) {
      const clippedStartBeat = Math.max(event.startBeat, schedule.fromBeat);
      const clippedEndBeat = Math.min(
        event.startBeat + event.durationBeats,
        schedule.toBeat,
      );
      const startTime =
        baseTime + (clippedStartBeat - schedule.fromBeat) * secondsPerBeat;
      const durationSeconds = Math.max(
        0.04,
        (clippedEndBeat - clippedStartBeat) * secondsPerBeat,
      );
      this.schedulePianoTone(
        context,
        event.midi,
        startTime,
        durationSeconds,
        event.velocity,
        event.hand === "right" ? 0.03 : -0.18,
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

    return {
      getPositionBeat: () => {
        const audibleTime = getAudibleContextTime(context);
        const position =
          schedule.fromBeat +
          Math.max(0, audibleTime - baseTime) / secondsPerBeat;
        return Math.min(schedule.toBeat, position);
      },
    };
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

    const attackEnd = startTime + 0.012;
    const releaseStart = Math.max(attackEnd, startTime + durationSeconds - 0.1);
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
      startTime + durationSeconds + 0.08,
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
      oscillator.stop(startTime + durationSeconds + 0.1);
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
    for (const oscillator of this.activeOscillators) {
      oscillator.stop();
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
