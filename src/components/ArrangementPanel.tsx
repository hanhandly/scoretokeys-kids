import type {
  AccompanimentMode,
  ChordAssignment,
  SongModel,
} from "../types";
import { buildChordPalette, chordSolfege } from "../core/theory";
import { useI18n } from "../i18n/I18nProvider";
import { formatAccidentals } from "../i18n/messages";
import type { TranslationKey } from "../i18n/messages";

interface ArrangementPanelProps {
  song: SongModel;
  harmony: ChordAssignment[];
  mode: AccompanimentMode;
  selectedMeasure: number;
  confirmed: boolean;
  onModeChange: (mode: AccompanimentMode) => void;
  onSelectMeasure: (measure: number) => void;
  onChordChange: (measure: number, symbol: string) => void;
  onChordLockChange: (measure: number, locked: boolean) => void;
  onRecomputeFingering: () => void;
  onReharmonize: () => void;
}

const MODES: Array<{
  value: AccompanimentMode;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
}> = [
  {
    value: "root",
    titleKey: "arrangement.mode.root.title",
    descriptionKey: "arrangement.mode.root.description",
  },
  {
    value: "root-fifth",
    titleKey: "arrangement.mode.root-fifth.title",
    descriptionKey: "arrangement.mode.root-fifth.description",
  },
  {
    value: "block",
    titleKey: "arrangement.mode.block.title",
    descriptionKey: "arrangement.mode.block.description",
  },
  {
    value: "arpeggio",
    titleKey: "arrangement.mode.arpeggio.title",
    descriptionKey: "arrangement.mode.arpeggio.description",
  },
];

export function ArrangementPanel({
  song,
  harmony,
  mode,
  selectedMeasure,
  confirmed,
  onModeChange,
  onSelectMeasure,
  onChordChange,
  onChordLockChange,
  onRecomputeFingering,
  onReharmonize,
}: ArrangementPanelProps) {
  const { t } = useI18n();
  const palette = buildChordPalette(song.key);
  const selectedChord =
    harmony.find((chord) => chord.measureNumber === selectedMeasure) ?? harmony[0];

  return (
    <section className={`card arrangement-card ${confirmed ? "" : "gated"}`}>
      <header className="card-header">
        <div>
          <p className="step-kicker">{t("arrangement.step")}</p>
          <h2>{t("arrangement.heading")}</h2>
        </div>
        <div className="algorithm-badges">
          <span>{t("arrangement.fingeringBadge")}</span>
          <span>{t("arrangement.harmonyBadge")}</span>
        </div>
      </header>

      {!confirmed ? (
        <div className="gate-banner">
          <span>🔒</span>
          <p>
            <strong>{t("arrangement.lockedTitle")}</strong>
            {t("arrangement.lockedBody")}
          </p>
        </div>
      ) : null}

      <div className="arrangement-columns">
        <div>
          <div className="section-heading">
            <div>
              <span>{t("arrangement.leftPattern")}</span>
              <small>{t("arrangement.sharedTimeline")}</small>
            </div>
          </div>
          <div className="mode-grid">
            {MODES.map((item, index) => (
              <button
                className={mode === item.value ? "active" : ""}
                disabled={!confirmed}
                key={item.value}
                onClick={() => onModeChange(item.value)}
                type="button"
              >
                <span className="mode-number">{index + 1}</span>
                <strong>{t(item.titleKey)}</strong>
                <small>{t(item.descriptionKey)}</small>
                <i />
              </button>
            ))}
          </div>
        </div>

        <div className="chord-editor-panel">
          <div className="section-heading">
            <div>
              <span>{t("arrangement.chordProgression")}</span>
              <small>{t("arrangement.chordHint")}</small>
            </div>
            <button disabled={!confirmed} onClick={onReharmonize} type="button">
              {t("arrangement.reharmonize")}
            </button>
          </div>
          <div className="chord-sequence">
            {harmony.map((chord) => (
              <button
                className={[
                  chord.measureNumber === selectedMeasure ? "active" : "",
                  chord.locked ? "locked" : "",
                ].join(" ")}
                aria-label={`${t("music.measure", {
                  number: chord.measureNumber,
                })} · ${formatAccidentals(chord.symbol)} · ${Math.round(chord.confidence * 100)}%${
                  chord.locked ? ` · ${t("arrangement.locked")}` : ""
                }`}
                disabled={!confirmed}
                key={chord.measureNumber}
                onClick={() => onSelectMeasure(chord.measureNumber)}
                type="button"
              >
                <small>
                  {t("music.measureShort", { number: chord.measureNumber })}
                </small>
                <strong>{formatAccidentals(chord.symbol)}</strong>
                <span>{Math.round(chord.confidence * 100)}%</span>
                {chord.locked ? <i aria-hidden="true">⌕</i> : null}
              </button>
            ))}
          </div>

          {selectedChord ? (
            <div className="selected-chord-editor">
              <div className="chord-name">
                <span>
                  {t("music.measure", {
                    number: selectedChord.measureNumber,
                  })}
                </span>
                <strong>{formatAccidentals(selectedChord.symbol)}</strong>
                <small>{chordSolfege(selectedChord, song)}</small>
              </div>
              <label>
                {t("arrangement.replaceChord")}
                <select
                  disabled={!confirmed}
                  onChange={(event) =>
                    onChordChange(selectedChord.measureNumber, event.target.value)
                  }
                  value={selectedChord.symbol}
                >
                  {palette.map((chord) => (
                    <option key={chord.symbol} value={chord.symbol}>
                      {formatAccidentals(chord.symbol)} ·{" "}
                      {chordSolfege(chord, song)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="switch-label">
                <input
                  checked={selectedChord.locked}
                  disabled={!confirmed}
                  onChange={(event) =>
                    onChordLockChange(
                      selectedChord.measureNumber,
                      event.target.checked,
                    )
                  }
                  type="checkbox"
                />
                <span />
                {t("arrangement.lockMeasure")}
              </label>
            </div>
          ) : null}
        </div>
      </div>

      <footer className="arrangement-footer">
        <div>
          <span
            aria-label={t("practice.rightHand")}
            className="hand-key right"
          >
            {t("music.rightHandShort")}
          </span>
          <p>
            <strong>{t("arrangement.rightFingering")}</strong>
            {t("arrangement.rightFingeringHint")}
          </p>
        </div>
        <button disabled={!confirmed} onClick={onRecomputeFingering} type="button">
          {t("arrangement.recompute")}
        </button>
      </footer>
    </section>
  );
}
