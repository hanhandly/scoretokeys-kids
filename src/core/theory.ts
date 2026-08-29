import type { ChordDefinition, SongModel } from "../types";

const NATURAL_PITCH_CLASSES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

export const KEY_ROOTS: Record<string, number> = {
  C: 0,
  G: 7,
  D: 2,
  F: 5,
  Bb: 10,
  Eb: 3,
};

export const KEY_FIFTHS: Record<string, number> = {
  C: 0,
  G: 1,
  D: 2,
  F: -1,
  Bb: -2,
  Eb: -3,
};

export function keyPrefersFlats(key: string): boolean {
  return (KEY_FIFTHS[key] ?? 0) < 0;
}

export function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

export function pitchNameToMidi(name: string): number {
  const match = /^([A-G])([#b]?)(-?\d+)$/.exec(name);
  if (!match) {
    throw new Error(`无法解析音名：${name}`);
  }

  const [, letter, accidental, octaveText] = match;
  const accidentalOffset = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  return (
    (Number(octaveText) + 1) * 12 +
    NATURAL_PITCH_CLASSES[letter] +
    accidentalOffset
  );
}

export function midiToPitchName(midi: number, preferFlats = false): string {
  const names = preferFlats ? FLAT_NAMES : SHARP_NAMES;
  const pitchClass = positiveModulo(midi, 12);
  const octave = Math.floor(midi / 12) - 1;
  return `${names[pitchClass]}${octave}`;
}

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function isBlackKey(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(positiveModulo(midi, 12));
}

export interface JianpuPitch {
  degree: number;
  accidental: -1 | 0 | 1;
  octaveShift: number;
}

export function midiToJianpu(midi: number, song: SongModel): JianpuPitch {
  const rootPc = KEY_ROOTS[song.key] ?? positiveModulo(song.tonicMidi, 12);
  const relativePc = positiveModulo(midi - rootPc, 12);

  let bestDegree = 0;
  let bestAccidental: -1 | 0 | 1 = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  MAJOR_SCALE.forEach((scalePc, index) => {
    let distance = relativePc - scalePc;
    if (distance > 6) distance -= 12;
    if (distance < -6) distance += 12;
    if (Math.abs(distance) < bestDistance && Math.abs(distance) <= 1) {
      bestDegree = index;
      bestAccidental = Math.sign(distance) as -1 | 0 | 1;
      bestDistance = Math.abs(distance);
    }
  });

  const referencePitch = song.tonicMidi + MAJOR_SCALE[bestDegree] + bestAccidental;
  const octaveShift = Math.round((midi - referencePitch) / 12);
  return {
    degree: bestDegree + 1,
    accidental: bestAccidental,
    octaveShift,
  };
}

export function degreeToMidi(token: string, tonicMidi: number): number {
  const match = /^([1-7])([',]*)$/.exec(token);
  if (!match) {
    throw new Error(`无法解析简谱音高：${token}`);
  }

  const degree = Number(match[1]) - 1;
  const octaveMarks = match[2];
  const octaveOffset =
    [...octaveMarks].filter((mark) => mark === "'").length -
    [...octaveMarks].filter((mark) => mark === ",").length;
  return tonicMidi + MAJOR_SCALE[degree] + octaveOffset * 12;
}

export function buildChordPalette(key: string): ChordDefinition[] {
  const rootPc = KEY_ROOTS[key] ?? 0;
  const names = key === "C" || key === "G" || key === "D" ? SHARP_NAMES : FLAT_NAMES;
  const specs = [
    { degree: 1, quality: "major" as const, intervals: [0, 4, 7] },
    { degree: 4, quality: "major" as const, intervals: [0, 4, 7] },
    { degree: 5, quality: "major" as const, intervals: [0, 4, 7] },
    { degree: 6, quality: "minor" as const, intervals: [0, 3, 7] },
  ];

  return specs.map(({ degree, quality, intervals }) => {
    const chordRoot = positiveModulo(rootPc + MAJOR_SCALE[degree - 1], 12);
    return {
      symbol: `${names[chordRoot]}${quality === "minor" ? "m" : ""}`,
      degree,
      quality,
      rootPc: chordRoot,
      pitchClasses: intervals.map((interval) => positiveModulo(chordRoot + interval, 12)),
    };
  });
}

export function chordSolfege(chord: ChordDefinition, song: SongModel): string {
  const syllables = ["多", "来", "米", "发", "嗦", "拉", "西"];
  return chord.pitchClasses
    .map((pitchClass) => {
      const syntheticMidi = song.tonicMidi + positiveModulo(pitchClass - song.tonicMidi, 12);
      const { degree, accidental } = midiToJianpu(syntheticMidi, song);
      const prefix = accidental === 1 ? "升" : accidental === -1 ? "降" : "";
      return `${prefix}${syllables[degree - 1]}`;
    })
    .join(" · ");
}
