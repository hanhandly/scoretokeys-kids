import { useRef, useState } from "react";
import type { ScoreEvent, SongModel } from "../types";
import {
  getLowConfidenceEvents,
  averageRecognitionConfidence,
} from "../core/model";
import { keyPrefersFlats, midiToPitchName } from "../core/theory";

interface SourceReviewProps {
  song: SongModel;
  samples: SongModel[];
  selectedEvent: ScoreEvent | null;
  selectedMeasure: number;
  confirmed: boolean;
  onSelectSample: (songId: string) => void;
  onUpload: (file: File) => void;
  onEventPatch: (patch: Partial<ScoreEvent>) => void;
  onNextLowConfidence: () => void;
  onAddNote: () => void;
  onDeleteNote: () => void;
  onConfirm: () => void;
}

const PITCH_OPTIONS = Array.from({ length: 49 }, (_, index) => 48 + index);
const DURATION_OPTIONS = [
  { value: 0.25, label: "十六分音符 · ¼ 拍" },
  { value: 0.5, label: "八分音符 · ½ 拍" },
  { value: 1, label: "四分音符 · 1 拍" },
  { value: 1.5, label: "附点四分 · 1½ 拍" },
  { value: 2, label: "二分音符 · 2 拍" },
  { value: 3, label: "附点二分 · 3 拍" },
  { value: 4, label: "全音符 · 4 拍" },
];

