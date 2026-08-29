import type {
  AccompanimentMode,
  ChordAssignment,
  SongModel,
} from "../types";
import { buildChordPalette, chordSolfege } from "../core/theory";

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
  title: string;
  description: string;
}> = [
  { value: "root", title: "单音", description: "每小节只弹根音" },
  { value: "root-fifth", title: "根音 + 五度", description: "左右交替更有律动" },
  { value: "block", title: "柱式和弦", description: "同时按下三个音" },
  { value: "arpeggio", title: "分解和弦", description: "固定八分音符型" },
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
  const palette = buildChordPalette(song.key);
  const selectedChord =
    harmony.find((chord) => chord.measureNumber === selectedMeasure) ?? harmony[0];

  return (
    <section className={`card arrangement-card ${confirmed ? "" : "gated"}`}>
      <header className="card-header">
        <div>
          <p className="step-kicker">STEP 2 · 可解释的自动编配</p>
          <h2>儿童小手 · 入门难度</h2>
        </div>
        <div className="algorithm-badges">
          <span>动态规划指法</span>
          <span>调内和弦规则</span>
        </div>
      </header>

      {!confirmed ? (
        <div className="gate-banner">
          <span>🔒</span>
          <p>
            <strong>编配预览已锁定</strong>
            先完成原谱校对并确认，避免错误音符进入后续输出。
          </p>
        </div>
      ) : null}

      <div className="arrangement-columns">
        <div>
          <div className="section-heading">
            <div>
              <span>左手伴奏难度</span>
              <small>所有模式均由同一和弦时间线生成</small>
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
                <strong>{item.title}</strong>
                <small>{item.description}</small>
                <i />
              </button>
            ))}
          </div>
        </div>

        <div className="chord-editor-panel">
          <div className="section-heading">
            <div>
              <span>和弦进行</span>
              <small>点击小节后可修改并锁定</small>
            </div>
            <button disabled={!confirmed} onClick={onReharmonize} type="button">
              ↻ 重新编配
            </button>
          </div>
          <div className="chord-sequence">
            {harmony.map((chord) => (
              <button
                className={[
                  chord.measureNumber === selectedMeasure ? "active" : "",
                  chord.locked ? "locked" : "",
                ].join(" ")}
                disabled={!confirmed}
                key={chord.measureNumber}
                onClick={() => onSelectMeasure(chord.measureNumber)}
                type="button"
              >
                <small>M{chord.measureNumber}</small>
                <strong>{chord.symbol}</strong>
                <span>{Math.round(chord.confidence * 100)}%</span>
                {chord.locked ? <i>⌕</i> : null}
              </button>
            ))}
          </div>

          {selectedChord ? (
            <div className="selected-chord-editor">
              <div className="chord-name">
                <span>第 {selectedChord.measureNumber} 小节</span>
                <strong>{selectedChord.symbol}</strong>
                <small>{chordSolfege(selectedChord, song)}</small>
              </div>
              <label>
                替换和弦
                <select
                  disabled={!confirmed}
                  onChange={(event) =>
                    onChordChange(selectedChord.measureNumber, event.target.value)
                  }
                  value={selectedChord.symbol}
                >
                  {palette.map((chord) => (
                    <option key={chord.symbol} value={chord.symbol}>
                      {chord.symbol} · {chordSolfege(chord, song)}
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
                锁定本小节
              </label>
            </div>
          ) : null}
        </div>
      </div>

      <footer className="arrangement-footer">
        <div>
          <span className="hand-key right">R</span>
          <p>
            <strong>右手推荐指法</strong>
            已计算连续手位；人工锁定的指法不会被覆盖。
          </p>
        </div>
        <button disabled={!confirmed} onClick={onRecomputeFingering} type="button">
          ↻ 重算未锁定指法
        </button>
      </footer>
    </section>
  );
}
