import { useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import type {
  ChordAssignment,
  MeasureModel,
  PerformanceEvent,
  SongModel,
} from "../types";
import {
  keyPrefersFlats,
  midiToJianpu,
  midiToPitchName,
} from "../core/theory";
import type { A4LayoutPlan } from "../layout/types";

interface JianpuScoreProps {
  song: SongModel;
  harmony: ChordAssignment[];
  timeline: PerformanceEvent[];
  selectedEventId: string | null;
  selectedMeasure: number;
  currentMeasure: number;
  activeSourceIds: Set<string>;
  layoutPlan: A4LayoutPlan;
  followPlayback: boolean;
  playbackActive: boolean;
  onSelectEvent: (eventId: string, measureNumber: number) => void;
  onSelectMeasure: (measureNumber: number) => void;
  onSuspendFollow: () => void;
}

function OctaveDots({ shift }: { shift: number }) {
  if (shift === 0) return <span className="octave-dots placeholder">·</span>;
  return (
    <span className={`octave-dots ${shift > 0 ? "above" : "below"}`}>
      {"•".repeat(Math.min(2, Math.abs(shift)))}
    </span>
  );
}

function durationClass(duration: number): string {
  if (duration <= 0.25) return "duration-sixteenth";
  if (duration <= 0.5) return "duration-eighth";
  return "";
}

function SustainMarks({ duration }: { duration: number }) {
  const marks = Math.max(0, Math.min(3, Math.round(duration) - 1));
  if (marks === 0) return null;
  return <span className="sustain-marks">{"—".repeat(marks)}</span>;
}

export function JianpuScore({
  song,
  harmony,
  timeline,
  selectedEventId,
  selectedMeasure,
  currentMeasure,
  activeSourceIds,
  layoutPlan,
  followPlayback,
  playbackActive,
  onSelectEvent,
  onSelectMeasure,
  onSuspendFollow,
}: JianpuScoreProps) {
  const systemRefs = useRef(new Map<string, HTMLDivElement>());
  const followedSystemIdRef = useRef<string | null>(null);
  const measuresByNumber = useMemo(
    () => new Map(song.measures.map((measure) => [measure.number, measure])),
    [song.measures],
  );

  useEffect(() => {
    if (!followPlayback || !playbackActive) {
      followedSystemIdRef.current = null;
      return;
    }
    const activeSystem = layoutPlan.pages
      .flatMap((page) => page.systems)
      .find((system) =>
        system.measures.some(
          (measure) => measure.measureNumber === currentMeasure,
        ),
      );
    if (!activeSystem) return;
    if (followedSystemIdRef.current === activeSystem.id) return;
    followedSystemIdRef.current = activeSystem.id;
    const frame = requestAnimationFrame(() => {
      systemRefs.current.get(activeSystem.id)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [currentMeasure, followPlayback, layoutPlan, playbackActive]);

  const renderMeasure = (measure: MeasureModel) => {
    const chord = harmony.find(
      (item) => item.measureNumber === measure.number,
    );
    const leftNotes = timeline
      .filter(
        (event) =>
          event.measureNumber === measure.number && event.hand === "left",
      )
      .map((event) =>
        midiToPitchName(event.midi, keyPrefersFlats(song.key)),
      );
    const uniqueLeftNotes = [...new Set(leftNotes)];
    const isCurrent = currentMeasure === measure.number;
    const isSelected = selectedMeasure === measure.number;

    return (
      <section
        className={[
          "measure",
          measure.number <= 0 ? "pickup" : "",
          isCurrent ? "current" : "",
          isSelected ? "selected" : "",
        ].join(" ")}
        key={measure.id}
        onClick={() => onSelectMeasure(measure.number)}
        aria-label={`第 ${measure.number} 小节`}
      >
        <header className="measure-header">
          <span>{measure.number === 0 ? "弱起" : `第 ${measure.number} 小节`}</span>
          {chord ? (
            <button
              className={`chord-chip ${chord.locked ? "locked" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                onSelectMeasure(measure.number);
              }}
              type="button"
            >
              {chord.symbol}
              {chord.locked ? " · 已锁" : ""}
            </button>
          ) : (
            <span className="chord-placeholder">—</span>
          )}
        </header>

        <div className="notes-line">
          {measure.events.map((event) => {
            const jianpu =
              event.midi === null ? null : midiToJianpu(event.midi, song);
            const style = {
              "--note-width": Math.max(0.8, event.durationBeats),
            } as CSSProperties;
            return (
              <button
                className={[
                  "score-note",
                  durationClass(event.durationBeats),
                  event.id === selectedEventId ? "selected" : "",
                  activeSourceIds.has(event.id) ? "active" : "",
                  event.confidence < 0.8 ? "low-confidence" : "",
                ].join(" ")}
                key={event.id}
                style={style}
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation();
                  onSelectEvent(event.id, measure.number);
                }}
                type="button"
                title={
                  event.midi === null
                    ? "休止符"
                    : `${midiToPitchName(event.midi, keyPrefersFlats(song.key))} · 置信度 ${Math.round(event.confidence * 100)}%`
                }
              >
                <span className="finger-number">
                  {event.midi === null ? "" : event.finger ?? "?"}
                  {event.fingerLocked ? <sup>⌕</sup> : null}
                </span>
                <span className="note-glyph">
                  {jianpu ? (
                    <>
                      <OctaveDots shift={jianpu.octaveShift} />
                      <span className="degree">
                        {jianpu.accidental === 1
                          ? "♯"
                          : jianpu.accidental === -1
                            ? "♭"
                            : ""}
                        {jianpu.degree}
                      </span>
                      <OctaveDots shift={-jianpu.octaveShift} />
                    </>
                  ) : (
                    <>
                      <span className="octave-dots placeholder">·</span>
                      <span className="degree rest">0</span>
                      <span className="octave-dots placeholder">·</span>
                    </>
                  )}
                </span>
                <SustainMarks duration={event.durationBeats} />
                <span className="lyric">{event.lyric ?? "\u00a0"}</span>
                {event.confidence < 0.8 ? (
                  <span className="confidence-flag">
                    {Math.round(event.confidence * 100)}%
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <footer className="left-hand-line">
          <span>左手</span>
          <strong>{chord?.symbol ?? "弱起"}</strong>
          <small>{uniqueLeftNotes.join(" · ") || "—"}</small>
        </footer>
      </section>
    );
  };

  return (
    <div
      className="score-scroll"
      aria-label="A4 彩色数字简谱"
      onPointerDown={onSuspendFollow}
      onWheel={onSuspendFollow}
    >
      <div className="score-pages">
        {layoutPlan.pages.map((page) => (
          <article className="score-paper a4-page" key={page.id}>
            {page.pageNumber === 1 ? (
              <div className="score-title-row">
                <div>
                  <p className="eyebrow">ScoreToKeys Kids · 校对后生成</p>
                  <h2>{song.title}</h2>
                  <p>{song.subtitle}</p>
                </div>
                <div className="score-meta">
                  <span>1={song.key}</span>
                  <span>
                    {song.timeSignature.beats}/{song.timeSignature.beatType}
                  </span>
                  <span>{song.suggestedTempo}</span>
                </div>
              </div>
            ) : (
              <div className="score-continuation">
                <strong>{song.title}</strong>
                <span>续页</span>
              </div>
            )}

            <div className="measure-systems">
              {page.systems.map((system) => {
                const measures = system.measures.map((item) => {
                  const measure = measuresByNumber.get(item.measureNumber);
                  if (!measure) {
                    throw new Error(
                      `A4 页面引用了不存在的第 ${item.measureNumber} 小节。`,
                    );
                  }
                  return measure;
                });
                const gridTemplateColumns = system.measures
                  .map(
                    (measure) =>
                      `minmax(0, ${measure.columnWeight}fr)`,
                  )
                  .join(" ");

                return (
                  <div
                    className={[
                      "score-system",
                      measures.some((measure) => measure.number <= 0)
                        ? "has-pickup"
                        : "",
                      measures.some(
                        (measure) => measure.number === currentMeasure,
                      )
                        ? "current-system"
                        : "",
                    ].join(" ")}
                    data-system-id={system.id}
                    key={system.id}
                    ref={(element) => {
                      if (element) systemRefs.current.set(system.id, element);
                      else systemRefs.current.delete(system.id);
                    }}
                    style={{ gridTemplateColumns }}
                  >
                    {measures.map(renderMeasure)}
                  </div>
                );
              })}
            </div>

            <div className="score-legend">
              <span>
                <i className="legend-dot right" /> 右手旋律与指法
              </span>
              <span>
                <i className="legend-dot left" /> 左手伴奏
              </span>
              <span>
                <i className="legend-dot uncertain" /> 待人工确认
              </span>
            </div>
            <small className="page-number">
              {page.pageNumber} / {layoutPlan.pages.length}
            </small>
          </article>
        ))}
      </div>
    </div>
  );
}
