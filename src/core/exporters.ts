import type {
  ChordAssignment,
  Hand,
  PerformanceEvent,
  ScoreEvent,
  SongModel,
} from "../types";
import {
  getMeasureSpans,
  getTotalBeats,
  mergeTiedPerformanceEvents,
  validatePerformanceTimeline,
  validateSong,
} from "./model";
import { KEY_FIFTHS, midiToPitchName } from "./theory";

const TICKS_PER_BEAT = 480;
const XML_DIVISIONS = TICKS_PER_BEAT;

function assertExportableSong(
  song: SongModel,
  events: PerformanceEvent[],
): void {
  const error = validateSong(song).find((issue) => issue.level === "error");
  if (error) throw new Error(`无法导出：${error.message}`);
  const timelineError = validatePerformanceTimeline(song, events).find(
    (issue) => issue.level === "error",
  );
  if (timelineError) throw new Error(`无法导出：${timelineError.message}`);
}

function toXmlDuration(durationBeats: number): number {
  const divisions = durationBeats * XML_DIVISIONS;
  const rounded = Math.round(divisions);
  if (
    !Number.isFinite(divisions) ||
    rounded <= 0 ||
    Math.abs(divisions - rounded) > 0.0001
  ) {
    throw new Error(
      `时值 ${durationBeats} 拍无法以 ${XML_DIVISIONS} divisions 精确导出。`,
    );
  }
  return rounded;
}

function encodeUint32(value: number): number[] {
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ];
}

function encodeUint16(value: number): number[] {
  return [(value >>> 8) & 0xff, value & 0xff];
}

function encodeVariableLength(value: number): number[] {
  let buffer = value & 0x7f;
  const bytes: number[] = [];
  while ((value >>= 7) > 0) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
  return bytes;
}

function textBytes(text: string): number[] {
  return [...new TextEncoder().encode(text)];
}

interface MidiMessage {
  tick: number;
  order: number;
  bytes: number[];
}

