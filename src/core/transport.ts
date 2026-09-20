import type { PerformanceEvent } from "../types";

export interface EnabledHands {
  right: boolean;
  left: boolean;
}

export function getActivePerformanceEvents(
  events: PerformanceEvent[],
  positionBeat: number,
  enabledHands: EnabledHands,
): PerformanceEvent[] {
  return events.filter((event) => {
    const enabled =
      event.hand === "right" ? enabledHands.right : enabledHands.left;
    return (
      enabled &&
      positionBeat >= event.startBeat &&
      positionBeat < event.startBeat + event.durationBeats
    );
  });
}
