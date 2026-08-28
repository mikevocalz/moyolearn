'use client';
// PLATFORM FORK — nothing on web. `guided-frame.tsx` has no viewfinder there
// (the web capture path is the file/photo picker), so a card teaching how to
// frame a Snap would be teaching a control that is not on the screen.
// SOT: ./capture-tip.tsx · ./guided-frame.tsx
// SOT-KEYWORDS: capture tip coach mark web no camera fork

import type { AgeBand } from './age-band';

export interface CaptureTipProps {
  ageBand: AgeBand;
}

export function CaptureTip(_props: CaptureTipProps) {
  return null;
}
