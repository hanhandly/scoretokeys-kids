import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AccompanimentMode,
  ChordOverrides,
  PerformanceEvent,
  ScoreEvent,
  SessionSong,
  SongModel,
  TeachingGenerationState,
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
  confirmAllScoreEvents,
  getLowConfidenceEvents,
  getMeasureAtBeat,
  getMeasureSpans,
  getScoreEventStartBeat,
  getTotalBeats,
  relayoutEvents,
  validatePerformanceTimeline,
  validateSong,
} from "./core/model";
import { beatsToSeconds } from "./core/tempo";
import { clearAudioCalibrationProfile } from "./core/audioCalibration";
import { verifyTeachingMaterialOpening } from "./core/teachingVerification";
import { getActivePerformanceEvents } from "./core/transport";
import { keyPrefersFlats, midiToPitchName } from "./core/theory";
import { createBlankSong, SAMPLE_SONGS } from "./data/samples";
import { usePracticePlayer } from "./hooks/usePracticePlayer";
import { useI18n } from "./i18n/I18nProvider";
import { formatAccidentals } from "./i18n/messages";
import { recognizeScoreImages } from "./recognition/client";
import { createA4LayoutPlan } from "./layout/createA4LayoutPlan";
import { SOURCE_LAYOUT_HINTS } from "./layout/sourceLayoutHints";
import type { LayoutMode } from "./layout/types";

const SPEEDS = [0.25, 0.5, 0.75, 1] as const;
type RecognitionStatus = "idle" | "reading" | "error";

