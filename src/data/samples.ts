import type { MeasureModel, ScoreEvent, SongModel } from "../types";
import { recommendFingering } from "../core/arrangement";
import { degreeToMidi, pitchNameToMidi } from "../core/theory";

type EventSpec = readonly [
  pitch: string | number | null,
  duration: number,
  lyric?: string,
  confidence?: number,
  tieToNext?: boolean,
  sourcePitchToken?: string,
  slurToNext?: boolean,
];

function makeMeasure(
  songId: string,
  number: number,
  durationBeats: number,
  specs: readonly EventSpec[],
  chordHint?: string,
  phraseEnd = false,
): MeasureModel {
  let offsetBeats = 0;
  const events: ScoreEvent[] = specs.map(([pitch, duration, lyric, confidence, tieToNext, sourcePitchToken, slurToNext], index) => {
    const event: ScoreEvent = {
      id: `${songId}-m${number}-n${index + 1}`,
      offsetBeats,
      durationBeats: duration,
      midi:
        pitch === null ? null : typeof pitch === "number" ? pitch : pitchNameToMidi(pitch),
      sourcePitchToken,
      lyric,
      confidence: confidence ?? 0.94,
      tieToNext,
      slurToNext,
    };
    offsetBeats += duration;
    return event;
  });

  return {
    id: `${songId}-m${number}`,
    number,
    durationBeats,
    events,
    chordHint,
    phraseEnd,
  };
}

const happyId = "happy";
const happyMeasures = [
  makeMeasure(happyId, 0, 1, [
    ["C4", 0.5, "If"],
    ["C4", 0.5, "you're"],
  ]),
  makeMeasure(
    happyId,
    1,
    4,
    [
      ["F4", 0.5, "hap"],
      ["F4", 0.5, "py"],
      ["F4", 0.5, "and"],
      ["F4", 0.5, "you"],
      ["F4", 0.5, "know"],
      ["F4", 0.5, "it"],
      ["E4", 0.5, "clap"],
      ["F4", 0.5, "your"],
    ],
    "F",
  ),
  makeMeasure(
    happyId,
    2,
    4,
    [
      ["G4", 3, "hands"],
      ["C4", 0.5, "If"],
      ["C4", 0.5, "you're"],
    ],
    "C",
    true,
  ),
  makeMeasure(
    happyId,
    3,
    4,
    [
      ["G4", 0.5, "hap"],
      ["G4", 0.5, "py"],
      ["G4", 0.5, "and"],
      ["G4", 0.5, "you"],
      ["G4", 0.5, "know"],
      ["G4", 0.5, "it"],
      ["F4", 0.5, "clap"],
      ["G4", 0.5, "your"],
    ],
    "F",
  ),
  makeMeasure(
    happyId,
    4,
    4,
    [
      ["A4", 3, "hands"],
      ["A4", 0.5, "If"],
      ["A4", 0.5, "you're"],
    ],
    "F",
    true,
  ),
  makeMeasure(
    happyId,
    5,
    4,
    [
      ["Bb4", 0.5, "hap"],
      ["Bb4", 0.5, "py"],
      ["Bb4", 0.5, "and"],
      ["Bb4", 0.5, "you"],
      ["D4", 0.5, "know"],
      ["D4", 0.5, "it"],
      ["Bb4", 0.5, "and"],
      ["Bb4", 0.5, "you"],
    ],
    "Bb",
  ),
  makeMeasure(
    happyId,
    6,
    4,
    [
      ["A4", 0.5, "real"],
      ["A4", 0.5, "ly"],
      ["A4", 0.5, "want"],
      ["G4", 0.5, "to"],
      ["F4", 0.5, "show"],
      ["F4", 0.5, "it"],
      ["A4", 0.5, "If"],
      ["A4", 0.5, "you're"],
    ],
    "F",
  ),
  makeMeasure(
    happyId,
    7,
    4,
    [
      ["G4", 0.5, "hap"],
      ["G4", 0.5, "py"],
      ["G4", 0.5, "and"],
      ["F4", 0.5, "you"],
      ["E4", 0.5, "know"],
      ["E4", 0.5, "it"],
      ["D4", 0.5, "clap"],
      ["E4", 0.5, "your"],
    ],
    "C",
  ),
  makeMeasure(
    happyId,
    8,
    4,
    [
      ["F4", 3, "hands"],
      [null, 1],
    ],
    "F",
    true,
  ),
];

