import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPerformanceTimeline,
  harmonize,
  recommendFingering,
} from "./arrangement";
import {
  buildAudioEventWindows,
  createAudioPlaybackClock,
  getAudibleContextTime,
  getToneEnvelopeTimes,
  PianoSynth,
} from "./audio";
import {
  createMidiFile,
  createMusicXml,
  createTimelineJson,
} from "./exporters";
import {
  cloneSong,
  confirmAllScoreEvents,
  getMeasureSpans,
  getLowConfidenceEvents,
  getScoreEventStartBeat,
  getTotalBeats,
  groupMeasuresIntoSystems,
  mergeTiedPerformanceEvents,
  relayoutEvents,
  validatePerformanceTimeline,
  validateSong,
} from "./model";
import { beatsToSeconds, secondsToBeats } from "./tempo";
import { verifyTeachingMaterialOpening } from "./teachingVerification";
import { getActivePerformanceEvents } from "./transport";
import {
  keyPrefersFlats,
  pitchNameToMidi,
  positiveModulo,
} from "./theory";
import { SAMPLE_SONGS } from "../data/samples";
import { calculateFollowScroll } from "../layout/followScroll";

describe("normalized score model", () => {
  it("bulk-confirms every score event without mutating the review source", () => {
    const source = cloneSong(SAMPLE_SONGS[1]);
    source.measures[0].events[0].confidence = 0.4;
    const confirmed = confirmAllScoreEvents(source);

    assert.equal(source.measures[0].events[0].confidence, 0.4);
    assert.ok(
      confirmed.measures
        .flatMap((measure) => measure.events)
        .every((event) => event.confidence === 1),
    );
  });

  it("lays measures onto one continuous beat timeline", () => {
    const song = SAMPLE_SONGS[0];
    const spans = getMeasureSpans(song);

    assert.deepEqual(spans[0], { number: 0, startBeat: 0, endBeat: 1 });
    assert.deepEqual(spans[1], { number: 1, startBeat: 1, endBeat: 5 });
    assert.equal(spans.at(-1)?.endBeat, 33);
    assert.deepEqual(
      validateSong(song).filter((issue) => issue.level === "error"),
      [],
    );
  });

  it("preserves an overfull edit and reports it instead of deleting notes", () => {
    const measure = cloneSong(SAMPLE_SONGS[0]).measures[1];
    const editedEvents = measure.events.map((event, index) =>
      index === 0 ? { ...event, durationBeats: 4 } : event,
    );
    const editedMeasure = relayoutEvents(measure, editedEvents);
    const editedSong = {
      ...cloneSong(SAMPLE_SONGS[0]),
      measures: [editedMeasure],
    };

    assert.equal(editedMeasure.events.length, measure.events.length);
    assert.ok(
      validateSong(editedSong).some((issue) => issue.level === "error"),
    );
  });

  it("groups four numbered measures per score system and keeps pickup compact", () => {
    const englishSystems = groupMeasuresIntoSystems(SAMPLE_SONGS[0].measures);
    const chineseSystems = groupMeasuresIntoSystems(SAMPLE_SONGS[1].measures);

    assert.deepEqual(
      englishSystems.map((system) => system.map((measure) => measure.number)),
      [
        [0, 1, 2, 3, 4],
        [5, 6, 7, 8],
      ],
    );
    assert.equal(chineseSystems.length, 9);
    assert.deepEqual(
      chineseSystems.at(-1)?.map((measure) => measure.number),
      [33, 34, 35],
    );
  });

  it("contains complete, rhythmically valid sample transcriptions", () => {
    const english = SAMPLE_SONGS[0];
    const chinese = SAMPLE_SONGS[1];

    assert.equal(english.measures.length, 9);
    assert.equal(chinese.measures.length, 35);
    assert.equal(chinese.tonicMidi, pitchNameToMidi("Bb3"));
    assert.equal(chinese.key, "Bb");
    assert.equal(chinese.tempo, 118);
    assert.deepEqual(
      chinese.measures
        .slice(0, 2)
        .flatMap((measure) => measure.events.map((event) => event.midi)),
      [
        pitchNameToMidi("F4"),
        pitchNameToMidi("Bb4"),
        pitchNameToMidi("Bb4"),
        pitchNameToMidi("F4"),
        pitchNameToMidi("G4"),
        pitchNameToMidi("G4"),
        pitchNameToMidi("F4"),
      ],
    );
    assert.deepEqual(
      chinese.measures[2].events.slice(4).map((event) => event.sourcePitchToken),
      ["1", "3"],
    );
    assert.equal(chinese.measures[3].events[0].sourcePitchToken, "2");
    assert.equal(
      chinese.measures[2].events[5].midi,
      pitchNameToMidi("D4"),
    );
    assert.equal(chinese.measures[3].events[0].midi, pitchNameToMidi("C4"));
    assert.deepEqual(
      [1, 3, 5, 7, 9, 11, 20].map((measureNumber) => ({
        measureNumber,
        slurs: chinese.measures[measureNumber - 1].events
          .map((event, index) => (event.slurToNext ? index + 1 : null))
          .filter((index) => index !== null),
      })),
      [
        { measureNumber: 1, slurs: [3] },
        { measureNumber: 3, slurs: [1, 3] },
        { measureNumber: 5, slurs: [2] },
        { measureNumber: 7, slurs: [1, 3] },
        { measureNumber: 9, slurs: [3] },
        { measureNumber: 11, slurs: [3] },
        { measureNumber: 20, slurs: [1, 3, 5] },
      ],
    );
    assert.deepEqual(
      [5, 13, 15, 16, 19, 34].map((measureNumber) =>
        chinese.measures[measureNumber - 1].events.map(
          (event) => event.durationBeats,
        ),
      ),
      [
        [0.5, 1, 0.5],
        [0.5, 0.25, 0.25, 0.5, 0.25, 0.25],
        [0.5, 0.25, 0.25, 1],
        [1, 0.5, 0.5],
        [0.5, 0.25, 0.25, 1],
        [1, 0.5, 0.5],
      ],
    );
    assert.ok(
      getLowConfidenceEvents(chinese).some(
        (event) => event.id === "labor-m3-n6",
      ),
    );
    assert.equal(keyPrefersFlats(english.key), true);
    assert.deepEqual(
      english.measures[3].events.map((event) => event.midi),
      [
        pitchNameToMidi("G4"),
        pitchNameToMidi("G4"),
        pitchNameToMidi("G4"),
        pitchNameToMidi("G4"),
        pitchNameToMidi("G4"),
        pitchNameToMidi("G4"),
        pitchNameToMidi("F4"),
        pitchNameToMidi("G4"),
      ],
    );
    assert.deepEqual(
      english.measures[5].events.slice(4, 6).map((event) => event.midi),
      [pitchNameToMidi("D4"), pitchNameToMidi("D4")],
    );
    assert.deepEqual(
      english.measures[8].events.map((event) => ({
        midi: event.midi,
        durationBeats: event.durationBeats,
      })),
      [
        { midi: pitchNameToMidi("F4"), durationBeats: 3 },
        { midi: null, durationBeats: 1 },
      ],
    );
    assert.deepEqual(
      chinese.measures[19].events.map((event) => event.midi),
      [
        pitchNameToMidi("D4"),
        pitchNameToMidi("Eb4"),
        pitchNameToMidi("F4"),
        pitchNameToMidi("G4"),
        pitchNameToMidi("F4"),
        pitchNameToMidi("D4"),
      ],
    );
    assert.deepEqual(
      chinese.measures[27].events.map((event) => event.midi),
      [
        pitchNameToMidi("D4"),
        pitchNameToMidi("Bb4"),
        pitchNameToMidi("G4"),
        pitchNameToMidi("F4"),
      ],
    );

    for (const sample of SAMPLE_SONGS) {
      assert.deepEqual(
        validateSong(sample).filter((issue) => issue.level === "error"),
        [],
      );
      for (const measure of sample.measures) {
        const occupied = measure.events.reduce(
          (end, event) =>
            Math.max(end, event.offsetBeats + event.durationBeats),
          0,
        );
        assert.equal(occupied, measure.durationBeats);
      }
    }
  });

  it("rejects non-finite timing, duplicate identity, overlap, and invalid fingers", () => {
    const song = cloneSong(SAMPLE_SONGS[0]);
    song.tempo = Number.NaN;
    song.measures[1].number = song.measures[0].number;
    song.measures[1].events[0].id = song.measures[0].events[0].id;
    song.measures[1].events[0].offsetBeats = -1;
    song.measures[1].events[0].durationBeats = Number.POSITIVE_INFINITY;
    song.measures[1].events[0].finger = 6;
    song.measures[1].events[1].offsetBeats = 0;

    const errors = validateSong(song).filter(
      (issue) => issue.level === "error",
    );
    assert.ok(errors.length >= 6);
  });

  it("rejects a MIDI octave that contradicts the source jianpu token", () => {
    const song = cloneSong(SAMPLE_SONGS[1]);
    song.measures[2].events[5].midi! += 12;

    assert.ok(
      validateSong(song).some(
        (issue) =>
          issue.eventId === "labor-m3-n6" &&
          issue.message.includes("与实际播放音高不一致"),
      ),
    );
  });
});