export function SourceReview({
  song,
  samples,
  selectedEvent,
  selectedMeasure,
  confirmed,
  onSelectSample,
  onUpload,
  onEventPatch,
  onNextLowConfidence,
  onAddNote,
  onDeleteNote,
  onConfirm,
}: SourceReviewProps) {
  const [zoom, setZoom] = useState(100);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lowConfidenceEvents = getLowConfidenceEvents(song);
  const measuredConfidence = averageRecognitionConfidence(song);
  const isDevelopmentFixture =
    song.source.verificationStatus === "development-fixture";

  return (
    <section className="card source-card">
      <header className="card-header">
        <div>
          <p className="step-kicker">STEP 1 · 识谱与人工校对</p>
          <h2>先对照原谱，再生成教学材料</h2>
        </div>
        <span className={`status-pill ${confirmed ? "confirmed" : "pending"}`}>
          {confirmed ? "✓ 已人工确认" : "待人工确认"}
        </span>
      </header>

      <div className="sample-switcher" role="tablist" aria-label="测试乐谱">
        {samples.map((sample) => (
          <button
            className={song.id === sample.id ? "active" : ""}
            key={sample.id}
            onClick={() => onSelectSample(sample.id)}
            role="tab"
            type="button"
          >
            <img src={sample.source.imagePath} alt="" />
            <span>
              <strong>{sample.title}</strong>
              <small>
                {sample.source.notation === "staff" ? "五线谱" : "数字简谱"} ·{" "}
                {sample.source.verificationStatus === "development-fixture"
                  ? "开发 fixture"
                  : `${Math.round(sample.source.overallConfidence * 100)}%`}
              </small>
            </span>
          </button>
        ))}
        <button
          className="upload-sample"
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          <span className="upload-icon">＋</span>
          <span>
            <strong>上传其他图片</strong>
            <small>进入空白校对模式</small>
          </span>
        </button>
        <input
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="visually-hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file);
            event.target.value = "";
          }}
          ref={fileInputRef}
          type="file"
        />
      </div>

      <div className="review-workspace">
        <div className="source-preview">
          <div className="panel-toolbar">
            <span>原始乐谱</span>
            <label>
              缩放
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
          <div className="image-viewport">
            <img
              src={song.source.imagePath}
              alt={`${song.title} 原始乐谱`}
              style={{ width: `${zoom}%` }}
            />
          </div>
          <p className="source-attribution">{song.source.attribution}</p>
        </div>

        <div className="recognition-panel">
          <div className="recognition-summary">
            <div className="confidence-ring" style={{ "--value": measuredConfidence } as React.CSSProperties}>
              <strong>{Math.round(measuredConfidence * 100)}%</strong>
              <small>{isDevelopmentFixture ? "开发期标记" : "综合置信度"}</small>
            </div>
            <div>
              <span className="ai-label">✦ {song.source.recognizer}</span>
              <h3>{song.title}</h3>
              <p>
                1={song.key} · {song.timeSignature.beats}/
                {song.timeSignature.beatType} · {song.tempo} BPM
              </p>
              <small>{song.source.coverage}</small>
            </div>
          </div>

          <ul className="recognition-notes">
            {song.source.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>

          <div className="verification-foundation">
            <div>
              <strong>正式识别链路</strong>
              <span>GPT-5.5 Reader A</span>
              <span>Gemini 3.1 Pro Reader B</span>
              <span>GPT-5.6 Sol Judge</span>
            </div>
            <p>
              {isDevelopmentFixture
                ? "当前测试曲仍来自人工校对 fixture，不会伪装成在线双模型确认。"
                : "未解决的模型分歧必须进入人工校对，不能静默放行。"}
            </p>
          </div>

          <div className="review-alert">
            <span className="alert-count">{lowConfidenceEvents.length}</span>
            <div>
              <strong>处待确认音符</strong>
              <small>橙色标记不会被系统静默忽略</small>
            </div>
            <button
              disabled={lowConfidenceEvents.length === 0}
              onClick={onNextLowConfidence}
              type="button"
            >
              定位下一个
            </button>
          </div>

          <div className="note-inspector">
            <div className="inspector-title">
              <div>
                <span>音符校对器</span>
                <strong>
                  {selectedEvent
                    ? `第 ${selectedMeasure} 小节 · ${selectedEvent.midi === null ? "休止符" : midiToPitchName(selectedEvent.midi, keyPrefersFlats(song.key))}`
                    : `第 ${selectedMeasure} 小节`}
                </strong>
              </div>
              <button onClick={onAddNote} type="button">
                ＋ 添加音符
              </button>
            </div>

            {selectedEvent ? (
              <>
                <div className="form-grid">
                  <label>
                    音高
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
                      <option value="rest">0 · 休止符</option>
                      {PITCH_OPTIONS.map((midi) => (
                        <option key={midi} value={midi}>
                          {midiToPitchName(midi, keyPrefersFlats(song.key))}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    时值
                    <select
                      onChange={(event) =>
                        onEventPatch({ durationBeats: Number(event.target.value) })
                      }
                      value={selectedEvent.durationBeats}
                    >
                      {DURATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="lyric-field">
                    歌词 / 提示
                    <input
                      onChange={(event) => onEventPatch({ lyric: event.target.value })}
                      placeholder="可留空"
                      type="text"
                      value={selectedEvent.lyric ?? ""}
                    />
                  </label>
                </div>

                <div className="finger-editor">
                  <span>右手指法</span>
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
                    锁定
                  </label>
                </div>

                <div className="confidence-editor">
                  <span>识别置信度</span>
                  <div className="confidence-track">
                    <i style={{ width: `${selectedEvent.confidence * 100}%` }} />
                  </div>
                  <strong>{Math.round(selectedEvent.confidence * 100)}%</strong>
                  <button
                    disabled={selectedEvent.confidence >= 1}
                    onClick={() => onEventPatch({ confidence: 1 })}
                    type="button"
                  >
                    确认本音
                  </button>
                  <button className="danger-link" onClick={onDeleteNote} type="button">
                    删除
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-inspector">
                这个小节还没有音符。点击“添加音符”开始手动校对。
              </div>
            )}
          </div>

          <button className="confirm-button" onClick={onConfirm} type="button">
            {confirmed ? "重新确认当前校对结果" : "确认校对，生成双手教学谱"}
            <span>→</span>
          </button>
        </div>
      </div>
    </section>
  );
}
