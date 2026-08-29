import type { PerformanceEvent } from "../types";
import { isBlackKey, midiToPitchName } from "../core/theory";

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
  if (!event) return null;
  return (
    <div
      className={`hand-marker ${hand}`}
      style={{ left: `${keyCenterPercent(event.midi)}%` }}
    >
      <span className="palm">{hand === "right" ? "右手" : "左手"}</span>
      <span className="active-finger">手指 {event.finger}</span>
      <i />
    </div>
  );
}

export function PianoKeyboard({
  activeEvents,
  rightEnabled,
  leftEnabled,
}: PianoKeyboardProps) {
  const rightEvent = activeEvents.find((event) => event.hand === "right");
  const leftEvent = activeEvents.find((event) => event.hand === "left");

  return (
    <div className="keyboard-stage">
      <div className="hand-lane" aria-live="polite">
        {rightEnabled ? <HandMarker hand="right" event={rightEvent} /> : null}
        {leftEnabled ? <HandMarker hand="left" event={leftEvent} /> : null}
      </div>
      <div className="keyboard" aria-label="61 键电子琴动画">
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
                key={midi}
              >
                {midi % 12 === 0 ? (
                  <small>{midiToPitchName(midi)}</small>
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
                key={midi}
                style={{ left: `${(whiteIndex / WHITE_COUNT) * 100}%` }}
              >
                {active[0] ? <strong>{active[0].finger}</strong> : null}
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}