export function createMidiFile(
  song: SongModel,
  events: PerformanceEvent[],
  speed = 1,
): Uint8Array {
  assertExportableSong(song, events);
  const tempo = Math.max(20, Math.round(song.tempo * speed));
  const microsecondsPerBeat = Math.round(60_000_000 / tempo);
  const title = textBytes(song.title);
  const messages: MidiMessage[] = [
    {
      tick: 0,
      order: 0,
      bytes: [0xff, 0x03, ...encodeVariableLength(title.length), ...title],
    },
    {
      tick: 0,
      order: 1,
      bytes: [
        0xff,
        0x51,
        0x03,
        (microsecondsPerBeat >>> 16) & 0xff,
        (microsecondsPerBeat >>> 8) & 0xff,
        microsecondsPerBeat & 0xff,
      ],
    },
    {
      tick: 0,
      order: 2,
      bytes: [
        0xff,
        0x58,
        0x04,
        song.timeSignature.beats,
        Math.log2(song.timeSignature.beatType),
        24,
        8,
      ],
    },
    {
      tick: 0,
      order: 3,
      bytes: [0xc0, 0],
    },
    {
      tick: 0,
      order: 4,
      bytes: [0xc1, 0],
    },
  ];

  for (const event of mergeTiedPerformanceEvents(events)) {
    const channel = event.hand === "right" ? 0 : 1;
    const startTick = Math.max(0, Math.round(event.startBeat * TICKS_PER_BEAT));
    const endTick = Math.max(
      startTick + 1,
      Math.round((event.startBeat + event.durationBeats) * TICKS_PER_BEAT),
    );
    const velocity = Math.max(1, Math.min(127, Math.round(event.velocity * 127)));
    messages.push({
      tick: startTick,
      order: 10,
      bytes: [0x90 | channel, event.midi, velocity],
    });
    messages.push({
      tick: endTick,
      order: 5,
      bytes: [0x80 | channel, event.midi, 0],
    });
  }

  messages.sort((a, b) => a.tick - b.tick || a.order - b.order);
  const track: number[] = [];
  let lastTick = 0;
  for (const message of messages) {
    track.push(...encodeVariableLength(message.tick - lastTick), ...message.bytes);
    lastTick = message.tick;
  }
  const songEndTick = Math.round(getTotalBeats(song) * TICKS_PER_BEAT);
  if (lastTick > songEndTick) {
    throw new Error("无法导出：演奏事件超出乐谱总时长。");
  }
  track.push(...encodeVariableLength(songEndTick - lastTick), 0xff, 0x2f, 0);

  return new Uint8Array([
    ...textBytes("MThd"),
    ...encodeUint32(6),
    ...encodeUint16(0),
    ...encodeUint16(1),
    ...encodeUint16(TICKS_PER_BEAT),
    ...textBytes("MTrk"),
    ...encodeUint32(track.length),
    ...track,
  ]);
}

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function pitchXml(midi: number, preferFlats: boolean): string {
  const pitch = midiToPitchName(midi, preferFlats);
  const match = /^([A-G])([#b]?)(-?\d+)$/.exec(pitch);
  if (!match) throw new Error(`无法导出 MIDI 音高 ${midi}`);
  const [, step, accidental, octave] = match;
  const alter =
    accidental === "#" ? "<alter>1</alter>" : accidental === "b" ? "<alter>-1</alter>" : "";
  return `<pitch><step>${step}</step>${alter}<octave>${octave}</octave></pitch>`;
}

function durationNotation(durationBeats: number): string {
  const notations = new Map<number, [type: string, dotted: boolean]>([
    [0.125, ["32nd", false]],
    [0.25, ["16th", false]],
    [0.375, ["16th", true]],
    [0.5, ["eighth", false]],
    [0.75, ["eighth", true]],
    [1, ["quarter", false]],
    [1.5, ["quarter", true]],
    [2, ["half", false]],
    [3, ["half", true]],
    [4, ["whole", false]],
  ]);
  const notation = notations.get(durationBeats);
  return notation
    ? `<type>${notation[0]}</type>${notation[1] ? "<dot/>" : ""}`
    : "";
}

function restXml(durationBeats: number): string {
  return (
    `<note><rest/><duration>${toXmlDuration(
      durationBeats,
    )}</duration><voice>1</voice>${durationNotation(durationBeats)}</note>`
  );
}

interface ExportNote {
  startBeat: number;
  durationBeats: number;
  midi: number | null;
  finger?: number;
  tieFromPrevious?: boolean;
  tieToNext?: boolean;
  slurFromPrevious?: boolean;
  slurToNext?: boolean;
}

function renderPartMeasure(
  song: SongModel,
  measureNumber: number,
  measureDuration: number,
  events: PerformanceEvent[],
  hand: Hand,
  includeAttributes: boolean,
  chord?: ChordAssignment,
): string {
  const preferFlats = (KEY_FIFTHS[song.key] ?? 0) < 0;
  const span = getMeasureSpans(song).find((item) => item.number === measureNumber)!;
  const sourceMeasure = song.measures.find(
    (measure) => measure.number === measureNumber,
  )!;
  const allScoreEvents = song.measures.flatMap((measure) => measure.events);
  const partEvents: ExportNote[] =
    hand === "right"
      ? sourceMeasure.events.map((event: ScoreEvent) => {
          const sourceIndex = allScoreEvents.findIndex(
            (candidate) => candidate.id === event.id,
          );
          return {
          startBeat: span.startBeat + event.offsetBeats,
          durationBeats: event.durationBeats,
          midi: event.midi,
          finger: event.finger,
          tieFromPrevious: events.find(
            (performanceEvent) =>
              performanceEvent.sourceEventId === event.id,
          )?.tieFromPrevious,
          tieToNext: event.tieToNext,
          slurFromPrevious:
            sourceIndex > 0 && allScoreEvents[sourceIndex - 1].slurToNext,
          slurToNext: event.slurToNext,
        };
        })
      : events
          .filter(
            (event) =>
              event.measureNumber === measureNumber && event.hand === hand,
          )
          .map((event) => ({
            startBeat: event.startBeat,
            durationBeats: event.durationBeats,
            midi: event.midi,
            finger: event.finger,
            tieFromPrevious: event.tieFromPrevious,
            tieToNext: event.tieToNext,
          }));
  partEvents.sort(
    (left, right) =>
      left.startBeat - right.startBeat ||
      (left.midi ?? -1) - (right.midi ?? -1),
  );
  const groups = new Map<number, ExportNote[]>();
  for (const event of partEvents) {
    const offset = Number((event.startBeat - span.startBeat).toFixed(4));
    groups.set(offset, [...(groups.get(offset) ?? []), event]);
  }

  const body: string[] = [];
  if (includeAttributes) {
    body.push(
      `<attributes><divisions>${XML_DIVISIONS}</divisions>` +
        `<key><fifths>${KEY_FIFTHS[song.key] ?? 0}</fifths></key>` +
        `<time><beats>${song.timeSignature.beats}</beats>` +
        `<beat-type>${song.timeSignature.beatType}</beat-type></time>` +
        `<clef><sign>${hand === "right" ? "G" : "F"}</sign>` +
        `<line>${hand === "right" ? 2 : 4}</line></clef></attributes>`,
    );
    if (hand === "right") {
      body.push(
        `<direction placement="above"><direction-type><metronome>` +
          `<beat-unit>quarter</beat-unit><per-minute>${song.tempo}</per-minute>` +
          `</metronome></direction-type><sound tempo="${song.tempo}"/></direction>`,
      );
    }
  }

  if (hand === "right" && chord) {
    const root = chord.symbol.replace("m", "");
    const match = /^([A-G])([b#]?)$/.exec(root);
    if (match) {
      const alter =
        match[2] === "b"
          ? "<root-alter>-1</root-alter>"
          : match[2] === "#"
            ? "<root-alter>1</root-alter>"
            : "";
      body.push(
        `<harmony><root><root-step>${match[1]}</root-step>${alter}</root>` +
          `<kind>${chord.quality}</kind></harmony>`,
      );
    }
  }

  let cursor = 0;
  let hasMusicalContent = false;
  for (const [offset, group] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    if (offset > cursor) {
      body.push(restXml(offset - cursor));
    }
    const rests = group.filter((event) => event.midi === null);
    if (rests.length > 0) {
      for (const rest of rests) {
        body.push(restXml(rest.durationBeats));
        cursor = Math.max(cursor, offset + rest.durationBeats);
        hasMusicalContent = true;
      }
      continue;
    }
    const groupDuration = Math.max(...group.map((event) => event.durationBeats));
    group.forEach((event, index) => {
      const tieElements = [
        event.tieFromPrevious ? '<tie type="stop"/>' : "",
        event.tieToNext ? '<tie type="start"/>' : "",
      ].join("");
      const notationElements = [
        event.tieFromPrevious ? '<tied type="stop"/>' : "",
        event.tieToNext ? '<tied type="start"/>' : "",
        event.slurFromPrevious ? '<slur type="stop"/>' : "",
        event.slurToNext ? '<slur type="start"/>' : "",
        (event.finger ?? 0) > 0
          ? `<technical><fingering>${event.finger}</fingering></technical>`
          : "",
      ].join("");
      const notations = notationElements
        ? `<notations>${notationElements}</notations>`
        : "";
      body.push(
        `<note>${index > 0 ? "<chord/>" : ""}${pitchXml(event.midi!, preferFlats)}` +
          tieElements +
          `<duration>${toXmlDuration(event.durationBeats)}</duration>` +
          `<voice>1</voice>${durationNotation(event.durationBeats)}${notations}</note>`,
      );
    });
    cursor = Math.max(cursor, offset + groupDuration);
    hasMusicalContent = true;
  }

  if (!hasMusicalContent) {
    body.push(restXml(measureDuration));
  } else if (cursor < measureDuration) {
    body.push(restXml(measureDuration - cursor));
  }

  return `<measure number="${measureNumber}">${body.join("")}</measure>`;
}

export function createMusicXml(
  song: SongModel,
  events: PerformanceEvent[],
  harmony: ChordAssignment[],
  partNames: {
    rightHandPart: string;
    leftHandPart: string;
  } = {
    rightHandPart: "右手旋律",
    leftHandPart: "左手伴奏",
  },
): string {
  assertExportableSong(song, events);
  const parts = (["right", "left"] as const).map((hand, partIndex) => {
    const measures = song.measures.map((measure, measureIndex) =>
      renderPartMeasure(
        song,
        measure.number,
        measure.durationBeats,
        events,
        hand,
        measureIndex === 0,
        harmony.find((chord) => chord.measureNumber === measure.number),
      ),
    );
    return `<part id="P${partIndex + 1}">${measures.join("")}</part>`;
  });

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="no"?>` +
    `<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" ` +
    `"http://www.musicxml.org/dtds/partwise.dtd">` +
    `<score-partwise version="4.0"><work><work-title>${xmlEscape(song.title)}</work-title></work>` +
    `<identification><creator type="software">ScoreToKeys Kids</creator></identification>` +
    `<part-list><score-part id="P1"><part-name>${xmlEscape(partNames.rightHandPart)}</part-name></score-part>` +
    `<score-part id="P2"><part-name>${xmlEscape(partNames.leftHandPart)}</part-name></score-part></part-list>` +
    parts.join("") +
    `</score-partwise>`
  );
}

export function createTimelineJson(
  song: SongModel,
  events: PerformanceEvent[],
  harmony: ChordAssignment[],
): string {
  assertExportableSong(song, events);
  return JSON.stringify(
    {
      schemaVersion: "scoretokeys/timeline/v2",
      song: {
        id: song.id,
        title: song.title,
        key: song.key,
        timeSignature: `${song.timeSignature.beats}/${song.timeSignature.beatType}`,
        tempo: song.tempo,
      },
      measures: getMeasureSpans(song),
      score: {
        measures: song.measures.map((measure) => ({
          id: measure.id,
          number: measure.number,
          durationBeats: measure.durationBeats,
          events: measure.events.map((event) => ({ ...event })),
        })),
      },
      harmony,
      events,
    },
    null,
    2,
  );
}
