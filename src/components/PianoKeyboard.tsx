import { useLayoutEffect, useRef } from "react";
import type { PerformanceEvent } from "../types";
import { isBlackKey, midiToPitchName } from "../core/theory";
import { useI18n } from "../i18n/I18nProvider";
import { formatAccidentals } from "../i18n/messages";

interface PianoKeyboardProps {
  activeEvents: PerformanceEvent[];
  rightEnabled: boolean;
  leftEnabled: boolean;
}

interface KeyPosition {
  midi: number;
  whiteIndex: number;
}

const START_MIDI = 36;
const END_MIDI = 96;
const ALL_KEYS = Array.from(
  { length: END_MIDI - START_MIDI + 1 },
  (_, index) => START_MIDI + index,
);
const WHITE_KEYS = ALL_KEYS.filter((midi) => !isBlackKey(midi));
const WHITE_COUNT = WHITE_KEYS.length;

function buildKeyPositions(): KeyPosition[] {
  let whiteIndex = 0;
  return ALL_KEYS.map((midi) => {
    if (isBlackKey(midi)) {
      return { midi, whiteIndex };
    }
    const position = { midi, whiteIndex };
    whiteIndex += 1;
    return position;
  });
}

const KEY_POSITIONS = buildKeyPositions();

function keyCenterPercent(midi: number): number {
  const position = KEY_POSITIONS.find((item) => item.midi === midi);
  if (!position) return 50;
  if (isBlackKey(midi)) return (position.whiteIndex / WHITE_COUNT) * 100;
  return ((position.whiteIndex + 0.5) / WHITE_COUNT) * 100;
}

function activeForMidi(
  activeEvents: PerformanceEvent[],
  midi: number,
): PerformanceEvent[] {
  return activeEvents.filter((event) => event.midi === midi);
}

function HandMarker({
  hand,
  event,
}: {
  hand: "right" | "left";
  event: PerformanceEvent | undefined;
}) {
  const { t } = useI18n();
  if (!event) return null;
  return (
    <div
      className={`hand-marker ${hand}`}
      style={{ left: `${keyCenterPercent(event.midi)}%` }}
    >
      <span className="palm">
        {t(hand === "right" ? "keyboard.rightHand" : "keyboard.leftHand")}
      </span>
      <span className="active-finger">
        {t("keyboard.finger", { number: event.finger })}
      </span>
      <i />
    </div>
  );
}

export function PianoKeyboard({
  activeEvents,
  rightEnabled,
  leftEnabled,
}: PianoKeyboardProps) {
  const { t } = useI18n();
  const viewportRef = useRef<HTMLDivElement>(null);
  const rightEvent = activeEvents.find((event) => event.hand === "right");
  const leftEvent = activeEvents.find((event) => event.hand === "left");
  const focusMidi =
    rightEvent && leftEvent
      ? Math.round((rightEvent.midi + leftEvent.midi) / 2)
      : rightEvent?.midi ?? leftEvent?.midi;

  useLayoutEffect(() => {
    if (focusMidi === undefined) return;
    const viewport = viewportRef.current;
    const key = viewport?.querySelector<HTMLElement>(
      `[data-midi="${focusMidi}"]`,
    );
    if (!viewport || !key) return;
    const targetLeft =
      key.offsetLeft - viewport.clientWidth / 2 + key.offsetWidth / 2;
    viewport.scrollTo({
      behavior: activeEvents.length > 0 ? "auto" : "smooth",
      left: Math.max(0, targetLeft),
    });
  }, [focusMidi]);

  return (
    <div className="keyboard-stage">
      <p className="keyboard-status" role="status">
        {focusMidi === undefined
          ? t("keyboard.waiting")
          : `${t("keyboard.currentKey", {
              pitch: formatAccidentals(midiToPitchName(focusMidi)),
            })}${rightEvent?.cue ? ` · ${rightEvent.cue}` : ""}`}
      </p>
      <div className="keyboard-scroll" ref={viewportRef}>
        <div className="keyboard-track">
          <div className="hand-lane" aria-hidden="true">
            {rightEnabled ? <HandMarker hand="right" event={rightEvent} /> : null}
            {leftEnabled ? <HandMarker hand="left" event={leftEvent} /> : null}
          </div>
          <div className="keyboard" aria-hidden="true">
            <div className="white-keys">
              {WHITE_KEYS.map((midi) => {
                const active = activeForMidi(activeEvents, midi);
                const hands = new Set(active.map((event) => event.hand));
                return (
                  <div
                    className={[
                      "piano-key white",
                      hands.has("right") ? "right-active" : "",
                      hands.has("left") ? "left-active" : "",
                    ].join(" ")}
                    data-midi={midi}
                    key={`${midi}-${active[0]?.id ?? "idle"}`}
                  >
                    {midi % 12 === 0 ? (
                      <small>
                        {formatAccidentals(midiToPitchName(midi))}
                      </small>
                    ) : null}
                    {active[0] ? <strong>{active[0].finger}</strong> : null}
                  </div>
                );
              })}
            </div>
            {KEY_POSITIONS.filter((position) => isBlackKey(position.midi)).map(
              ({ midi, whiteIndex }) => {
                const active = activeForMidi(activeEvents, midi);
                const hands = new Set(active.map((event) => event.hand));
                return (
                  <div
                    className={[
                      "piano-key black",
                      hands.has("right") ? "right-active" : "",
                      hands.has("left") ? "left-active" : "",
                    ].join(" ")}
                    data-midi={midi}
                    key={`${midi}-${active[0]?.id ?? "idle"}`}
                    style={{ left: `${(whiteIndex / WHITE_COUNT) * 100}%` }}
                  >
                    {active[0] ? <strong>{active[0].finger}</strong> : null}
                  </div>
                );
              },
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
