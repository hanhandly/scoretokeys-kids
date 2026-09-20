import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
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
import { REVIEW_CONFIDENCE_THRESHOLD } from "../core/model";
import { useI18n } from "../i18n/I18nProvider";
import { formatAccidentals } from "../i18n/messages";
import { calculateFollowScroll } from "../layout/followScroll";
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
  variant?: "practice" | "review";
}

function OctaveDots({
  count,
  position,
}: {
  count: number;
  position: "above" | "below";
}) {
  if (count === 0) return <span className="octave-dots placeholder">·</span>;
  return (
    <span className={`octave-dots ${position}`}>
      {"•".repeat(Math.min(2, count))}
    </span>
  );
}

function durationClass(duration: number): string {
  if (duration <= 0.25) return "duration-sixteenth";
  if (duration <= 0.5) return "duration-eighth";
  if (Math.abs(duration - 0.75) < 0.0001) {
    return "duration-eighth duration-dotted";
  }
  if (Math.abs(duration - 1.5) < 0.0001) return "duration-dotted";
  return "";
}

function SustainMarks({ duration }: { duration: number }) {
  const wholeBeats = Math.floor(duration + 0.0001);
  const dashes = Math.max(0, Math.min(3, wholeBeats - 1));
  if (dashes === 0) return null;
  return <span className="sustain-marks">{"—".repeat(dashes)}</span>;
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
  variant = "practice",
}: JianpuScoreProps) {
  const { t } = useI18n();
  const viewportRef = useRef<HTMLDivElement>(null);
  const systemRefs = useRef(new Map<string, HTMLDivElement>());
  const eventRefs = useRef(new Map<string, HTMLButtonElement>());
  const followedSystemIdRef = useRef<string | null>(null);
  const measuresByNumber = useMemo(
    () => new Map(song.measures.map((measure) => [measure.number, measure])),
    [song.measures],
  );
  const activeSourceId = activeSourceIds.values().next().value as
    | string
    | undefined;

  useLayoutEffect(() => {
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
      const target = activeSourceId
        ? eventRefs.current.get(activeSourceId)
        : systemRefs.current.get(activeSystem.id);
      const targetKey = activeSourceId ?? activeSystem.id;
      if (!target || followedSystemIdRef.current === targetKey) return;
      followedSystemIdRef.current = targetKey;
      const frame = requestAnimationFrame(() => {
        const viewport = viewportRef.current;
        if (!viewport || !target) return;
        const viewportRect = viewport.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const nextScroll = calculateFollowScroll(
          {
            scrollTop: viewport.scrollTop,
            scrollLeft: viewport.scrollLeft,
            width: viewport.clientWidth,
            height: viewport.clientHeight,
          },
          {
            top: targetRect.top - viewportRect.top,
            bottom: targetRect.bottom - viewportRect.top,
            left: targetRect.left - viewportRect.left,
            right: targetRect.right - viewportRect.left,
          },
        );
        if (
          nextScroll.top === viewport.scrollTop &&
          nextScroll.left === viewport.scrollLeft
        ) {
          return;
        }
        viewport.scrollTo({
          behavior: "auto",
          left: nextScroll.left,
          top: nextScroll.top,
        });
      });
      return () => cancelAnimationFrame(frame);
  }, [
      activeSourceId,
      currentMeasure,
      followPlayback,
      layoutPlan,
      playbackActive,
  ]);

  useEffect(() => {
    if (variant !== "review" || !selectedEventId) return;
    const viewport = viewportRef.current;
    const note = eventRefs.current.get(selectedEventId);
    if (!viewport || !note) return;
    const frame = requestAnimationFrame(() => {
      const viewportRect = viewport.getBoundingClientRect();
      const noteRect = note.getBoundingClientRect();
      const targetTop =
        viewport.scrollTop +
        noteRect.top -
        viewportRect.top -
        viewport.clientHeight * 0.38;
      const targetLeft =
        viewport.scrollLeft +
        noteRect.left -
        viewportRect.left -
        viewport.clientWidth * 0.45;
      viewport.scrollTo({
        behavior: "smooth",
        left: Math.max(0, targetLeft),
        top: Math.max(0, targetTop),
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [layoutPlan, selectedEventId, variant]);

  const sourceFaithful = layoutPlan.mode === "source-faithful";
  const showRecognitionConfidence = variant === "review";
  const measureName = (number: number) =>
    number <= 0
      ? t("music.pickup")
      : t("music.measure", { number });

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
        formatAccidentals(
          midiToPitchName(event.midi, keyPrefersFlats(song.key)),
        ),
      );
    const uniqueLeftNotes = [...new Set(leftNotes)];
    const isCurrent = currentMeasure === measure.number;
    const isSelected = selectedMeasure === measure.number;

    return (
      <div
        className={[
          "measure",
          measure.number <= 0 ? "pickup" : "",
          isCurrent ? "current" : "",
          isSelected ? "selected" : "",
        ].join(" ")}
        key={measure.id}
        aria-label={measureName(measure.number)}
      >
        {!sourceFaithful ? <header className="measure-header">
          <span>{measureName(measure.number)}</span>
          {chord ? (
            <button
              className={`chord-chip ${chord.locked ? "locked" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                onSelectMeasure(measure.number);
              }}
              type="button"
            >
              {formatAccidentals(chord.symbol)}
              {chord.locked ? t("score.chordLocked") : ""}
            </button>
          ) : (
            <span className="chord-placeholder">—</span>
          )}
        </header> : null}

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
                  variant === "review" && event.id === selectedEventId
                    ? "selected"
                    : "",
                  activeSourceIds.has(event.id) ? "active" : "",
                  event.slurToNext ? "slur-to-next" : "",
                  showRecognitionConfidence &&
                  event.confidence < REVIEW_CONFIDENCE_THRESHOLD
                    ? "low-confidence"
                    : "",
                ].join(" ")}
                key={event.id}
                ref={(element) => {
                  if (element) eventRefs.current.set(event.id, element);
                  else eventRefs.current.delete(event.id);
                }}
                style={style}
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation();
                  onSelectEvent(event.id, measure.number);
                }}
                type="button"
                title={
                  event.midi === null
                    ? t("score.rest")
                    : t("score.noteDetails", {
                        pitch: formatAccidentals(
                          midiToPitchName(
                            event.midi,
                            keyPrefersFlats(song.key),
                          ),
                        ),
                        confidence: Math.round(event.confidence * 100),
                      })
                }
              >
                <span className="finger-number">
                  {event.midi === null ? "" : event.finger ?? "?"}
                  {event.fingerLocked ? <sup>⌕</sup> : null}
                </span>
                <span className="note-glyph">
                  {jianpu ? (
                    <>
                      <OctaveDots
                        count={Math.max(0, jianpu.octaveShift)}
                        position="above"
                      />
                      <span className="degree">
                        {jianpu.accidental === 1
                          ? "♯"
                          : jianpu.accidental === -1
                            ? "♭"
                            : ""}
                        {jianpu.degree}
                      </span>
                      <OctaveDots
                        count={Math.max(0, -jianpu.octaveShift)}
                        position="below"
                      />
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
                {showRecognitionConfidence &&
                event.confidence < REVIEW_CONFIDENCE_THRESHOLD ? (
                  <span className="confidence-flag">
                    {Math.round(event.confidence * 100)}%
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {!sourceFaithful ? <footer className="left-hand-line">
          <span>{t("score.leftHand")}</span>
          <strong>
            {chord ? formatAccidentals(chord.symbol) : t("music.pickup")}
          </strong>
          <small>{uniqueLeftNotes.join(" · ") || "—"}</small>
        </footer> : null}
      </div>
    );
  };

  return (
    <div
      className={`score-scroll ${variant === "review" ? "review-score" : ""}`}
      aria-label={t("score.ariaLabel")}
      onTouchMove={() => {
        if (playbackActive) onSuspendFollow();
      }}
      onWheel={() => {
        if (playbackActive) onSuspendFollow();
      }}
      ref={viewportRef}
      role="region"
    >
      <div className="score-pages">
        {layoutPlan.pages.map((page) => (
          <article
            className={`score-paper a4-page ${sourceFaithful ? "source-faithful" : "practice-layout"}`}
            key={page.id}
          >
            {page.pageNumber === 1 ? (
              <div className="score-title-row">
                <div>
                  <p className="eyebrow">{t("score.eyebrow")}</p>
                  <h2>{song.title}</h2>
                  <p>{song.subtitle}</p>
                </div>
                <div className="score-meta">
                  <span>1={formatAccidentals(song.key)}</span>
                  <span>
                    {song.timeSignature.beats}/{song.timeSignature.beatType}
                  </span>
                  <span>{song.suggestedTempo}</span>
                </div>
              </div>
            ) : (
              <div className="score-continuation">
                <strong>{song.title}</strong>
                <span>{t("score.continued")}</span>
              </div>
            )}

            <div className="measure-systems">
              {page.systems.map((system) => {
                const measures = system.measures.map((item) => {
                  const measure = measuresByNumber.get(item.measureNumber);
                  if (!measure) {
                    throw new Error(
                      t("error.a4MissingMeasure", {
                        number: item.measureNumber,
                      }),
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

            {!sourceFaithful ? <div className="score-legend">
              <span>
                <i className="legend-dot right" /> {t("score.legendRight")}
              </span>
              <span>
                <i className="legend-dot left" /> {t("score.legendLeft")}
              </span>
              <span>
                <i className="legend-dot uncertain" />{" "}
                {t("score.legendPending")}
              </span>
            </div> : null}
            <small className="page-number">
              {page.pageNumber} / {layoutPlan.pages.length}
            </small>
          </article>
        ))}
      </div>
    </div>
  );
}
