import { useMemo, useRef, useState } from "react";
import type {
  AccompanimentMode,
  ChordOverrides,
  PerformanceEvent,
  ScoreEvent,
  SongModel,
} from "./types";
import { ArrangementPanel } from "./components/ArrangementPanel";
import { JianpuScore } from "./components/JianpuScore";
import { PianoKeyboard } from "./components/PianoKeyboard";
import { SourceReview } from "./components/SourceReview";
import {
  buildPerformanceTimeline,
  harmonize,
  recommendFingering,
} from "./core/arrangement";
import {
  createMidiFile,
  createMusicXml,
  createTimelineJson,
} from "./core/exporters";
import {
  cloneSong,
  getLowConfidenceEvents,
  getMeasureAtBeat,
  getMeasureSpans,
  getTotalBeats,
  relayoutEvents,
  validateSong,
} from "./core/model";
import { keyPrefersFlats, midiToPitchName } from "./core/theory";
import { createBlankSong, SAMPLE_SONGS } from "./data/samples";
import { usePracticePlayer } from "./hooks/usePracticePlayer";
import { createA4LayoutPlan } from "./layout/createA4LayoutPlan";
import { SOURCE_LAYOUT_HINTS } from "./layout/sourceLayoutHints";
import type { LayoutMode } from "./layout/types";

const SPEEDS = [0.25, 0.5, 0.75, 1] as const;