describe("beginner arrangement", () => {
  it("keeps manually locked fingering while recomputing the rest", () => {
    const song = cloneSong(SAMPLE_SONGS[0]);
    const firstNote = song.measures[0].events[0];
    firstNote.finger = 5;
    firstNote.fingerLocked = true;

    const result = recommendFingering(song);
    assert.equal(result.measures[0].events[0].finger, 5);
    assert.equal(result.measures[0].events[0].fingerLocked, true);
    assert.equal(
      result.measures
        .flatMap((measure) => measure.events)
        .filter((event) => event.midi !== null)
        .every((event) => event.finger && event.finger >= 1 && event.finger <= 5),
      true,
    );
  });

  it("creates diatonic harmony and increasingly rich left-hand modes", () => {
    const song = SAMPLE_SONGS[0];
    const harmony = harmonize(song);
    const rootTimeline = buildPerformanceTimeline(song, harmony, "root");
    const rootFifthTimeline = buildPerformanceTimeline(
      song,
      harmony,
      "root-fifth",
    );
    const arpeggioTimeline = buildPerformanceTimeline(song, harmony, "arpeggio");

    assert.equal(harmony.length, 8);
    assert.equal(harmony[0].symbol, "F");
    assert.equal(rootTimeline.filter((event) => event.hand === "left").length, 8);
    assert.ok(arpeggioTimeline.filter((event) => event.hand === "left").length > 8);
    for (const chord of harmony) {
      if (chord.measureNumber === 8) continue;
      const bass = rootFifthTimeline.filter(
        (event) =>
          event.hand === "left" && event.measureNumber === chord.measureNumber,
      );
      assert.deepEqual(
        bass.map((event) => positiveModulo(event.midi, 12)),
        [chord.rootPc, positiveModulo(chord.rootPc + 7, 12)],
      );
      assert.deepEqual(
        bass.map((event) => event.finger),
        [5, 1],
      );
    }
    assert.deepEqual(
      rootFifthTimeline
        .filter((event) => event.hand === "left" && event.measureNumber === 8)
        .map((event) => ({
          midi: event.midi,
          startBeat: event.startBeat,
          durationBeats: event.durationBeats,
        })),
      [
        {
          midi: pitchNameToMidi("F2"),
          startBeat: 29,
          durationBeats: 2,
        },
        {
          midi: pitchNameToMidi("C3"),
          startBeat: 31,
          durationBeats: 1,
        },
      ],
    );
    const sourceDurations = new Map(
      song.measures.flatMap((measure) =>
        measure.events.map((event) => [event.id, event.durationBeats]),
      ),
    );
    assert.equal(
      rootTimeline
        .filter((event) => event.hand === "right")
        .every(
          (event) =>
            event.sourceEventId &&
            event.durationBeats === sourceDurations.get(event.sourceEventId),
        ),
      true,
    );
  });

  it("honors a locked chord override", () => {
    const song = SAMPLE_SONGS[0];
    const harmony = harmonize(song, {
      "1": { symbol: "Bb", locked: true },
    });

    assert.equal(harmony[0].symbol, "Bb");
    assert.equal(harmony[0].locked, true);
  });

  it("rejects a stale locked chord outside the active key palette", () => {
    assert.throws(
      () =>
        harmonize(SAMPLE_SONGS[0], {
          "1": { symbol: "F#", locked: true },
        }),
      /不属于当前调性/,
    );
  });
});

