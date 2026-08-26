'use client';
// Web cannot record here — VisionCamera is native only, and browser recording is
// MediaRecorder, a different component. Saying so beats a viewfinder that never
// lights up. The capability is hidden on web anyway (see capabilities.ts), so
// this is the belt to that braces.
// SOT-KEYWORDS: video note sheet web unavailable
export function VideoNoteSheet() {
  return null;
}