const happySong: SongModel = {
  id: happyId,
  title: "If You're Happy And You Know It",
  subtitle: "Traditional · 儿童钢琴练习曲",
  key: "F",
  tonicMidi: pitchNameToMidi("F4"),
  timeSignature: { beats: 4, beatType: 4 },
  tempo: 92,
  suggestedTempo: "♩ = 92 · 活泼地",
  measures: happyMeasures,
  source: {
    imagePath: "/If-Youre-Happy-And-You-Know-It.jpeg",
    notation: "staff",
    overallConfidence: 0.96,
    coverage: "完整旋律，8 小节 + 弱起",
    attribution: "Traditional melody",
    recognizer: "自动识别与逐音校对",
    verificationStatus: "development-fixture",
    notes: [
      "调号识别为 F 大调，拍号 4/4。",
      "已按原谱低音区逐音复核，不再使用首版高八度近似旋律。",
      "第 5 小节 “know it” 的两个 D 音按原图记为 D4，不再按其他传统版本升高八度。",
    ],
  },
};

const laborId = "labor";
const laborTonic = pitchNameToMidi("Bb3");
const j = (
  degree: string | null,
  duration: number,
  lyric?: string,
  confidence = 0.9,
  tieToNext = false,
  slurToNext = false,
): EventSpec =>
  [
    degree === null ? null : degreeToMidi(degree, laborTonic),
    duration,
    lyric,
    confidence,
    tieToNext,
    degree ?? undefined,
    slurToNext,
  ];