describe("audio and animation clock", () => {
  it("does not move the score vertically for a horizontally unsafe pickup", () => {
    assert.deepEqual(
      calculateFollowScroll(
        { scrollTop: 0, scrollLeft: 0, width: 800, height: 400 },
        { top: 100, bottom: 140, left: 20, right: 60 },
      ),
      { top: 0, left: 0 },
    );
  });

  it("uses one tempo conversion for audio and transport, including the pickup", () => {
    const song = SAMPLE_SONGS[0];
    const timeline = buildPerformanceTimeline(
      song,
      harmonize(song),
      "root-fifth",
    );
    const positionBeat = secondsToBeats(5, song.tempo);
    const activeMelody = timeline.find(
      (event) =>
        event.hand === "right" &&
        positionBeat >= event.startBeat &&
        positionBeat < event.startBeat + event.durationBeats,
    );

    assert.ok(Math.abs(beatsToSeconds(positionBeat, song.tempo) - 5) < 1e-9);
    assert.equal(song.measures[0].number, 0);
    assert.equal(song.measures[0].durationBeats, 1);
    assert.equal(activeMelody?.sourceEventId, "happy-m2-n1");
    assert.equal(getScoreEventStartBeat(song, "happy-m2-n1"), 5);
  });

  it("does not activate the next score row before its exact beat boundary", () => {
    const song = SAMPLE_SONGS[0];
    const timeline = buildPerformanceTimeline(
      song,
      harmonize(song),
      "root-fifth",
    );
    const hands = { right: true, left: false };
    const before = getActivePerformanceEvents(timeline, 4.999, hands);
    const atBoundary = getActivePerformanceEvents(timeline, 5, hands);

    assert.equal(before[0]?.sourceEventId, "happy-m1-n8");
    assert.equal(atBoundary[0]?.sourceEventId, "happy-m2-n1");
  });

  it("keeps every source row boundary of the pickup song on its exact beat", () => {
    const song = SAMPLE_SONGS[0];
    const timeline = buildPerformanceTimeline(
      song,
      harmonize(song),
      "root-fifth",
    );
    const hands = { right: true, left: false };
    const rowStarts = [
      { beat: 9, previous: "happy-m2-n3", next: "happy-m3-n1" },
      { beat: 17, previous: "happy-m4-n3", next: "happy-m5-n1" },
      { beat: 25, previous: "happy-m6-n8", next: "happy-m7-n1" },
    ];

    assert.equal(getTotalBeats(song), 33);
    for (const boundary of rowStarts) {
      assert.equal(
        getActivePerformanceEvents(timeline, boundary.beat - 0.001, hands)[0]
          ?.sourceEventId,
        boundary.previous,
      );
      assert.equal(
        getActivePerformanceEvents(timeline, boundary.beat, hands)[0]
          ?.sourceEventId,
        boundary.next,
      );
    }
  });

  it("ends every tone at its score boundary without bleeding into the next note", () => {
    const envelope = getToneEnvelopeTimes(10, 0.125);

    assert.ok(Math.abs(envelope.attackEnd - 10.004) < 1e-9);
    assert.equal(envelope.endTime, 10.125);
    assert.ok(envelope.releaseStart < envelope.endTime);
    assert.ok(envelope.releaseStart >= 10);
  });

  it("tracks the audible output frame instead of the page clock", () => {
    const context = {
      currentTime: 8,
      baseLatency: 0.01,
      outputLatency: 0.25,
      getOutputTimestamp: () => ({
        contextTime: 7.5,
        performanceTime: 1000,
      }),
    };

    assert.ok(Math.abs(getAudibleContextTime(context, 1100) - 7.6) < 1e-9);
  });

  it("uses the 0829 timestamp mapping without adding another latency cap", () => {
    const audibleTime = getAudibleContextTime(
      {
        currentTime: 8,
        baseLatency: 0.01,
        outputLatency: 0.25,
        getOutputTimestamp: () => ({
          contextTime: 7.98,
          performanceTime: 1000,
        }),
      },
      1100,
    );
    assert.ok(Math.abs(audibleTime - 8.08) < 1e-9);
  });

  it("uses output latency without double-counting base latency", () => {
    assert.equal(
      getAudibleContextTime({
        currentTime: 8,
        baseLatency: 0.01,
        outputLatency: 0.25,
      }),
      7.75,
    );
  });

  it("holds the start beat until the output clock reaches the scheduled start", () => {
    let currentTime = 10;
    const context = {
      currentTime,
      baseLatency: 0,
      outputLatency: 0,
      getOutputTimestamp: () => ({
        contextTime: currentTime,
        performanceTime: performance.now(),
      }),
    };
    const clock = createAudioPlaybackClock(context, 10.05, 2, 6, 0.5);

    assert.equal(clock.getPositionBeat(), 2);
    currentTime = 10.55;
    context.currentTime = currentTime;
    assert.ok(Math.abs(clock.getPositionBeat() - 3) < 0.01);
  });

  it("opens the start gate at the output boundary, not at the render clock", () => {
    const context = {
      currentTime: 10.6,
      baseLatency: 0.01,
      outputLatency: 0.25,
    };
    const clock = createAudioPlaybackClock(context, 10.5, 2, 6, 0.5);

    assert.deepEqual(clock.sample(), { positionBeat: 2, outputStarted: false });
    context.currentTime = 10.749;
    assert.deepEqual(clock.sample(), { positionBeat: 2, outputStarted: false });
    context.currentTime = 10.75;
    assert.deepEqual(clock.sample(), { positionBeat: 2, outputStarted: true });
    context.currentTime = 11;
    assert.deepEqual(clock.sample(), { positionBeat: 2.5, outputStarted: true });
  });

  it("gets the gate and position from the same output timestamp observation", () => {
    let reads = 0;
    const context = {
      currentTime: 12,
      baseLatency: 0.01,
      outputLatency: 0.1,
      getOutputTimestamp: () => {
        reads += 1;
        return {
          contextTime: 10.75,
          performanceTime: performance.now(),
        };
      },
    };
    const clock = createAudioPlaybackClock(context, 10.5, 2, 6, 0.5);
    const snapshot = clock.sample();

    assert.equal(reads, 1);
    assert.equal(snapshot.outputStarted, true);
    assert.ok(Math.abs(snapshot.positionBeat - 2.5) < 0.01);
  });

  it("uses base-latency fallback without opening the start gate prematurely", () => {
    const context = { currentTime: 10.5, baseLatency: 0.125 };
    const clock = createAudioPlaybackClock(context, 10.5, 0, 4, 1);

    assert.deepEqual(clock.sample(), { positionBeat: 0, outputStarted: false });
    context.currentTime = 10.625;
    assert.deepEqual(clock.sample(), { positionBeat: 0, outputStarted: true });
  });

  it("uses the current beat when a seek's first output observation arrives late", () => {
    const context = { currentTime: 100.25, baseLatency: 0.25 };
    const clock = createAudioPlaybackClock(context, 100.5, 8, 20, 0.5);

    assert.deepEqual(clock.sample(), { positionBeat: 8, outputStarted: false });
    context.currentTime = 102.25;
    assert.deepEqual(clock.sample(), { positionBeat: 11, outputStarted: true });
  });

  it("uses one output position through playback completion without a visual tail", () => {
    let currentTime = 20.55;
    const context = {
      currentTime,
      baseLatency: 0,
      outputLatency: 0,
      getOutputTimestamp: () => ({
        contextTime: currentTime,
        performanceTime: performance.now(),
      }),
    };
    const clock = createAudioPlaybackClock(
      context,
      20.05,
      0,
      4,
      0.5,
    );

    assert.ok(Math.abs(clock.getPositionBeat() - 1) < 0.01);

    currentTime = 22.06;
    context.currentTime = currentTime;
    assert.equal(clock.getPositionBeat(), 4);

    currentTime = 22.15;
    context.currentTime = currentTime;
    assert.equal(clock.getPositionBeat(), 4);
  });

  it("uses base latency only when output latency and timestamps are unavailable", () => {
    assert.equal(
      getAudibleContextTime({ currentTime: 8, baseLatency: 0.125 }),
      7.875,
    );
    assert.equal(
      getAudibleContextTime({
        currentTime: 8,
        baseLatency: 0.125,
        outputLatency: 0.25,
        getOutputTimestamp: () => ({ contextTime: 0, performanceTime: 0 }),
      }),
      7.75,
    );
  });

  it("cancels an older schedule that resumes after a newer request", async () => {
    const resumeResolvers: Array<() => void> = [];
    const oscillatorStarts: number[] = [];
    const connectable = () => ({
      connect: (destination: object) => destination,
    });
    const context = {
      state: "running",
      currentTime: 1,
      baseLatency: 0,
      destination: {},
      resume: () =>
        new Promise<void>((resolve) => {
          resumeResolvers.push(resolve);
        }),
      createGain: () => ({
        ...connectable(),
        gain: {
          value: 0,
          setValueAtTime: () => undefined,
          exponentialRampToValueAtTime: () => undefined,
        },
      }),
      createStereoPanner: () => ({
        ...connectable(),
        pan: { value: 0 },
      }),
      createOscillator: () => ({
        ...connectable(),
        type: "sine",
        frequency: { value: 0 },
        start: (time: number) => {
          oscillatorStarts.push(time);
        },
        stop: () => undefined,
        addEventListener: () => undefined,
      }),
      close: async () => undefined,
    } as unknown as AudioContext;
    const synth = new PianoSynth(() => context);
    const schedule = {
      events: [
        {
          id: "event-1",
          sourceEventId: "source-1",
          startBeat: 0,
          durationBeats: 1,
          midi: 60,
          hand: "right" as const,
          finger: 1,
          voice: "melody" as const,
          velocity: 0.8,
          measureNumber: 1,
        },
      ],
      fromBeat: 0,
      toBeat: 1,
      tempo: 60,
      speed: 1,
      rightEnabled: true,
      leftEnabled: false,
      metronome: false,
      measureStarts: [0],
    };

    const first = synth.schedule(schedule);
    await Promise.resolve();
    const second = synth.schedule(schedule);
    await Promise.resolve();
    assert.equal(resumeResolvers.length, 2);
    assert.deepEqual(oscillatorStarts, []);
    resumeResolvers[1]();
    await second;
    assert.deepEqual(oscillatorStarts, [1.05, 1.05, 1.05]);
    resumeResolvers[0]();
    const cancelledClock = await first;
    assert.equal(cancelledClock.getPositionBeat(), schedule.fromBeat);
    assert.deepEqual(cancelledClock.sample(), {
      positionBeat: schedule.fromBeat,
      outputStarted: false,
    });
    assert.deepEqual(oscillatorStarts, [1.05, 1.05, 1.05]);

    const stopped = synth.schedule(schedule);
    synth.stop();
    resumeResolvers[2]();
    const stoppedClock = await stopped;
    assert.deepEqual(stoppedClock.sample(), {
      positionBeat: schedule.fromBeat,
      outputStarted: false,
    });
    assert.deepEqual(oscillatorStarts, [1.05, 1.05, 1.05]);
    synth.dispose();
  });

  it("plays tied score notes as one continuous attack", () => {
    const song = SAMPLE_SONGS[1];
    const timeline = buildPerformanceTimeline(
      song,
      harmonize(song),
      "root-fifth",
    );
    const rightEvents = timeline.filter((event) => event.hand === "right");
    const merged = mergeTiedPerformanceEvents(rightEvents);
    const crossMeasureTie = merged.find(
      (event) => event.sourceEventId === "labor-m31-n3",
    );
    const phraseTie = merged.find(
      (event) => event.sourceEventId === "labor-m14-n3",
    );

    assert.equal(merged.length, rightEvents.length - 2);
    assert.equal(phraseTie?.durationBeats, 1.5);
    assert.equal(crossMeasureTie?.durationBeats, 3);
    const xml = createMusicXml(song, timeline, harmonize(song));
    assert.match(xml, /<slur type="start"\/>/);
    assert.match(xml, /<slur type="stop"\/>/);
  });

  it("builds the exact audio windows used by scheduling, including pickup and ties", () => {
    const pickupSong = SAMPLE_SONGS[0];
    const pickupTimeline = buildPerformanceTimeline(
      pickupSong,
      harmonize(pickupSong),
      "root-fifth",
    );
    const pickupWindows = buildAudioEventWindows({
      events: pickupTimeline,
      fromBeat: 0,
      toBeat: 1,
      tempo: pickupSong.tempo,
      speed: 1,
      rightEnabled: true,
      leftEnabled: false,
      metronome: false,
      measureStarts: getMeasureSpans(pickupSong).map((span) => span.startBeat),
    });

    assert.deepEqual(
      pickupWindows.map((window) => ({
        sourceEventId: window.event.sourceEventId,
        startBeat: window.startBeat,
        endBeat: window.endBeat,
      })),
      [
        { sourceEventId: "happy-m0-n1", startBeat: 0, endBeat: 0.5 },
        { sourceEventId: "happy-m0-n2", startBeat: 0.5, endBeat: 1 },
      ],
    );

    const laborSong = SAMPLE_SONGS[1];
    const laborTimeline = buildPerformanceTimeline(
      laborSong,
      harmonize(laborSong),
      "root-fifth",
    );
    const tiedEvent = laborTimeline.find(
      (event) =>
        event.hand === "right" && event.sourceEventId === "labor-m14-n3",
    );
    assert.ok(tiedEvent);
    const tiedWindow = buildAudioEventWindows({
      events: laborTimeline,
      fromBeat: tiedEvent.startBeat,
      toBeat: tiedEvent.startBeat + 1.5,
      tempo: laborSong.tempo,
      speed: 1,
      rightEnabled: true,
      leftEnabled: false,
      metronome: false,
      measureStarts: getMeasureSpans(laborSong).map((span) => span.startBeat),
    }).find((window) => window.event.sourceEventId === "labor-m14-n3");

    assert.ok(tiedWindow);
    assert.equal(tiedWindow.endBeat - tiedWindow.startBeat, 1.5);
  });

  it("prepares by resuming only, without warm-up oscillators or clock sampling", async () => {
    let resumes = 0;
    let timestampReads = 0;
    const context = {
      state: "running",
      currentTime: 2,
      sampleRate: 48000,
      baseLatency: 0.012,
      outputLatency: 0.08,
      destination: {},
      getOutputTimestamp: () => {
        timestampReads += 1;
        return { contextTime: 0, performanceTime: 0 };
      },
      resume: async () => { resumes += 1; },
      createOscillator: () => { throw new Error("Unexpected warm-up tone"); },
      close: async () => undefined,
    } as unknown as AudioContext;
    const synth = new PianoSynth(() => context);

    await synth.prepare();
    assert.equal(resumes, 1);
    assert.equal(timestampReads, 0);
    synth.dispose();
  });

  it("surfaces a suspended context or a rejected resume instead of claiming readiness", async () => {
    const context = {
      state: "suspended",
      currentTime: 2,
      baseLatency: 0.012,
      outputLatency: 0.08,
      destination: {},
      resume: async () => undefined,
      close: async () => undefined,
    } as unknown as AudioContext;
    const synth = new PianoSynth(() => context);
    await assert.rejects(synth.prepare(), /AUDIO_DEVICE_NOT_READY/);
    context.resume = async () => { throw new Error("Audio permission denied"); };
    await assert.rejects(synth.prepare(), /Audio permission denied/);
    synth.dispose();
  });
});

