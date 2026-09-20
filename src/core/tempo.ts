export function getSecondsPerBeat(tempo: number, speed = 1): number {
  if (!Number.isFinite(tempo) || tempo <= 0) {
    throw new Error("Tempo must be a positive finite number.");
  }
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new Error("Playback speed must be a positive finite number.");
  }
  return 60 / tempo / speed;
}

export function beatsToSeconds(
  beats: number,
  tempo: number,
  speed = 1,
): number {
  return beats * getSecondsPerBeat(tempo, speed);
}

export function secondsToBeats(
  seconds: number,
  tempo: number,
  speed = 1,
): number {
  return seconds / getSecondsPerBeat(tempo, speed);
}
