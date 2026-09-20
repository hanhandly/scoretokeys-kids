import { useEffect, useRef, useState } from "react";
import type {
  ChordAssignment,
  PerformanceEvent,
  ScoreEvent,
  SessionSong,
  SongModel,
  TeachingGenerationState,
} from "../types";
import {
  getLowConfidenceEvents,
  averageRecognitionConfidence,
} from "../core/model";
import { keyPrefersFlats, midiToPitchName } from "../core/theory";
import { useI18n } from "../i18n/I18nProvider";
import { formatAccidentals } from "../i18n/messages";
import type { TranslationKey } from "../i18n/messages";
import type { A4LayoutPlan } from "../layout/types";
import { JianpuScore } from "./JianpuScore";

interface SourceReviewProps {
  song: SongModel;
  samples: SongModel[];
  sessionSongs: SessionSong[];
  activeSessionSongId: string | null;
  generationState: TeachingGenerationState;
  selectedEvent: ScoreEvent | null;
  selectedMeasure: number;
  selectedEventIndex: number;
  eventCount: number;
  confirmed: boolean;
  harmony: ChordAssignment[];
  timeline: PerformanceEvent[];
  layoutPlan: A4LayoutPlan;
  onSelectSample: (songId: string) => void;
  onSelectSessionSong: (sessionSongId: string) => void;
  onDeleteSessionSong: (sessionSongId: string) => void;
  onUpload: (files: File[]) => void;
  recognitionStatus: "idle" | "reading" | "error";
  recognitionError: string | null;
  onEventPatch: (patch: Partial<ScoreEvent>) => void;
  onNextLowConfidence: () => void;
  onPreviousLowConfidence: () => void;
  onAddNote: () => void;
  onDeleteNote: () => void;
  onResetEvent: () => void;
  onSelectEvent: (eventId: string, measureNumber: number) => void;
  onSelectMeasure: (measureNumber: number) => void;
  onConfirmAll: () => void;
  onConfirm: () => void;
}

const PITCH_OPTIONS = Array.from({ length: 49 }, (_, index) => 48 + index);
const DURATION_OPTIONS = [
  { value: 0.25, labelKey: "duration.sixteenth" },
  { value: 0.5, labelKey: "duration.eighth" },
  { value: 1, labelKey: "duration.quarter" },
  { value: 1.5, labelKey: "duration.dottedQuarter" },
  { value: 2, labelKey: "duration.half" },
  { value: 3, labelKey: "duration.dottedHalf" },
  { value: 4, labelKey: "duration.whole" },
] satisfies Array<{ value: number; labelKey: TranslationKey }>;

const GENERATION_LABELS: Record<
  Exclude<TeachingGenerationState["stage"], "idle" | "error">,
  TranslationKey
> = {
  "validating-score": "generation.validating-score",
  "building-timeline": "generation.building-timeline",
  "verifying-opening": "generation.verifying-opening",
  "preparing-audio": "generation.preparing-audio",
  finalizing: "generation.finalizing",
  ready: "generation.ready",
};