describe("teaching material generation gate", () => {
  for (const song of SAMPLE_SONGS) {
    it(`verifies the opening score, audio, animation, and keyboard for ${song.id}`, () => {
      const reviewedSong = recommendFingering(cloneSong(song));
      const timeline = buildPerformanceTimeline(
        reviewedSong,
        harmonize(reviewedSong),
        "root-fifth",
      );
      const report = verifyTeachingMaterialOpening(reviewedSong, timeline);

      assert.equal(report.checkedMeasures, Math.min(4, song.measures.length));
      assert.ok(report.checkedScoreEvents > 0);
      assert.ok(report.checkedAudioWindows > 0);
    });
  }

  it("rejects drift before the teaching view can open", () => {
    const song = recommendFingering(cloneSong(SAMPLE_SONGS[0]));
    const timeline = buildPerformanceTimeline(
      song,
      harmonize(song),
      "root-fifth",
    );
    const firstRightIndex = timeline.findIndex(
      (event) => event.hand === "right",
    );
    const driftedTimeline = timeline.map((event, index) =>
      index === firstRightIndex
        ? { ...event, startBeat: event.startBeat + 0.25 }
        : event,
    );

    assert.throws(
      () => verifyTeachingMaterialOpening(song, driftedTimeline),
      /不一致|时间|起点/,
    );
  });

  it("accepts a valid rest-only opening without inventing melody audio", () => {
    const song = cloneSong(SAMPLE_SONGS[1]);
    song.measures = song.measures.map((measure, index) =>
      index < 4
        ? {
            ...measure,
            events: measure.events.map((event) => ({
              ...event,
              midi: null,
              sourcePitchToken: undefined,
              finger: undefined,
              fingerLocked: undefined,
              tieToNext: undefined,
              slurToNext: undefined,
            })),
          }
        : measure,
    );
    const timeline = buildPerformanceTimeline(
      song,
      harmonize(song),
      "root-fifth",
    );

    const report = verifyTeachingMaterialOpening(song, timeline);
    const openingEndBeat = getMeasureSpans(song)[3].endBeat;
    assert.equal(report.checkedMeasures, 4);
    assert.equal(
      timeline.filter(
        (event) =>
          event.hand === "right" && event.startBeat < openingEndBeat,
      ).length,
      0,
    );
  });
});

