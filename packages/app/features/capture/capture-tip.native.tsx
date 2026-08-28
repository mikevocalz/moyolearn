'use client';
// PLATFORM FORK — the Snap tip, native only, because native is where a live
// viewfinder exists (`guided-frame.native.tsx`). Docked under the frame as a
// sibling so it can never cover the capture control, and so dismissing it hands
// the space back to the camera.
//
// It teaches ONLY the framing. Permission is already asked at the camera by
// `guided-frame.native.tsx` (doc 37 §1.5), and the real-time hints already
// correct a shot in progress — this is the one sentence neither of those can
// say, which is what a good Snap looks like BEFORE the first one.
// SOT: ./capture-tip.tsx · docs/pack/37-onboarding-dual-pane.md §1.2 §4 · docs/pack/24-homework-capture-spec.md §2
// SOT-KEYWORDS: capture tip coach mark snap camera at camera age band native

import { CoachMark } from '@acme/ui';
import { Camera } from '@acme/ui/icons';
import { buttonSizeForBand, type AgeBand } from './age-band';

/**
 * Band copy, on the same rule as `captureLabelsForBand`: K–2 gets an
 * instruction it can act on without reading a clause, and nobody gets a
 * sentence about why this matters. A tip on a child's screen says one thing.
 */
const COPY = {
  young: {
    title: 'Put the page in the box',
    body: 'Hold the phone flat over your page so the whole page fits inside the box. Then press Snap.',
    dismiss: 'OK',
  },
  child: {
    title: 'Snap one problem',
    body: 'Line the page up inside the box and press Snap. One problem at a time works best.',
    dismiss: 'Got it',
  },
  teen: {
    title: 'How Snap works',
    body: 'Fill the frame with the page and tap Snap. One problem per shot gives the clearest read.',
    dismiss: 'Got it',
  },
  adult: {
    title: 'How Snap works',
    body: 'Fill the frame with the page and tap Snap. One problem per shot gives the clearest read.',
    dismiss: 'Got it',
  },
} as const satisfies Record<AgeBand, { title: string; body: string; dismiss: string }>;

export interface CaptureTipProps {
  ageBand: AgeBand;
}

export function CaptureTip({ ageBand }: CaptureTipProps) {
  const copy = COPY[ageBand];
  return (
    <CoachMark
      id="capture-snap"
      title={copy.title}
      body={copy.body}
      dismissLabel={copy.dismiss}
      icon={<Camera size={18} className="text-text" />}
      // The frame and the Snap button are ABOVE this card, so the caret points up.
      placement="below"
      // The dismiss control is a control on a child's screen: it takes the
      // band's target like every other one (doc 08 §2.4).
      size={buttonSizeForBand(ageBand)}
      className="p-inset"
    />
  );
}