const laborMeasures = [
  makeMeasure(
    laborId,
    1,
    2,
    [
      j("5", 0.5, "太"),
      j("1'", 0.5, "阳"),
      j("1'", 0.5, "光", 0.9, false, true),
      j("5", 0.5),
    ],
    "Bb",
  ),
  makeMeasure(
    laborId,
    2,
    2,
    [j("6", 0.5, "金"), j("6", 0.5, "亮"), j("5", 1, "亮")],
    "F",
  ),
  makeMeasure(
    laborId,
    3,
    2,
    [
      j("3", 0.25, "雄", 0.82, false, true),
      j("4", 0.25, undefined, 0.82),
      j("5", 0.25, "鸡", 0.9, false, true),
      j("6", 0.25),
      j("1", 0.5, "唱"),
      j("3", 0.5, "三", 0.82),
    ],
    "Bb",
  ),
  makeMeasure(laborId, 4, 2, [j("2", 2, "唱")], "F", true),
  makeMeasure(
    laborId,
    5,
    2,
    [j("5", 0.5, "花"), j("1'", 1, "儿", 0.9, false, true), j("5", 0.5)],
    "Bb",
  ),
  makeMeasure(
    laborId,
    6,
    2,
    [j("6", 0.5, "醒"), j("6", 0.5, "来"), j("5", 1, "了")],
    "F",
  ),
  makeMeasure(
    laborId,
    7,
    2,
    [
      j("5", 0.25, "鸟", 0.9, false, true),
      j("6", 0.25),
      j("1'", 0.25, "儿", 0.9, false, true),
      j("3'", 0.25),
      j("2'", 0.5, "忙"),
      j("5", 0.5, "梳", 0.8),
    ],
    "F",
  ),
  makeMeasure(laborId, 8, 2, [j("1'", 2, "妆")], "Bb", true),
  makeMeasure(
    laborId,
    9,
    2,
    [
      j("1'", 0.75, "小"),
      j("2'", 0.25, "喜"),
      j("1'", 0.5, "鹊", 0.9, false, true),
      j("5", 0.5),
    ],
    "Bb",
  ),
  makeMeasure(
    laborId,
    10,
    2,
    [j("6", 0.5, "造"), j("6", 0.5, "新"), j("5", 1, "房")],
    "F",
  ),
  makeMeasure(
    laborId,
    11,
    2,
    [
      j("3", 0.75, "小"),
      j("1'", 0.25, "蜜"),
      j("6", 0.5, "蜂", 0.9, false, true),
      j("5", 0.5),
    ],
    "Eb",
  ),
  makeMeasure(
    laborId,
    12,
    2,
    [j("1", 0.5, "采"), j("3", 0.5, "蜜"), j("2", 1, "忙")],
    "Bb",
  ),
  makeMeasure(
    laborId,
    13,
    2,
    [
      j("1", 0.5, "幸"),
      j("1", 0.25, "福"),
      j("2", 0.25, "的"),
      j("3", 0.5, "生"),
      j("5", 0.25, "活"),
      j("5", 0.25, "从"),
    ],
    "Bb",
  ),
  makeMeasure(
    laborId,
    14,
    2,
    [
      j("6", 0.5, "哪"),
      j("5", 0.5, "里"),
      j("1'", 1, "来", 0.9, true),
    ],
    "F",
  ),
  makeMeasure(
    laborId,
    15,
    2,
    [
      j("1'", 0.5),
      j("5", 0.25, "要"),
      j("6", 0.25, "靠"),
      j("1'", 1, "劳"),
    ],
    "Bb",
  ),
  makeMeasure(
    laborId,
    16,
    2,
    [j("3'", 1, "动"), j("2'", 0.5, "来"), j("5", 0.5, "创")],
    "F",
  ),
  makeMeasure(
    laborId,
    17,
    2,
    [j("1'", 1, "造"), j(null, 1)],
    "Bb",
    true,
  ),
  makeMeasure(
    laborId,
    18,
    2,
    [
      j("5", 0.5, "青", 0.78),
      j("1'", 0.25, "青", 0.78),
      j("1'", 0.25, "的", 0.78),
      j("1'", 0.5, "叶"),
      j("5", 0.5, "儿"),
    ],
    "Bb",
  ),
  makeMeasure(
    laborId,
    19,
    2,
    [
      j("6", 0.5, "红"),
      j("6", 0.25, "红"),
      j("1'", 0.25, "的"),
      j("5", 1, "花"),
    ],
    "F",
  ),
  makeMeasure(
    laborId,
    20,
    2,
    [
      j("3", 0.25, "小", 0.9, false, true),
      j("4", 0.25),
      j("5", 0.25, "蝴", 0.9, false, true),
      j("6", 0.25),
      j("5", 0.75, "蝶", 0.9, false, true),
      j("3", 0.25),
    ],
    "Bb",
    true,
  ),
  makeMeasure(
    laborId,
    21,
    2,
    [j("1", 0.5, "贪"), j("3", 0.5, "玩"), j("2", 1, "耍")],
    "Bb",
  ),
  makeMeasure(
    laborId,
    22,
    2,
    [
      j("5", 0.5, "不"),
      j("1'", 0.5, "爱"),
      j("1'", 0.5, "劳"),
      j("5", 0.5, "动"),
    ],
    "Bb",
  ),
  makeMeasure(
    laborId,
    23,
    2,
    [j("6", 0.5, "不"), j("6", 0.5, "学"), j("5", 1, "习")],
    "F",
  ),
  makeMeasure(
    laborId,
    24,
    2,
    [
      j("5", 0.25, "我"),
      j("6", 0.25, "们"),
      j("1'", 0.25, "大"),
      j("3'", 0.25, "家"),
      j("2'", 0.5, "不"),
      j("5", 0.5, "学"),
    ],
    "F",
  ),
  makeMeasure(laborId, 25, 2, [j("1'", 2, "他")], "Bb", true),
  makeMeasure(
    laborId,
    26,
    2,
    [
      j("1'", 0.75, "要"),
      j("2'", 0.25, "学"),
      j("1'", 0.5, "喜"),
      j("5", 0.5, "鹊"),
    ],
    "Bb",
  ),
  makeMeasure(
    laborId,
    27,
    2,
    [j("6", 0.5, "造"), j("6", 0.5, "新"), j("5", 1, "房")],
    "F",
  ),
  makeMeasure(
    laborId,
    28,
    2,
    [
      j("3", 0.75, "要"),
      j("1'", 0.25, "学"),
      j("6", 0.5, "蜜"),
      j("5", 0.5, "蜂"),
    ],
    "Eb",
  ),
  makeMeasure(
    laborId,
    29,
    2,
    [j("1", 0.5, "采"), j("3", 0.5, "蜜"), j("2", 1, "糖")],
    "Bb",
  ),
  makeMeasure(
    laborId,
    30,
    2,
    [
      j("1", 0.5, "劳", 0.78),
      j("1", 0.25, "动", 0.78),
      j("2", 0.25, "的", 0.78),
      j("3", 0.5, "快"),
      j("5", 0.5, "乐"),
    ],
    "Bb",
  ),
  makeMeasure(
    laborId,
    31,
    2,
    [
      j("1'", 0.5, "说"),
      j("5", 0.5, "不"),
      j("6", 1, "尽", 0.9, true),
    ],
    "F",
  ),
  makeMeasure(laborId, 32, 2, [j("6", 2)], "F", true),
  makeMeasure(
    laborId,
    33,
    2,
    [j("5", 0.5, "劳"), j("6", 0.5, "动"), j("1'", 1, "创")],
    "Bb",
  ),
  makeMeasure(
    laborId,
    34,
    2,
    [j("3'", 1, "造"), j("2'", 0.5, "最"), j("5", 0.5, "光")],
    "F",
  ),
  makeMeasure(laborId, 35, 2, [j("1'", 2, "荣")], "Bb", true),
];

