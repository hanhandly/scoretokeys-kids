import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPerformanceTimeline,
  harmonize,
  recommendFingering,
} from "./arrangement";
import { getAudibleContextTime } from "./audio";
import {
  createMidiFile,
  createMusicXml,
  createTimelineJson,
} from "./exporters";
import {
  cloneSong,
  getMeasureSpans,
  groupMeasuresIntoSystems,
  relayoutEvents,
  validateSong,
} from "./model";
import {
  keyPrefersFlats,
  pitchNameToMidi,
  positiveModulo,
} from "./theory";
import { SAMPLE_SONGS } from "../data/samples";

describe("normalized score model", () => {
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
          durationBeats: 3,
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
});

describe("audio and animation clock", () => {
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

  it("falls back to reported output latency", () => {
    assert.equal(
      getAudibleContextTime({
        currentTime: 8,
        baseLatency: 0.01,
        outputLatency: 0.25,
      }),
      7.75,
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
    };
    assert.equal(result.events.length, timeline.length);
  });
});