export function SourceReview({
  song,
  samples,
  sessionSongs,
  activeSessionSongId,
  generationState,
  selectedEvent,
  selectedMeasure,
  selectedEventIndex,
  eventCount,
  confirmed,
  harmony,
  timeline,
  layoutPlan,
  onSelectSample,
  onSelectSessionSong,
  onDeleteSessionSong,
  onUpload,
  recognitionStatus,
  recognitionError,
  onEventPatch,
  onNextLowConfidence,
  onPreviousLowConfidence,
  onAddNote,
  onDeleteNote,
  onResetEvent,
  onSelectEvent,
  onSelectMeasure,
  onConfirmAll,
  onConfirm,
}: SourceReviewProps) {
  const { localizeError, localizeSong, plural, t } = useI18n();
  const [zoom, setZoom] = useState(100);
  const [showManualEditor, setShowManualEditor] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lowConfidenceEvents = getLowConfidenceEvents(song);
  const measuredConfidence = averageRecognitionConfidence(song);
  const generationBusy =
    generationState.stage !== "idle" && generationState.stage !== "error";

  useEffect(() => {
    setShowManualEditor(false);
    setQueuedFiles([]);
  }, [song.id]);

  const selectScoreEvent = (eventId: string, measureNumber: number) => {
    setShowManualEditor(true);
    onSelectEvent(eventId, measureNumber);
  };

  return (
    <section
      aria-busy={generationBusy}
      className="card source-card"
    >
      <header className="card-header">
        <div>
          <p className="step-kicker">{t("source.step")}</p>
          <h2>{t("source.heading")}</h2>
        </div>
        <span className={`status-pill ${confirmed ? "confirmed" : "pending"}`}>
          {t(confirmed ? "source.confirmed" : "source.pending")}
        </span>
      </header>

      <div
        className="sample-switcher"
        role="group"
        aria-label={t("source.sampleTabs")}
      >
        {samples.map((sample) => {
          const localizedSample = localizeSong(sample);
          const notationKey: TranslationKey =
            sample.source.notation === "staff"
              ? "source.staffNotation"
              : sample.source.notation === "jianpu"
                ? "source.numberedNotation"
                : "source.manualNotation";
          return (
            <button
              className={song.id === sample.id ? "active" : ""}
              key={sample.id}
              onClick={() => onSelectSample(sample.id)}
              aria-pressed={song.id === sample.id}
              title={localizedSample.title}
              type="button"
            >
              <img src={sample.source.imagePath} alt="" />
              <span>
                <strong>{localizedSample.title}</strong>
                <small>
                  {t(notationKey)} · {t("source.reviewable")}
                </small>
              </span>
            </button>
          );
        })}
        <button
          className="upload-sample"
          disabled={recognitionStatus === "reading"}
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          <span className="upload-icon">＋</span>
          <span>
            <strong>
              {t(
                recognitionStatus === "reading"
                  ? "source.uploadReading"
                  : "source.uploadButton",
              )}
            </strong>
            <small>{t("source.uploadHint")}</small>
          </span>
        </button>
        <input
          accept="image/png,image/jpeg,image/gif,image/webp"
          aria-label={t("source.fileInputLabel")}
          className="visually-hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []).slice(0, 4);
            if (files.length > 0) setQueuedFiles(files);
            event.target.value = "";
          }}
          ref={fileInputRef}
          multiple
          type="file"
        />
      </div>

      {sessionSongs.length > 0 ? (
        <section
          className="session-library"
          aria-label={t("source.sessionLibraryLabel")}
        >
          <div className="session-library-heading">
            <div>
              <strong>{t("source.sessionTitle")}</strong>
              <small>{t("source.sessionHint")}</small>
            </div>
            <span>
              {plural(
                "source.songCount.one",
                "source.songCount.other",
                sessionSongs.length,
              )}
            </span>
          </div>
          <div className="session-song-list">
            {sessionSongs.map((entry) => {
              const localizedEntry = localizeSong(entry.song);
              const statusKey: TranslationKey =
                entry.status === "reading"
                  ? "source.statusReading"
                  : entry.status === "error"
                    ? "source.statusError"
                    : "source.statusReady";
              return (
                <article
                  className={
                    activeSessionSongId === entry.id
                      ? "session-song active"
                      : "session-song"
                  }
                  key={entry.id}
                >
                  <button
                    aria-pressed={activeSessionSongId === entry.id}
                    className="session-song-select"
                    onClick={() => onSelectSessionSong(entry.id)}
                    title={localizedEntry.title}
                    type="button"
                  >
                    <img src={entry.imageUrls[0]} alt="" />
                    <span>
                      <strong>{localizedEntry.title}</strong>
                      <small>
                        {plural(
                          "common.pageCount.one",
                          "common.pageCount.other",
                          entry.imageUrls.length,
                        )}{" "}
                        · {t(statusKey)}
                      </small>
                    </span>
                  </button>
                  <button
                    aria-label={t("source.deleteSong", {
                      title: localizedEntry.title,
                    })}
                    className="session-song-delete"
                    onClick={() => onDeleteSessionSong(entry.id)}
                    type="button"
                  >
                    {t("common.delete")}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {queuedFiles.length > 0 ? (
        <div className="upload-queue">
          <div>
            <strong>{t("source.queueTitle")}</strong>
            <small>{t("source.queueHint")}</small>
          </div>
          <ol>
            {queuedFiles.map((file, index) => (
              <li key={`${file.name}-${file.lastModified}-${index}`}>
                <span className="upload-queue-file" title={file.name}>
                  {t("common.page", { number: index + 1 })} · {file.name}
                </span>
                <div>
                  <button
                    aria-label={t("source.movePageUp", { number: index + 1 })}
                    disabled={index === 0 || recognitionStatus === "reading"}
                    onClick={() =>
                      setQueuedFiles((current) => {
                        const next = [...current];
                        [next[index - 1], next[index]] = [next[index], next[index - 1]];
                        return next;
                      })
                    }
                    type="button"
                  >
                    {t("source.moveUp")}
                  </button>
                  <button
                    aria-label={t("source.movePageDown", {
                      number: index + 1,
                    })}
                    disabled={
                      index === queuedFiles.length - 1 ||
                      recognitionStatus === "reading"
                    }
                    onClick={() =>
                      setQueuedFiles((current) => {
                        const next = [...current];
                        [next[index], next[index + 1]] = [next[index + 1], next[index]];
                        return next;
                      })
                    }
                    type="button"
                  >
                    {t("source.moveDown")}
                  </button>
                  <button
                    aria-label={t("source.removePage", { number: index + 1 })}
                    disabled={recognitionStatus === "reading"}
                    onClick={() =>
                      setQueuedFiles((current) =>
                        current.filter((_, fileIndex) => fileIndex !== index),
                      )
                    }
                    type="button"
                  >
                    {t("source.remove")}
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <button
            className="primary-action"
            disabled={recognitionStatus === "reading"}
            onClick={() => onUpload(queuedFiles)}
            type="button"
          >
            {recognitionStatus === "reading"
              ? t("source.readerBusy")
              : t("source.startReading", {
                  pages: plural(
                    "common.pageCount.one",
                    "common.pageCount.other",
                    queuedFiles.length,
                  ),
                })}
          </button>
        </div>
      ) : null}

      <div className="review-workspace">
        <div className="source-preview">
          <div className="panel-toolbar">
            <span>{t("source.previewTitle")}</span>
            <label>
              {t("source.zoom")}
              <input
                min="70"
                max="180"
                onChange={(event) => setZoom(Number(event.target.value))}
                type="range"
                value={zoom}
              />
              <output>{zoom}%</output>
            </label>
          </div>
          <div className="image-viewport compact-source multipage-source">
            {(song.source.imagePaths ?? [song.source.imagePath]).map(
              (imagePath, index) => (
                <figure key={`${imagePath}-${index}`}>
                  <figcaption>
                    {t("common.page", { number: index + 1 })}
                  </figcaption>
                  <img
                    src={imagePath}
                    alt={t("source.imageAlt", {
                      title: song.title,
                      number: index + 1,
                    })}
                    style={{ width: `${zoom}%` }}
                  />
                </figure>
              ),
            )}
          </div>
          <p className="source-attribution">{song.source.attribution}</p>
          {recognitionStatus === "reading" ? (
            <p className="recognition-progress" role="status">
              {t("source.recognitionProgress")}
            </p>
          ) : null}
          {recognitionStatus === "error" && recognitionError ? (
            <p className="audio-error" role="alert">
              {localizeError(recognitionError)}
            </p>
          ) : null}
        </div>

        <div className="review-score-panel">
          <div className="review-score-heading">
            <div>
              <strong>{t("source.reviewScoreTitle")}</strong>
              <small>{t("source.reviewScoreHint")}</small>
            </div>
            <span>
              {selectedEventIndex >= 0
                ? `${selectedEventIndex + 1} / ${eventCount}`
                : `0 / ${eventCount}`}
            </span>
          </div>
          <JianpuScore
            activeSourceIds={new Set()}
            currentMeasure={selectedMeasure}
            followPlayback={false}
            harmony={harmony}
            layoutPlan={layoutPlan}
            onSelectEvent={selectScoreEvent}
            onSelectMeasure={onSelectMeasure}
            onSuspendFollow={() => undefined}
            playbackActive={false}
            selectedEventId={selectedEvent?.id ?? null}
            selectedMeasure={selectedMeasure}
            song={song}
            timeline={timeline}
            variant="review"
          />
        </div>

        <div className="recognition-panel">
          <div className="recognition-summary">
            <div className="confidence-ring" style={{ "--value": measuredConfidence } as React.CSSProperties}>
              <strong>{Math.round(measuredConfidence * 100)}%</strong>
              <small>{t("source.confidence")}</small>
            </div>
            <div>
              <span className="ai-label">
                {song.source.verificationStatus === "reader-agreed" ||
                song.source.verificationStatus === "judge-confirmed"
                  ? t("source.readersVerified")
                  : t("source.manualReview")}
              </span>
              <h3>{song.title}</h3>
              <p>
                1={formatAccidentals(song.key)} · {song.timeSignature.beats}/
                {song.timeSignature.beatType} · {song.tempo} BPM
              </p>
              <small>{song.source.coverage}</small>
            </div>
          </div>

          <details className="recognition-notes-details">
            <summary>{t("source.details")}</summary>
            <ul className="recognition-notes">
              {song.source.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </details>

          {lowConfidenceEvents.length > 0 ? (
            <div className="review-alert">
              <span className="alert-count">{lowConfidenceEvents.length}</span>
              <div>
                <strong>{t("source.pendingNotes")}</strong>
                <small>{t("source.pendingHint")}</small>
              </div>
              <div className="pending-navigation">
                <button
                  onClick={() => {
                    setShowManualEditor(true);
                    onPreviousLowConfidence();
                  }}
                  type="button"
                >
                  {t("source.previous")}
                </button>
                <button
                  onClick={() => {
                    setShowManualEditor(true);
                    onNextLowConfidence();
                  }}
                  type="button"
                >
                  {t("source.next")}
                </button>
                <button className="confirm-all-notes" onClick={onConfirmAll} type="button">
                  {t("source.confirmAll")}
                </button>
              </div>
            </div>
          ) : !generationBusy ? (
            <div className="review-complete">
              <span>✓</span>
              <div>
                <strong>{t("source.noPending")}</strong>
                <small>{t("source.noPendingHint")}</small>
              </div>
            </div>
          ) : null}

          {lowConfidenceEvents.length > 0 || showManualEditor ? (
            <div className="note-inspector">
            <div className="inspector-title">
              <div>
                <span>{t("source.editor")}</span>
                <strong>
                  {selectedEvent
                    ? `${t("music.measure", {
                        number: selectedMeasure,
                      })} · ${
                        selectedEvent.midi === null
                          ? t("source.rest")
                          : formatAccidentals(
                              midiToPitchName(
                                selectedEvent.midi,
                                keyPrefersFlats(song.key),
                              ),
                            )
                      }`
                    : t("music.measure", { number: selectedMeasure })}
                </strong>
              </div>
              <div className="inspector-actions">
                <button
                  disabled={!selectedEvent}
                  onClick={() => onEventPatch({ confidence: 1 })}
                  type="button"
                >
                  {t("source.confirmCurrent")}
                </button>
                <button
                  disabled={!selectedEvent}
                  onClick={onResetEvent}
                  type="button"
                >
                  {t("source.reset")}
                </button>
                <button onClick={onAddNote} type="button">
                  {t("source.addNote")}
                </button>
              </div>
            </div>

            {selectedEvent ? (
              <>
                <div className="form-grid">
                  <label>
                    {t("source.pitch")}
                    <select
                      onChange={(event) =>
                        onEventPatch({
                          midi:
                            event.target.value === "rest"
                              ? null
                              : Number(event.target.value),
                        })
                      }
                      value={selectedEvent.midi ?? "rest"}
                    >
                      <option value="rest">
                        0 · {t("source.rest")}
                      </option>
                      {PITCH_OPTIONS.map((midi) => (
                        <option key={midi} value={midi}>
                          {formatAccidentals(
                            midiToPitchName(
                              midi,
                              keyPrefersFlats(song.key),
                            ),
                          )}
                        </option>
                      ))}
                    </select>
                    <span className="octave-actions">
                      <button
                        disabled={
                          selectedEvent.midi === null ||
                          selectedEvent.midi < PITCH_OPTIONS[0] + 12
                        }
                        onClick={() =>
                          onEventPatch({ midi: (selectedEvent.midi ?? 60) - 12 })
                        }
                        type="button"
                      >
                        {t("source.lowerOctave")}
                      </button>
                      <button
                        disabled={
                          selectedEvent.midi === null ||
                          selectedEvent.midi > PITCH_OPTIONS.at(-1)! - 12
                        }
                        onClick={() =>
                          onEventPatch({ midi: (selectedEvent.midi ?? 60) + 12 })
                        }
                        type="button"
                      >
                        {t("source.raiseOctave")}
                      </button>
                    </span>
                  </label>
                  <label>
                    {t("source.duration")}
                    <select
                      onChange={(event) =>
                        onEventPatch({ durationBeats: Number(event.target.value) })
                      }
                      value={selectedEvent.durationBeats}
                    >
                      {DURATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {t(option.labelKey)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="lyric-field">
                    {t("source.lyrics")}
                    <input
                      onChange={(event) => onEventPatch({ lyric: event.target.value })}
                      placeholder={t("source.optional")}
                      type="text"
                      value={selectedEvent.lyric ?? ""}
                    />
                  </label>
                </div>

                <div className="finger-editor">
                  <span>{t("source.rightFingering")}</span>
                  <div className="finger-buttons">
                    {[1, 2, 3, 4, 5].map((finger) => (
                      <button
                        className={selectedEvent.finger === finger ? "active" : ""}
                        disabled={selectedEvent.midi === null}
                        key={finger}
                        onClick={() => onEventPatch({ finger })}
                        type="button"
                      >
                        {finger}
                      </button>
                    ))}
                  </div>
                  <label className="lock-control">
                    <input
                      checked={Boolean(selectedEvent.fingerLocked)}
                      disabled={selectedEvent.midi === null}
                      onChange={(event) =>
                        onEventPatch({ fingerLocked: event.target.checked })
                      }
                      type="checkbox"
                    />
                    {t("source.lock")}
                  </label>
                </div>

                <div className="confidence-editor">
                  <span>{t("source.recognitionConfidence")}</span>
                  <div className="confidence-track">
                    <i style={{ width: `${selectedEvent.confidence * 100}%` }} />
                  </div>
                  <strong>{Math.round(selectedEvent.confidence * 100)}%</strong>
                  <button
                    disabled={selectedEvent.confidence >= 1}
                    onClick={() => onEventPatch({ confidence: 1 })}
                    type="button"
                  >
                    {t("source.confirmNote")}
                  </button>
                  <button className="danger-link" onClick={onDeleteNote} type="button">
                    {t("common.delete")}
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-inspector">
                {t("source.emptyMeasure")}
              </div>
            )}
            </div>
          ) : null}

          {generationBusy ? (
            <div className="generation-progress" role="status" aria-live="polite">
              <div className="generation-progress-heading">
                <span className="generation-spinner" aria-hidden="true" />
                <div>
                  <strong>{t("source.generating")}</strong>
                  <small>
                    {t(
                      GENERATION_LABELS[
                        generationState.stage as Exclude<
                          TeachingGenerationState["stage"],
                          "idle" | "error"
                        >
                      ],
                    )}
                  </small>
                </div>
                <output>{generationState.progress}%</output>
              </div>
              <div
                aria-label={t("source.generationProgress")}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={generationState.progress}
                className="generation-progress-track"
                role="progressbar"
              >
                <span style={{ width: `${generationState.progress}%` }} />
              </div>
              <p>{t("source.generationAlignment")}</p>
            </div>
          ) : null}

          {generationState.stage === "error" && generationState.message ? (
            <div className="generation-error" role="alert">
              <strong>{t("source.generationFailed")}</strong>
              <span>{localizeError(generationState.message)}</span>
            </div>
          ) : null}

          <button
            className="confirm-button"
            disabled={generationBusy}
            onClick={onConfirm}
            type="button"
          >
            {generationBusy
              ? t("source.confirmBusy")
              : confirmed
                ? t("source.reconfirm")
                : t("source.confirmGenerate")}
            <span>{generationBusy ? "•••" : "→"}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
