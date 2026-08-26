'use client';
// Neither recorder exists on web, so neither handler is supplied and the
// registry hides both buttons.
//
// This is the fix for a gate that was only ever claimed: `AudioRecorderSheet.web`
// documented the button as "hidden on web by the same mechanism — isEnabled",
// but the host screen supplied `recordAudio` on every platform, so the button
// rendered and tapping it resolved to nothing. A control that appears and then
// silently does nothing is worse than one that is absent.
//
// Audio would need `MediaRecorder` and video would need a different component
// entirely; both are real work, not a shim, and neither belongs behind a button
// that pretends they are already there.
// SOT-KEYWORDS: record media platform gate web unavailable capability hidden
export const useRecordAudio = (): undefined => undefined;
export const useRecordVideo = (): undefined => undefined;