const laborSong: SongModel = {
  id: laborId,
  title: "劳动最光荣",
  subtitle: "原谱降 B 大调 · 动画片《小猫钓鱼》主题歌",
  key: "Bb",
  tonicMidi: laborTonic,
  timeSignature: { beats: 2, beatType: 4 },
  tempo: 118,
  suggestedTempo: "♩ = 118 · 活泼、愉快、健康地",
  measures: laborMeasures,
  source: {
    imagePath: "/劳动最光荣.gif",
    notation: "jianpu",
    overallConfidence: 0.9,
    coverage: "完整页面，35 小节",
    attribution: "动画片《小猫钓鱼》主题歌",
    recognizer: "人工转录 + 独立整页复核",
    verificationStatus: "manual-required",
    notes: [
      "原图调号为 1=♭B；谱面、播放、键盘和导出均保留原调，不再由外部参考曲改写。",
      "参考页面仅用于速度参考（约 ♩=118），不用于覆盖原谱的调号、八度或音序。",
      "已按数字、点位、下划线、连线和歌词中心位置独立复核全部 35 小节。",
      "附点按时值记谱；只有数字正上方的圆点表示高八度。",
    ],
  },
};

export const SAMPLE_SONGS = [
  recommendFingering(happySong),
  recommendFingering(laborSong),
];

export function createBlankSong(imagePath: string, title = "待校对的新乐谱"): SongModel {
  const measures = Array.from({ length: 4 }, (_, index) =>
    makeMeasure("manual", index + 1, 4, []),
  );
  return {
    id: `manual-${Date.now()}`,
    title,
    subtitle: "手动校对模式",
    key: "C",
    tonicMidi: pitchNameToMidi("C4"),
    timeSignature: { beats: 4, beatType: 4 },
    tempo: 80,
    suggestedTempo: "♩ = 80",
    measures,
    source: {
      imagePath,
      notation: "manual",
      overallConfidence: 0,
      coverage: "未识别",
      attribution: "本地临时图片",
      recognizer: "正式识别服务尚未返回结果",
      verificationStatus: "manual-required",
      notes: [
        "请对照原谱逐音检查自动识别结果。",
        "可以添加、删除、修改或复位任意音符。",
      ],
    },
  };
}