describe("score and performance consistency", () => {
  it("accepts a timeline derived from the canonical score", () => {
    const song = recommendFingering(cloneSong(SAMPLE_SONGS[0]));
    const timeline = buildPerformanceTimeline(
      song,
      harmonize(song),
      "root-fifth",
    );

    assert.deepEqual(validatePerformanceTimeline(song, timeline), []);
  });

  it("rejects drift in pitch, timing, fingering, or source identity", () => {
    const song = recommendFingering(cloneSong(SAMPLE_SONGS[0]));
    const timeline = buildPerformanceTimeline(song, harmonize(song), "root");
    const firstRightIndex = timeline.findIndex(
      (event) => event.hand === "right",
    );
    const corrupted = timeline.map((event, index) =>
      index === firstRightIndex
        ? {
            ...event,
            midi: event.midi + 1,
            startBeat: event.startBeat + 0.25,
            finger: event.finger === 5 ? 4 : event.finger + 1,
          }
        : event,
    );

    assert.ok(
      validatePerformanceTimeline(song, corrupted).some(
        (issue) => issue.level === "error",
      ),
    );
  });
});

describe("consistent exports", () => {
  const song = SAMPLE_SONGS[0];
  const harmony = harmonize(song);
  const timeline = buildPerformanceTimeline(song, harmony, "block");

  it("writes a valid MIDI header from the performance timeline", () => {
    const midi = createMidiFile(song, timeline, 0.5);
    assert.equal(new TextDecoder().decode(midi.slice(0, 4)), "MThd");
    assert.equal(new TextDecoder().decode(midi.slice(14, 18)), "MTrk");
    assert.ok(midi.length > 200);
  });

  it("keeps the MIDI end-of-track at the full score duration", () => {
    const midi = createMidiFile(song, timeline);
    let offset = 22;
    let absoluteTick = 0;
    while (offset < midi.length) {
      let delta = 0;
      let byte = 0;
      do {
        byte = midi[offset++];
        delta = (delta << 7) | (byte & 0x7f);
      } while ((byte & 0x80) !== 0);
      absoluteTick += delta;
      const status = midi[offset++];
      if (status === 0xff) {
        const type = midi[offset++];
        let length = 0;
        do {
          byte = midi[offset++];
          length = (length << 7) | (byte & 0x7f);
        } while ((byte & 0x80) !== 0);
        if (type === 0x2f) break;
        offset += length;
      } else {
        offset += status >= 0xc0 && status <= 0xdf ? 1 : 2;
      }
    }
    assert.equal(absoluteTick, getTotalBeats(song) * 480);
  });

  it("writes both hands, fingering and harmony to MusicXML", () => {
    const xml = createMusicXml(song, timeline, harmony);
    assert.match(xml, /<score-partwise version="4\.0">/);
    assert.match(xml, /<part-name>右手旋律<\/part-name>/);
    assert.match(xml, /<part-name>左手伴奏<\/part-name>/);
    assert.match(xml, /<fingering>/);
    assert.match(xml, /<harmony>/);
    assert.match(xml, /<rest\/>/);
    assert.match(xml, /<type>eighth<\/type>/);
  });

  it("serializes the exact event count to the JSON interchange format", () => {
    const result = JSON.parse(createTimelineJson(song, timeline, harmony)) as {
      events: unknown[];
      score: {
        measures: Array<{
          events: Array<{ midi: number | null; durationBeats: number }>;
        }>;
      };
    };
    assert.equal(result.events.length, timeline.length);
    assert.deepEqual(
      result.score.measures.at(-1)?.events.map((event) => ({
        midi: event.midi,
        durationBeats: event.durationBeats,
      })),
      [
        { midi: pitchNameToMidi("F4"), durationBeats: 3 },
        { midi: null, durationBeats: 1 },
      ],
    );
  });
});
