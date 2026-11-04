/** Native Muse fields required before the connection UI may report verified tracking. */
export interface MuseVerificationFrame {
  readonly tracked: boolean;
  readonly position: readonly number[] | null;
  readonly pressure: number;
}

/** Accepts a real tracked pose and measured pressure, including zero. */
export function canVerifyMuseFrame(frame: MuseVerificationFrame): boolean {
  return frame.tracked && frame.position !== null && frame.position.length === 3 &&
    frame.position.every(Number.isFinite) && Number.isFinite(frame.pressure) && frame.pressure >= 0 && frame.pressure <= 1;
}
