// Recording limits, in one place because three surfaces have to agree on them:
// the recorder that enforces them, the UI that states them before you press
// record, and the presign that rejects an oversized file.
//
// A limit the user meets as a rejection is a limit they met too late (doc 30's
// dropzone rules), which is why the cap is shown next to the elapsed time from
// the first frame rather than announced when it is hit.
// SOT-KEYWORDS: video note limits duration size recording constants
export const VIDEO_MAX_SECONDS = 180;
export const VIDEO_MAX_BYTES = 500 * 1024 * 1024;

/** `0:07 / 3:00` — elapsed and cap together, never elapsed alone. */
export const formatClock = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
