export const LEGACY_AUDIO_CALIBRATION_STORAGE_KEYS = [
  "scoretokeys-kids.audio-calibration.v1",
  "scoretokeys-kids.audio-calibration.v2",
  "scoretokeys-kids.audio-calibration.v3",
] as const;

export function clearAudioCalibrationProfile(
  storage: Pick<Storage, "removeItem">,
): void {
  for (const key of LEGACY_AUDIO_CALIBRATION_STORAGE_KEYS) {
    storage.removeItem(key);
  }
}
