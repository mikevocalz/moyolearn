'use client';
// Recording is native-only here.
//
// VisionCamera has no web build, and browser capture is `MediaRecorder` — a
// different component, not a shim. The toolbar button is hidden by
// `record-media.web`, which supplies no `recordVideo` handler.
//
// This settles any request that opens anyway, so a promise can never hang. The
// sheet resolves rather than renders: a dialog that cannot record is worse than
// no dialog.
// SOT-KEYWORDS: video note sheet web unavailable backstop resolve
import { useVideoStore } from './video.store.ts';

export function VideoNoteSheet() {
  const open = useVideoStore((state) => state.open);
  const resolve = useVideoStore((state) => state.resolve);
  if (open) resolve(null);
  return null;
}
