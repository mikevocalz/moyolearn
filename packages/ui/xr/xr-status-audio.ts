'use client';
// Web twin of `xr-status-audio.native.ts` — the WebXR surfaces do not ship
// earcons yet; the no-op keeps the shared call sites platform-clean.
// SOT-KEYWORDS: xr status audio earcon cue web noop

export type XrStatusCue = 'ready' | 'error' | 'askStart' | 'askEnd' | 'tool' | 'armed' | 'submit';

export function playXrStatusCue(_cue: XrStatusCue): void {}