function safeFileName(value: string, fallback: string): string {
  return value.replace(/[<>:"/\\|?*]+/g, "-").trim() || fallback;
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

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

export default function App() {
  const {
    language,
    localizeError,
    localizeSong,
    plural,
    setLanguage,
    t,
  } = useI18n();
  const tRef = useRef(t);
  const pluralRef = useRef(plural);
  const localizeErrorRef = useRef(localizeError);
  tRef.current = t;
  pluralRef.current = plural;
  localizeErrorRef.current = localizeError;
  const initialSong = useMemo(() => cloneSong(SAMPLE_SONGS[0]), []);
  const reviewBaselineRef = useRef(cloneSong(initialSong));
  const practiceWorkspaceRef = useRef<HTMLDivElement>(null);
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
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [rightEnabled, setRightEnabled] = useState(true);
  const [leftEnabled, setLeftEnabled] = useState(false);
  const [metronome, setMetronome] = useState(false);
  const [loopMeasure, setLoopMeasure] = useState(false);
  const [layoutMode, setLayoutMode] =
    useState<LayoutMode>("source-faithful");
  const [followScore, setFollowScore] = useState(true);
  const [editingSetup, setEditingSetup] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const uploadedImageUrlRef = useRef(new Set<string>());
  const activeSessionSongIdRef = useRef<string | null>(null);
  const generationRunRef = useRef(0);
  const [sessionSongs, setSessionSongs] = useState<SessionSong[]>([]);
  const [activeSessionSongId, setActiveSessionSongId] = useState<string | null>(
    null,
  );
  const [generationState, setGenerationState] =
    useState<TeachingGenerationState>({ stage: "idle", progress: 0 });
  const [recognitionStatus, setRecognitionStatus] =
    useState<RecognitionStatus>("idle");
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const displayedSong = useMemo(
    () => localizeSong(song),
    [localizeSong, song],
  );

  useEffect(
    () => () => {
      uploadedImageUrlRef.current.forEach((url) => URL.revokeObjectURL(url));
      uploadedImageUrlRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    activeSessionSongIdRef.current = activeSessionSongId;
  }, [activeSessionSongId]);

  useEffect(() => {
    setToast(null);
  }, [language]);

  useEffect(() => {
    if (!activeSessionSongId) return;
    setSessionSongs((current) =>
      current.map((entry) =>
        entry.id === activeSessionSongId
          ? { ...entry, song: cloneSong(song) }
          : entry,
      ),
    );
  }, [activeSessionSongId, song]);

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
  const pickupBeats = useMemo(
    () =>
      song.measures
        .filter((measure) => measure.number <= 0)
        .reduce((sum, measure) => sum + measure.durationBeats, 0),
    [song],
  );
  const layoutPlan = useMemo(
    () =>
      createA4LayoutPlan(song, {
        mode: layoutMode,
        sourceHint: song.source.layoutSystems
          ? {
              systems: song.source.layoutSystems,
              pageBreakAfterSystem: song.source.pageBreakBeforeSystem,
            }
          : SOURCE_LAYOUT_HINTS[song.id],
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
  const orderedEvents = useMemo(
    () =>
      song.measures.flatMap((measure) =>
        measure.events.map((event) => ({
          event,
          measureNumber: measure.number,
        })),
      ),
    [song],
  );
  const selectedEventIndex = orderedEvents.findIndex(
    ({ event }) => event.id === selectedEventId,
  );
  const currentMeasure = getMeasureAtBeat(song, player.positionBeat);
  const soundingEvents =
    player.status === "playing"
      ? getActivePerformanceEvents(timeline, player.positionBeat, {
          right: rightEnabled,
          left: leftEnabled,
        })
      : [];
  const activeSourceIds = new Set(
    soundingEvents.flatMap((event) =>
      event.sourceEventId ? [event.sourceEventId] : [],
    ),
  );

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => {
      setToast((current) => (current === message ? null : current));
    }, 2600);
  };

  useEffect(() => {
    try {
      clearAudioCalibrationProfile(window.localStorage);
    } catch {
      showToast(tRef.current("toast.legacyAudioSettingsCleanupFailed"));
    }
  }, []);

  const resetForSong = (nextSong: SongModel) => {
    generationRunRef.current += 1;
    player.stop();
    reviewBaselineRef.current = cloneSong(nextSong);
    const cloned = cloneSong(reviewBaselineRef.current);
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
    setEditingSetup(false);
    setRecognitionStatus("idle");
    setRecognitionError(null);
    setGenerationState({ stage: "idle", progress: 0 });
  };

  const handleSelectSample = (songId: string) => {
    const sample = SAMPLE_SONGS.find((item) => item.id === songId);
    if (!sample) return;
    activeSessionSongIdRef.current = null;
    setActiveSessionSongId(null);
    resetForSong(sample);
    showToast(t("toast.sampleLoaded"));
  };

  const handleSelectSessionSong = (sessionSongId: string) => {
    const entry = sessionSongs.find((item) => item.id === sessionSongId);
    if (!entry) return;
    activeSessionSongIdRef.current = entry.id;
    setActiveSessionSongId(entry.id);
    resetForSong(entry.song);
    if (entry.status === "reading") {
      setRecognitionStatus("reading");
      setRecognitionError(null);
    } else if (entry.status === "error") {
      setRecognitionStatus("error");
      setRecognitionError(entry.error ?? "RECOGNITION_FAILED");
    } else {
      setRecognitionStatus("idle");
      setRecognitionError(null);
    }
  };

  const handleDeleteSessionSong = (sessionSongId: string) => {
    const entry = sessionSongs.find((item) => item.id === sessionSongId);
    if (!entry) return;
    entry.imageUrls.forEach((url) => {
      URL.revokeObjectURL(url);
      uploadedImageUrlRef.current.delete(url);
    });
    setSessionSongs((current) =>
      current.filter((item) => item.id !== sessionSongId),
    );
    if (activeSessionSongIdRef.current === sessionSongId) {
      activeSessionSongIdRef.current = null;
      setActiveSessionSongId(null);
      resetForSong(SAMPLE_SONGS[0]);
    }
    showToast(t("toast.sessionDeleted"));
  };

  const handleUpload = async (files: File[]) => {
    const imageUrls = files.map((file) => URL.createObjectURL(file));
    imageUrls.forEach((url) => uploadedImageUrlRef.current.add(url));
    const blankSong = createBlankSong(
      imageUrls[0],
      files[0]?.name.replace(/\.[^.]+$/, "") || t("upload.untitled"),
    );
    blankSong.source.imagePaths = imageUrls;
    const sessionSongId = blankSong.id;
    setSessionSongs((current) => [
      ...current,
      {
        id: sessionSongId,
        song: cloneSong(blankSong),
        imageUrls,
        status: "reading",
      },
    ]);
    activeSessionSongIdRef.current = sessionSongId;
    setActiveSessionSongId(sessionSongId);
    resetForSong(blankSong);
    setRecognitionStatus("reading");
    showToast(
      t("toast.recognizingPages", {
        pages: plural(
          "common.pageCount.one",
          "common.pageCount.other",
          files.length,
        ),
      }),
    );

    try {
      const result = await recognizeScoreImages(files);
      const recognizedSong = {
        ...result.song,
        source: {
          ...result.song.source,
          imagePath: imageUrls[0],
          imagePaths: imageUrls,
        },
      };
      setSessionSongs((current) =>
        current.map((entry) =>
          entry.id === sessionSongId
            ? {
                ...entry,
                song: cloneSong(recognizedSong),
                status: "ready",
                error: undefined,
              }
            : entry,
        ),
      );
      if (activeSessionSongIdRef.current === sessionSongId) {
        resetForSong(recognizedSong);
        setActiveSessionSongId(sessionSongId);
      }
      showToast(
        result.verification.unresolvedCount > 0
          ? tRef.current("toast.recognitionNeedsReview", {
              pages: pluralRef.current(
                "common.pageCount.one",
                "common.pageCount.other",
                result.verification.pageCount,
              ),
              notes: pluralRef.current(
                "common.disputedNoteCount.one",
                "common.disputedNoteCount.other",
                result.verification.unresolvedCount,
              ),
            })
          : tRef.current("toast.recognitionComplete", {
              pages: pluralRef.current(
                "common.pageCount.one",
                "common.pageCount.other",
                result.verification.pageCount,
              ),
            }),
      );
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "RECOGNITION_FAILED";
      setSessionSongs((current) =>
        current.map((entry) =>
          entry.id === sessionSongId
            ? { ...entry, status: "error", error: message }
            : entry,
        ),
      );
      if (activeSessionSongIdRef.current === sessionSongId) {
        setRecognitionStatus("error");
        setRecognitionError(message);
      }
      showToast(localizeErrorRef.current(message));
    }
  };

  const patchSelectedEvent = (patch: Partial<ScoreEvent>) => {
    if (!selectedEventId) return;
    setSong((current) => ({
      ...current,
      measures: current.measures.map((measure) => {
        if (!measure.events.some((event) => event.id === selectedEventId)) return measure;
        const events = measure.events.map((event) =>
          event.id === selectedEventId
            ? {
                ...event,
                ...patch,
                confidence: 1,
                ...("midi" in patch ? { sourcePitchToken: undefined } : {}),
              }
            : event,
        );
        return "durationBeats" in patch
          ? relayoutEvents(measure, events)
          : { ...measure, events };
      }),
    }));
  };

  const confirmAllEvents = () => {
    const pendingCount = getLowConfidenceEvents(song).length;
    setSong((current) => confirmAllScoreEvents(current));
    setSelectedEventId(null);
    showToast(
      pendingCount > 0
        ? t("toast.allConfirmedWithCount", {
            items: plural(
              "common.reviewItemCount.one",
              "common.reviewItemCount.other",
              pendingCount,
            ),
          })
        : t("toast.allConfirmed"),
    );
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
        showToast(t("toast.measureFull"));
      }
    }, 0);
  };

  const deleteNote = () => {
    if (!selectedEventId) return;
    const fallback =
      orderedEvents[selectedEventIndex + 1] ??
      orderedEvents[selectedEventIndex - 1] ??
      null;
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
    setSelectedEventId(fallback?.event.id ?? null);
    if (fallback) setSelectedMeasure(fallback.measureNumber);
  };

  const resetSelectedEvent = () => {
    if (!selectedEventId) return;
    const baselineMeasure = reviewBaselineRef.current.measures.find((measure) =>
      measure.events.some((event) => event.id === selectedEventId),
    );
    const baselineEvent = baselineMeasure?.events.find(
      (event) => event.id === selectedEventId,
    );
    if (!baselineEvent) {
      deleteNote();
      showToast(t("toast.addedNoteRemoved"));
      return;
    }
    setSong((current) => ({
      ...current,
      measures: current.measures.map((measure) => {
        if (!measure.events.some((event) => event.id === selectedEventId)) {
          return measure;
        }
        return relayoutEvents(
          measure,
          measure.events.map((event) =>
            event.id === selectedEventId ? { ...baselineEvent } : event,
          ),
        );
      }),
    }));
    showToast(t("toast.noteReset"));
  };

  const navigateLowConfidence = (direction: -1 | 1) => {
    const lowEvents = getLowConfidenceEvents(song);
    if (lowEvents.length === 0) {
      showToast(t("toast.noLowConfidence"));
      return;
    }
    const currentIndex = lowEvents.findIndex((event) => event.id === selectedEventId);
    const nextIndex =
      currentIndex < 0
        ? direction > 0
          ? 0
          : lowEvents.length - 1
        : (currentIndex + direction + lowEvents.length) % lowEvents.length;
    const next = lowEvents[nextIndex];
    const measure = song.measures.find((item) =>
      item.events.some((event) => event.id === next.id),
    );
    setSelectedEventId(next.id);
    if (measure) setSelectedMeasure(measure.number);
  };

  const confirmReview = async () => {
    if (generationState.stage !== "idle" && generationState.stage !== "error") {
      return;
    }
    const issues = validateSong(song);
    const errors = issues.filter((issue) => issue.level === "error");
    const unresolvedEvents = getLowConfidenceEvents(song);
    const noteCount = song.measures.flatMap((measure) => measure.events).filter(
      (event) => event.midi !== null,
    ).length;
    if (errors.length > 0) {
      showToast(localizeError(errors[0].message));
      return;
    }
    if (noteCount === 0) {
      showToast(t("toast.requireNote"));
      return;
    }
    if (unresolvedEvents.length > 0) {
      const first = unresolvedEvents[0];
      const measure = song.measures.find((item) =>
        item.events.some((event) => event.id === first.id),
      );
      setSelectedEventId(first.id);
      if (measure) setSelectedMeasure(measure.number);
      showToast(
        t("toast.unresolvedNotes", {
          notes: plural(
            "common.lowConfidenceNoteCount.one",
            "common.lowConfidenceNoteCount.other",
            unresolvedEvents.length,
          ),
        }),
      );
      return;
    }

    const audioPreparation = player.prepare();
    void audioPreparation.catch(() => undefined);
    const minimumProgressDisplay = new Promise<void>((resolve) => {
      window.setTimeout(resolve, 550);
    });
    const advanceGeneration = async (
      stage: TeachingGenerationState["stage"],
      progress: number,
      message?: string,
    ) => {
      setGenerationState({ stage, progress, message });
      await waitForPaint();
    };
    const runId = ++generationRunRef.current;
    const ensureCurrentRun = () => {
      if (generationRunRef.current !== runId) {
        throw new Error("GENERATION_CANCELLED");
      }
    };

    try {
      await advanceGeneration("validating-score", 14);
      ensureCurrentRun();
      const reviewedSong = recommendFingering({
        ...song,
        source: {
          ...song.source,
          verificationStatus: "manual-confirmed",
        },
      });
      const reviewedHarmony = harmonize(reviewedSong, chordOverrides);

      await advanceGeneration("building-timeline", 36);
      ensureCurrentRun();
      const reviewedTimeline = buildPerformanceTimeline(
        reviewedSong,
        reviewedHarmony,
        mode,
      );
      const timelineErrors = validatePerformanceTimeline(
        reviewedSong,
        reviewedTimeline,
      ).filter((issue) => issue.level === "error");
      if (timelineErrors.length > 0) {
        throw new Error(timelineErrors[0].message);
      }

      await advanceGeneration("verifying-opening", 58);
      ensureCurrentRun();
      const openingReport = verifyTeachingMaterialOpening(
        reviewedSong,
        reviewedTimeline,
      );

      await advanceGeneration("preparing-audio", 78);
      await audioPreparation;
      ensureCurrentRun();

      await advanceGeneration("finalizing", 94);
      ensureCurrentRun();
      verifyTeachingMaterialOpening(reviewedSong, reviewedTimeline);
      setSong(reviewedSong);
      setRightEnabled(true);
      setLeftEnabled(false);
      setSelectedEventId(null);
      setFollowScore(true);
      setEditingSetup(false);
      await minimumProgressDisplay;
      ensureCurrentRun();
      await advanceGeneration("ready", 100);
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 120);
      });
      ensureCurrentRun();
      setConfirmed(true);
      setGenerationState({ stage: "idle", progress: 0 });
      showToast(
        tRef.current("toast.generationReady", {
          measures: pluralRef.current(
            "common.measureCount.one",
            "common.measureCount.other",
            openingReport.checkedMeasures,
          ),
          notes: pluralRef.current(
            "common.noteCount.one",
            "common.noteCount.other",
            openingReport.checkedScoreEvents,
          ),
        }),
      );
    } catch (cause) {
      if (
        cause instanceof Error &&
        cause.message === "GENERATION_CANCELLED"
      ) {
        return;
      }
      const message =
        cause instanceof Error ? cause.message : "GENERATION_FAILED";
      setConfirmed(false);
      setGenerationState({ stage: "error", progress: 0, message });
      showToast(localizeErrorRef.current(message));
    }
  };

  const recomputeFingering = () => {
    setSong((current) => recommendFingering(current));
    showToast(t("toast.fingeringRecomputed"));
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
    showToast(t("toast.reharmonized"));
  };

  const exportTimeline = () => {
    if (!confirmed) return;
    try {
      downloadBlob(
        `${safeFileName(
          displayedSong.title,
          t("export.fileNameFallback"),
        )}-${t("export.timelineSuffix")}.json`,
        createTimelineJson(displayedSong, timeline, harmony),
        "application/json;charset=utf-8",
      );
    } catch (cause) {
      showToast(
        localizeError(
          cause instanceof Error ? cause.message : "EXPORT_FAILED",
        ),
      );
    }
  };

  const exportMidi = () => {
    if (!confirmed) return;
    try {
      const percent = Math.round(speed * 100);
      downloadBlob(
        `${safeFileName(
          displayedSong.title,
          t("export.fileNameFallback"),
        )}-${t("export.speedSuffix", { percent })}.mid`,
        createMidiFile(displayedSong, timeline, speed),
        "audio/midi",
      );
    } catch (cause) {
      showToast(
        localizeError(
          cause instanceof Error ? cause.message : "EXPORT_FAILED",
        ),
      );
    }
  };

  const exportMusicXml = () => {
    if (!confirmed) return;
    const practiceSong = {
      ...displayedSong,
      tempo: Math.round(displayedSong.tempo * speed),
    };
    try {
      const percent = Math.round(speed * 100);
      downloadBlob(
        `${safeFileName(
          displayedSong.title,
          t("export.fileNameFallback"),
        )}-${t("export.speedSuffix", { percent })}.musicxml`,
        createMusicXml(practiceSong, timeline, harmony, {
          rightHandPart: t("export.rightHandPart"),
          leftHandPart: t("export.leftHandPart"),
        }),
        "application/vnd.recordare.musicxml+xml;charset=utf-8",
      );
    } catch (cause) {
      showToast(
        localizeError(
          cause instanceof Error ? cause.message : "EXPORT_FAILED",
        ),
      );
    }
  };

  const elapsedSeconds = beatsToSeconds(player.positionBeat, song.tempo, speed);
  const totalSeconds = beatsToSeconds(totalBeats, song.tempo, speed);
  const activeRight = soundingEvents.find((event) => event.hand === "right");
  const activeLeft = soundingEvents.find((event) => event.hand === "left");

  return (
    <>
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">
            <span>♪</span>
            <i />
          </div>
          <div>
            <strong>{t("brand.name")}</strong>
            <small>{t("brand.tagline")}</small>
          </div>
        </div>
        <nav className="workflow-nav" aria-label={t("nav.workflow")}>
          <span className="active"><i>1</i>{t("nav.review")}</span>
          <b>→</b>
          <span className={confirmed ? "active" : ""}>
            <i>2</i>{t("nav.arrange")}
          </span>
          <b>→</b>
          <span className={confirmed ? "active" : ""}>
            <i>3</i>{t("nav.practice")}
          </span>
        </nav>
        <div className="header-actions">
          <div
            aria-label={t("language.groupLabel")}
            className="language-switch"
            role="group"
          >
            <button
              aria-label={t("language.switchToChinese")}
              aria-pressed={language === "zh-CN"}
              className={language === "zh-CN" ? "active" : ""}
              lang="zh-CN"
              onClick={() => setLanguage("zh-CN")}
              title={t("language.switchToChinese")}
              type="button"
            >
              {t("language.chinese")}
            </button>
            <span aria-hidden="true">/</span>
            <button
              aria-label={t("language.switchToEnglish")}
              aria-pressed={language === "en"}
              className={language === "en" ? "active" : ""}
              lang="en"
              onClick={() => setLanguage("en")}
              title={t("language.switchToEnglish")}
              type="button"
            >
              {t("language.english")}
            </button>
          </div>
          <details className="export-menu">
            <summary aria-disabled={!confirmed}>
              {t("nav.export")} ▾
            </summary>
            <div>
              <button disabled={!confirmed} onClick={exportMidi} type="button">
                <strong>{t("export.midiName")}</strong>
                <small>{t("export.midiDescription")}</small>
              </button>
              <button disabled={!confirmed} onClick={exportMusicXml} type="button">
                <strong>{t("export.musicXmlName")}</strong>
                <small>{t("export.musicXmlDescription")}</small>
              </button>
              <button disabled={!confirmed} onClick={exportTimeline} type="button">
                <strong>{t("export.jsonName")}</strong>
                <small>{t("export.jsonDescription")}</small>
              </button>
              <button
                disabled={!confirmed}
                onClick={() => window.print()}
                type="button"
              >
                <strong>{t("export.printName")}</strong>
                <small>{t("export.printDescription")}</small>
              </button>
            </div>
          </details>
        </div>
      </header>

      <main
        className={`app-main ${confirmed && !editingSetup ? "practice-mode" : ""}`}
      >
        {!confirmed || editingSetup ? <section className="hero">
          <div>
            <span className="hero-badge">{t("hero.badge")}</span>
            <h1>
              {t("hero.headingLead")}
              <em>{t("hero.headingEmphasis")}</em>
            </h1>
            <p>{t("hero.body")}</p>
          </div>
          <div className="hero-principles">
            <span><strong>01</strong>{t("hero.principleReview")}</span>
            <span><strong>02</strong>{t("hero.principleLock")}</span>
            <span><strong>03</strong>{t("hero.principleSync")}</span>
          </div>
        </section> : null}

        {!confirmed || editingSetup ? (
          <>
            <SourceReview
              confirmed={confirmed}
              eventCount={orderedEvents.length}
              generationState={generationState}
              harmony={harmony}
              layoutPlan={layoutPlan}
              onAddNote={addNote}
              onConfirm={confirmReview}
              onConfirmAll={confirmAllEvents}
              onDeleteNote={deleteNote}
              onEventPatch={patchSelectedEvent}
              onNextLowConfidence={() => navigateLowConfidence(1)}
              onPreviousLowConfidence={() => navigateLowConfidence(-1)}
              onResetEvent={resetSelectedEvent}
              onSelectEvent={(eventId, measure) => {
                setSelectedEventId(eventId);
                setSelectedMeasure(measure);
              }}
              onSelectMeasure={setSelectedMeasure}
              onSelectSample={handleSelectSample}
              onSelectSessionSong={handleSelectSessionSong}
              onDeleteSessionSong={handleDeleteSessionSong}
              onUpload={handleUpload}
              recognitionError={recognitionError}
              recognitionStatus={recognitionStatus}
              samples={SAMPLE_SONGS}
              sessionSongs={sessionSongs}
              activeSessionSongId={activeSessionSongId}
              selectedEvent={selectedEvent}
              selectedEventIndex={selectedEventIndex}
              selectedMeasure={selectedMeasure}
              song={displayedSong}
              timeline={timeline}
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
              song={displayedSong}
            />
          </>
        ) : (
          <div className="practice-setup-summary">
            <div>
              <span>{t("app.setupConfirmed")}</span>
              <strong>{displayedSong.title}</strong>
              <small>
                {t("app.songSummary", {
                  measures: song.measures.length,
                  key: t("music.keyMajor", {
                    key: formatAccidentals(song.key),
                  }),
                  tempo: song.tempo,
                })}
              </small>
            </div>
            <button
              onClick={() => {
                player.stop();
                setEditingSetup(true);
              }}
              type="button"
            >
              {t("app.editSetup")}
            </button>
          </div>
        )}

        <div className="practice-workspace" ref={practiceWorkspaceRef}>
          <section
            className={`card score-card ${confirmed ? "" : "gated"}`}
            id="score-section"
          >
          <header className="card-header">
            <div>
              <p className="step-kicker">{t("score.step")}</p>
              <h2>{t("score.heading")}</h2>
            </div>
            <div className="score-actions">
              <label className="layout-mode-control">
                {t("score.layout")}
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
                  <option value="source-faithful">
                    {t("score.layoutSource")}
                  </option>
                  <option value="practice">
                    {t("score.layoutPractice")}
                  </option>
                </select>
              </label>
              <button
                aria-pressed={followScore}
                disabled={!confirmed}
                onClick={() => setFollowScore((current) => !current)}
                type="button"
              >
                {t(followScore ? "score.followOn" : "score.followResume")}
              </button>
              <button disabled={!confirmed} onClick={() => window.print()} type="button">
                {t("score.print")}
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
              setSelectedMeasure(measure);
              if (!confirmed) {
                setSelectedEventId(eventId);
                return;
              }
              setFollowScore(true);
              const startBeat = getScoreEventStartBeat(song, eventId);
              if (startBeat === null) {
                showToast(t("error.noteLocation"));
                return;
              }
              window.requestAnimationFrame(() => player.playFrom(startBeat));
            }}
            onSelectMeasure={setSelectedMeasure}
            onSuspendFollow={() => setFollowScore(false)}
            playbackActive={player.status === "playing"}
            selectedEventId={selectedEventId}
            selectedMeasure={selectedMeasure}
            song={displayedSong}
            timeline={timeline}
          />
          </section>

          <section className={`card practice-card ${confirmed ? "" : "gated"}`}>
          <header className="practice-header">
            <div>
              <p className="step-kicker">{t("practice.step")}</p>
              <h2>{displayedSong.title}</h2>
              <p>
                {currentMeasure <= 0
                  ? t("music.pickup")
                  : t("music.measure", { number: currentMeasure })}{" "}
                ·{" "}
                {Math.round(song.tempo * speed)} BPM
              </p>
            </div>
            <div className="now-playing">
              <div className="voice-readout right">
                <span>{t("practice.rightHand")}</span>
                <strong>
                  {activeRight
                    ? `${formatAccidentals(
                        midiToPitchName(
                          activeRight.midi,
                          keyPrefersFlats(song.key),
                        ),
                      )} · ${t("practice.finger", {
                        finger: activeRight.finger,
                      })}`
                    : t("practice.waiting")}
                </strong>
              </div>
              <div className="voice-readout left">
                <span>{t("practice.leftHand")}</span>
                <strong>
                  {activeLeft
                    ? `${formatAccidentals(
                        activeLeft.chord ??
                          midiToPitchName(activeLeft.midi, true),
                      )} · ${t("practice.finger", {
                        finger: activeLeft.finger,
                      })}`
                    : t("practice.waiting")}
                </strong>
              </div>
            </div>
          </header>

          <PianoKeyboard
            activeEvents={soundingEvents}
            leftEnabled={leftEnabled}
            rightEnabled={rightEnabled}
          />

          <div className="transport">
            <div className="transport-primary">
              <button
                aria-label={t("transport.restart")}
                className="restart-button"
                disabled={!confirmed}
                onClick={() => {
                  setLoopMeasure(false);
                  setFollowScore(true);
                  window.requestAnimationFrame(player.restart);
                }}
                type="button"
                title={t("transport.restart")}
              >
                ↺
              </button>
              <button
                aria-label={t("transport.stop")}
                className="stop-button"
                disabled={!confirmed}
                onClick={player.stop}
                type="button"
                title={t("transport.stopShort")}
              >
                ■
              </button>
              <button
                aria-label={
                  player.status === "playing" || player.status === "starting"
                    ? t("transport.pause")
                    : t("transport.play")
                }
                className="play-button"
                disabled={!confirmed}
                onClick={() => {
                  if (player.status !== "playing") {
                    setFollowScore(true);
                    window.requestAnimationFrame(() => {
                      practiceWorkspaceRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    });
                  }
                  player.toggle();
                }}
                title={
                  player.status === "playing" || player.status === "starting"
                    ? t("transport.pause")
                    : t("transport.play")
                }
                type="button"
              >
                {player.status === "playing" || player.status === "starting"
                  ? "Ⅱ"
                  : "▶"}
              </button>
              <div className="timeline-control">
                <input
                  aria-label={t("transport.progress")}
                  aria-valuetext={`${formatClock(elapsedSeconds)} / ${formatClock(totalSeconds)}`}
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
                  {pickupBeats > 0 ? (
                    <span className="pickup-label">
                      {t("transport.pickupBeats", { beats: pickupBeats })}
                    </span>
                  ) : (
                    <span />
                  )}
                  <span>{formatClock(totalSeconds)}</span>
                </div>
              </div>
            </div>

            <div className="practice-options">
              <div className="option-group speed-options">
                <span>{t("practice.speed")}</span>
                <div>
                  {SPEEDS.map((option) => (
                    <button
                      aria-pressed={speed === option}
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
                <span>{t("practice.voicesHint")}</span>
                <div>
                  <button
                    aria-pressed={rightEnabled}
                    className={rightEnabled ? "active right" : ""}
                    disabled={!confirmed}
                    onClick={() => setRightEnabled((value) => !value)}
                    type="button"
                  >
                    {t("practice.rightVoice")}
                  </button>
                  <button
                    aria-pressed={leftEnabled}
                    className={leftEnabled ? "active left" : ""}
                    disabled={!confirmed}
                    onClick={() => setLeftEnabled((value) => !value)}
                    type="button"
                  >
                    {t("practice.leftVoice")}
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
                  {t("practice.metronome")}
                </label>
                <label>
                  <input
                    checked={loopMeasure}
                    disabled={!confirmed}
                    onChange={(event) => setLoopMeasure(event.target.checked)}
                    type="checkbox"
                  />
                  <span />
                  {t("practice.loopMeasure", { number: selectedMeasure })}
                </label>
              </div>
            </div>
          </div>

          {player.error ? (
            <div className="audio-error" role="alert">
              <span>!</span>
              {player.error}
              <button onClick={player.clearError} type="button">
                {t("common.close")}
              </button>
            </div>
          ) : null}
          </section>
        </div>

      </main>

      {toast ? <div className="toast" role="status">✓ {toast}</div> : null}
    </>
  );
}