function safeFileName(value: string): string {
  return value.replace(/[<>:"/\\|?*]+/g, "-").trim() || "piano-score";
}

function downloadBlob(fileName: string, content: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function formatClock(seconds: number): string {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

function firstEditableMeasure(song: SongModel): number {
  return song.measures.find((measure) => measure.number > 0)?.number ?? 1;
}

export default function App() {
  const initialSong = useMemo(() => cloneSong(SAMPLE_SONGS[0]), []);
  const [song, setSong] = useState(initialSong);
  const [selectedMeasure, setSelectedMeasure] = useState(firstEditableMeasure(initialSong));
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    initialSong.measures.find(
      (measure) => measure.number === firstEditableMeasure(initialSong),
    )?.events[0]?.id ?? null,
  );
  const [confirmed, setConfirmed] = useState(false);
  const [mode, setMode] = useState<AccompanimentMode>("root-fifth");
  const [chordOverrides, setChordOverrides] = useState<ChordOverrides>({});
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(0.75);
  const [rightEnabled, setRightEnabled] = useState(true);
  const [leftEnabled, setLeftEnabled] = useState(true);
  const [metronome, setMetronome] = useState(false);
  const [loopMeasure, setLoopMeasure] = useState(false);
  const [layoutMode, setLayoutMode] =
    useState<LayoutMode>("source-faithful");
  const [followScore, setFollowScore] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const uploadedImageUrlRef = useRef<string | null>(null);

  const harmony = useMemo(
    () => harmonize(song, chordOverrides),
    [song, chordOverrides],
  );
  const timeline = useMemo(
    () => buildPerformanceTimeline(song, harmony, mode),
    [song, harmony, mode],
  );
  const measureSpans = useMemo(() => getMeasureSpans(song), [song]);
  const measureStarts = useMemo(
    () => measureSpans.map((span) => span.startBeat),
    [measureSpans],
  );
  const totalBeats = useMemo(() => getTotalBeats(song), [song]);
  const layoutPlan = useMemo(
    () =>
      createA4LayoutPlan(song, {
        mode: layoutMode,
        sourceHint: SOURCE_LAYOUT_HINTS[song.id],
      }),
    [layoutMode, song],
  );
  const loopSpan = useMemo(
    () =>
      loopMeasure
        ? measureSpans.find((span) => span.number === selectedMeasure) ?? null
        : null,
    [loopMeasure, measureSpans, selectedMeasure],
  );

  const player = usePracticePlayer({
    events: timeline,
    totalBeats,
    tempo: song.tempo,
    speed,
    rightEnabled,
    leftEnabled,
    metronome,
    measureStarts,
    loopSpan,
    enabled: confirmed,
  });

  const selectedEvent =
    song.measures
      .flatMap((measure) => measure.events)
      .find((event) => event.id === selectedEventId) ?? null;
  const currentMeasure = getMeasureAtBeat(song, player.positionBeat);
  const activeEvents = timeline.filter((event) => {
    const voiceEnabled = event.hand === "right" ? rightEnabled : leftEnabled;
    return (
      voiceEnabled &&
      player.positionBeat >= event.startBeat &&
      player.positionBeat < event.startBeat + event.durationBeats
    );
  });
  const activeSourceIds = new Set(
    activeEvents.flatMap((event) => (event.sourceEventId ? [event.sourceEventId] : [])),
  );

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => {
      setToast((current) => (current === message ? null : current));
    }, 2600);
  };

  const resetForSong = (nextSong: SongModel) => {
    player.stop();
    const cloned = cloneSong(nextSong);
    const measure = firstEditableMeasure(cloned);
    setSong(cloned);
    setSelectedMeasure(measure);
    setSelectedEventId(
      cloned.measures.find((item) => item.number === measure)?.events[0]?.id ??
        cloned.measures.flatMap((item) => item.events)[0]?.id ??
        null,
    );
    setChordOverrides({});
    setConfirmed(false);
    setLoopMeasure(false);
    setFollowScore(true);
  };

  const handleSelectSample = (songId: string) => {
    const sample = SAMPLE_SONGS.find((item) => item.id === songId);
    if (!sample) return;
    resetForSong(sample);
    showToast("已载入预识别结果，请先对照原谱校对。");
  };

  const handleUpload = (file: File) => {
    const knownSample = SAMPLE_SONGS.find((sample) =>
      decodeURIComponent(sample.source.imagePath)
        .toLocaleLowerCase()
        .endsWith(file.name.toLocaleLowerCase()),
    );
    if (knownSample) {
      resetForSong(knownSample);
      showToast("已命中本地预识别 fixture。");
      return;
    }

    if (uploadedImageUrlRef.current) {
      URL.revokeObjectURL(uploadedImageUrlRef.current);
    }
    const imageUrl = URL.createObjectURL(file);
    uploadedImageUrlRef.current = imageUrl;
    resetForSong(createBlankSong(imageUrl, file.name.replace(/\.[^.]+$/, "")));
    showToast("此图片没有预识别结果，已进入手动校对模式。");
  };

  const patchSelectedEvent = (patch: Partial<ScoreEvent>) => {
    if (!selectedEventId) return;
    setSong((current) => ({
      ...current,
      measures: current.measures.map((measure) => {
        if (!measure.events.some((event) => event.id === selectedEventId)) return measure;
        const events = measure.events.map((event) =>
          event.id === selectedEventId ? { ...event, ...patch } : event,
        );
        return "durationBeats" in patch
          ? relayoutEvents(measure, events)
          : { ...measure, events };
      }),
    }));
  };

  const addNote = () => {
    const eventId = `${song.id}-manual-${Date.now()}`;
    let added = false;
    setSong((current) => ({
      ...current,
      measures: current.measures.map((measure) => {
        if (measure.number !== selectedMeasure) return measure;
        const used = measure.events.reduce(
          (end, event) => Math.max(end, event.offsetBeats + event.durationBeats),
          0,
        );
        const remaining = measure.durationBeats - used;
        if (remaining <= 0.0001) return measure;
        added = true;
        return {
          ...measure,
          events: [
            ...measure.events,
            {
              id: eventId,
              offsetBeats: used,
              durationBeats: Math.min(1, remaining),
              midi: current.tonicMidi,
              confidence: 1,
              finger: 1,
              fingerLocked: false,
            },
          ],
        };
      }),
    }));
    window.setTimeout(() => {
      if (added) {
        setSelectedEventId(eventId);
      } else {
        showToast("当前小节已满，请先缩短或删除音符。");
      }
    }, 0);
  };

  const deleteNote = () => {
    if (!selectedEventId) return;
    setSong((current) => ({
      ...current,
      measures: current.measures.map((measure) => {
        if (!measure.events.some((event) => event.id === selectedEventId)) return measure;
        return relayoutEvents(
          measure,
          measure.events.filter((event) => event.id !== selectedEventId),
        );
      }),
    }));
    setSelectedEventId(null);
  };

  const goToNextLowConfidence = () => {
    const lowEvents = getLowConfidenceEvents(song);
    if (lowEvents.length === 0) {
      showToast("所有低置信度音符都已确认。");
      return;
    }
    const currentIndex = lowEvents.findIndex((event) => event.id === selectedEventId);
    const next = lowEvents[(currentIndex + 1) % lowEvents.length];
    const measure = song.measures.find((item) =>
      item.events.some((event) => event.id === next.id),
    );
    setSelectedEventId(next.id);
    if (measure) setSelectedMeasure(measure.number);
  };

  const confirmReview = () => {
    const issues = validateSong(song);
    const errors = issues.filter((issue) => issue.level === "error");
    const noteCount = song.measures.flatMap((measure) => measure.events).filter(
      (event) => event.midi !== null,
    ).length;
    if (errors.length > 0) {
      showToast(errors[0].message);
      return;
    }
    if (noteCount === 0) {
      showToast("至少添加一个音符后才能生成教学谱。");
      return;
    }
    setSong((current) => recommendFingering(current));
    setConfirmed(true);
    setFollowScore(true);
    showToast(
      getLowConfidenceEvents(song).length > 0
        ? "已按人工决定生成；橙色位置仍保留提示。"
        : "校对已确认，双手教学谱已生成。",
    );
  };

  const recomputeFingering = () => {
    setSong((current) => recommendFingering(current));
    showToast("已重算未锁定指法，锁定项保持不变。");
  };

  const updateChord = (measure: number, symbol: string) => {
    setChordOverrides((current) => ({
      ...current,
      [String(measure)]: { symbol, locked: true },
    }));
  };

  const updateChordLock = (measure: number, locked: boolean) => {
    const currentChord = harmony.find((item) => item.measureNumber === measure);
    if (!currentChord) return;
    setChordOverrides((current) => ({
      ...current,
      [String(measure)]: { symbol: currentChord.symbol, locked },
    }));
  };

  const reharmonize = () => {
    setChordOverrides((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([, override]) => override.locked),
      ),
    );
    showToast("已重新编配；锁定和弦保持不变。");
  };

  const exportTimeline = () => {
    if (!confirmed) return;
    downloadBlob(
      `${safeFileName(song.title)}-timeline.json`,
      createTimelineJson(song, timeline, harmony),
      "application/json;charset=utf-8",
    );
  };

  const exportMidi = () => {
    if (!confirmed) return;
    downloadBlob(
      `${safeFileName(song.title)}-${Math.round(speed * 100)}pct.mid`,
      createMidiFile(song, timeline, speed),
      "audio/midi",
    );
  };

  const exportMusicXml = () => {
    if (!confirmed) return;
    const practiceSong = { ...song, tempo: Math.round(song.tempo * speed) };
    downloadBlob(
      `${safeFileName(song.title)}-${Math.round(speed * 100)}pct.musicxml`,
      createMusicXml(practiceSong, timeline, harmony),
      "application/vnd.recordare.musicxml+xml;charset=utf-8",
    );
  };

  const elapsedSeconds = (player.positionBeat * 60) / song.tempo / speed;
  const totalSeconds = (totalBeats * 60) / song.tempo / speed;
  const activeRight = activeEvents.find((event) => event.hand === "right");
  const activeLeft = activeEvents.find((event) => event.hand === "left");

  return (
    <>
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">
            <span>♪</span>
            <i />
          </div>
          <div>
            <strong>ScoreToKeys Kids</strong>
            <small>Read · Verify · Play</small>
          </div>
        </div>
        <nav className="workflow-nav" aria-label="工作流程">
          <span className="active"><i>1</i>识谱校对</span>
          <b>→</b>
          <span className={confirmed ? "active" : ""}><i>2</i>智能编配</span>
          <b>→</b>
          <span className={confirmed ? "active" : ""}><i>3</i>跟弹练习</span>
        </nav>
        <div className="header-actions">
          <span className="local-badge">● 正式项目 · fixture 开发模式</span>
          <details className="export-menu">
            <summary aria-disabled={!confirmed}>导出 ▾</summary>
            <div>
              <button disabled={!confirmed} onClick={exportMidi} type="button">
                <strong>MIDI</strong><small>当前速度 · 双手时间线</small>
              </button>
              <button disabled={!confirmed} onClick={exportMusicXml} type="button">
                <strong>MusicXML</strong><small>双声部与指法</small>
              </button>
              <button disabled={!confirmed} onClick={exportTimeline} type="button">
                <strong>JSON</strong><small>统一事件模型</small>
              </button>
              <button
                disabled={!confirmed}
                onClick={() => window.print()}
                type="button"
              >
                <strong>打印 / PDF</strong><small>浏览器打印彩色简谱</small>
              </button>
            </div>
          </details>
        </div>
      </header>

      <main className="app-main">
        <section className="hero">
          <div>
            <span className="hero-badge">ScoreToKeys Kids · 从乐谱到琴键</span>
            <h1>看得懂每个音，<em>跟得上每根手指。</em></h1>
            <p>
              AI 只负责给出可校对的初稿；确认后的谱面、声音、键盘动画和导出文件
              全部来自同一份演奏数据。
            </p>
          </div>
          <div className="hero-principles">
            <span><strong>01</strong>先校对</span>
            <span><strong>02</strong>可锁定</span>
            <span><strong>03</strong>严格同步</span>
          </div>
        </section>

        <SourceReview
          confirmed={confirmed}
          onAddNote={addNote}
          onConfirm={confirmReview}
          onDeleteNote={deleteNote}
          onEventPatch={patchSelectedEvent}
          onNextLowConfidence={goToNextLowConfidence}
          onSelectSample={handleSelectSample}
          onUpload={handleUpload}
          samples={SAMPLE_SONGS}
          selectedEvent={selectedEvent}
          selectedMeasure={selectedMeasure}
          song={song}
        />

        <ArrangementPanel
          confirmed={confirmed}
          harmony={harmony}
          mode={mode}
          onChordChange={updateChord}
          onChordLockChange={updateChordLock}
          onModeChange={setMode}
          onRecomputeFingering={recomputeFingering}
          onReharmonize={reharmonize}
          onSelectMeasure={setSelectedMeasure}
          selectedMeasure={selectedMeasure}
          song={song}
        />

        <section
          className={`card score-card ${confirmed ? "" : "gated"}`}
          id="score-section"
        >
          <header className="card-header">
            <div>
              <p className="step-kicker">STEP 3 · 彩色教学谱</p>
              <h2>谱面与演奏时间线一一对应</h2>
            </div>
            <div className="score-actions">
              <label className="layout-mode-control">
                版式
                <select
                  disabled={!confirmed}
                  onChange={(event) => {
                    const mode = event.target.value;
                    if (mode === "source-faithful" || mode === "practice") {
                      setLayoutMode(mode);
                    }
                  }}
                  value={layoutMode}
                >
                  <option value="source-faithful">原稿 A4</option>
                  <option value="practice">放大练习</option>
                </select>
              </label>
              <button
                disabled={!confirmed}
                onClick={() => setFollowScore((current) => !current)}
                type="button"
              >
                {followScore ? "自动跟随：开" : "继续跟随"}
              </button>
              <button disabled={!confirmed} onClick={() => window.print()} type="button">
                打印 / PDF
              </button>
            </div>
          </header>
          <JianpuScore
            activeSourceIds={activeSourceIds}
            currentMeasure={currentMeasure}
            followPlayback={followScore}
            harmony={harmony}
            layoutPlan={layoutPlan}
            onSelectEvent={(eventId, measure) => {
              setSelectedEventId(eventId);
              setSelectedMeasure(measure);
            }}
            onSelectMeasure={setSelectedMeasure}
            onSuspendFollow={() => setFollowScore(false)}
            playbackActive={player.status === "playing"}
            selectedEventId={selectedEventId}
            selectedMeasure={selectedMeasure}
            song={song}
            timeline={timeline}
          />
        </section>

        <section className={`card practice-card ${confirmed ? "" : "gated"}`}>
          <header className="practice-header">
            <div>
              <p className="step-kicker">STEP 4 · 同步跟弹练习</p>
              <h2>{song.title}</h2>
              <p>
                第 {currentMeasure} 小节 · {Math.round(song.tempo * speed)} BPM
              </p>
            </div>
            <div className="now-playing">
              <div className="voice-readout right">
                <span>右手</span>
                <strong>
                  {activeRight
                    ? `${midiToPitchName(activeRight.midi, keyPrefersFlats(song.key))} · ${activeRight.finger} 指`
                    : "等待"}
                </strong>
              </div>
              <div className="voice-readout left">
                <span>左手</span>
                <strong>
                  {activeLeft
                    ? `${activeLeft.chord ?? midiToPitchName(activeLeft.midi, true)} · ${activeLeft.finger} 指`
                    : "等待"}
                </strong>
              </div>
            </div>
          </header>

          <PianoKeyboard
            activeEvents={activeEvents}
            leftEnabled={leftEnabled}
            rightEnabled={rightEnabled}
          />

          <div className="transport">
            <div className="transport-primary">
              <button
                className="stop-button"
                disabled={!confirmed}
                onClick={player.stop}
                type="button"
                title="停止"
              >
                ■
              </button>
              <button
                className="play-button"
                disabled={!confirmed}
                onClick={player.toggle}
                type="button"
              >
                {player.status === "playing" ? "Ⅱ" : "▶"}
              </button>
              <div className="timeline-control">
                <input
                  disabled={!confirmed}
                  max={totalBeats}
                  min="0"
                  onChange={(event) => player.seek(Number(event.target.value))}
                  step="0.01"
                  type="range"
                  value={player.positionBeat}
                />
                <div>
                  <span>{formatClock(elapsedSeconds)}</span>
                  <span>{formatClock(totalSeconds)}</span>
                </div>
              </div>
            </div>

            <div className="practice-options">
              <div className="option-group speed-options">
                <span>速度</span>
                <div>
                  {SPEEDS.map((option) => (
                    <button
                      className={speed === option ? "active" : ""}
                      disabled={!confirmed}
                      key={option}
                      onClick={() => setSpeed(option)}
                      type="button"
                    >
                      {Math.round(option * 100)}%
                    </button>
                  ))}
                </div>
              </div>
              <div className="option-group voice-options">
                <span>声部</span>
                <div>
                  <button
                    className={rightEnabled ? "active right" : ""}
                    disabled={!confirmed}
                    onClick={() => setRightEnabled((value) => !value)}
                    type="button"
                  >
                    右手
                  </button>
                  <button
                    className={leftEnabled ? "active left" : ""}
                    disabled={!confirmed}
                    onClick={() => setLeftEnabled((value) => !value)}
                    type="button"
                  >
                    左手
                  </button>
                </div>
              </div>
              <div className="option-group toggle-options">
                <label>
                  <input
                    checked={metronome}
                    disabled={!confirmed}
                    onChange={(event) => setMetronome(event.target.checked)}
                    type="checkbox"
                  />
                  <span />
                  节拍器
                </label>
                <label>
                  <input
                    checked={loopMeasure}
                    disabled={!confirmed}
                    onChange={(event) => setLoopMeasure(event.target.checked)}
                    type="checkbox"
                  />
                  <span />
                  循环第 {selectedMeasure} 小节
                </label>
              </div>
            </div>
          </div>

          {player.error ? (
            <div className="audio-error" role="alert">
              <span>!</span>
              {player.error}
              <button onClick={player.clearError} type="button">关闭</button>
            </div>
          ) : null}
        </section>

        <footer className="app-footer">
          <p>
            <strong>POC 边界：</strong>
            两份测试图使用开发期多模态预识别 fixture；未知图片进入手动校对，不伪造在线识别结果。
          </p>
          <span>统一模型 → 简谱 → Web Audio → 动画 → MIDI / MusicXML / JSON</span>
        </footer>
      </main>

      {toast ? <div className="toast" role="status">✓ {toast}</div> : null}
    </>
  );
}
