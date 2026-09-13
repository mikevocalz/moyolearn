'use client';
// The way into the spatial whiteboard, from the tutor's own alcove.
//
// WHY A COMPACT PILL AND NOT A PRIMARY BUTTON. It is an alternative view of
// work the child can already do, not a thing to do — the Apple Store's product
// pages put "AR" beside "Gallery" for exactly that reason rather than under the
// buy button, and adidas's "Try it in AR" sits with the product rather than
// above it. A learner who ignores this control loses nothing, and one who
// presses it arrives at the same board. Its prominence says so.
//
// IT IS DRAWN IN ONE PLACE AT A TIME. `TutorStage` passes it to her rail while
// her pane is closed and into the pane when it opens; this component does not
// know which, and must not — a control that decides its own placement is a
// control that ends up in both.
//
// The target comes from the age band, never from a number here: a K–2 learner's
// 72dp floor applies to a door into a headset exactly as it does to everything
// else on a learner surface (`tooling/check-targets.mjs`).
// Mobbin: https://mobbin.com/flows/e904a631-5166-4731-8f4d-0aa49fdff1b0 (Apple Store — the AR entry is a compact labelled pill beside the content it belongs to, never a primary action) · https://mobbin.com/flows/bef3926b-7c0c-4498-b348-c84321d2085b (adidas "Try it in AR" — an honest loading state before the scene, and the return lands back on the same item) · https://mobbin.com/flows/75a9cd59-2d5b-48c5-9ca7-7aacd81f8eca (Best Buy — the AR affordance sits with the object, not in the chrome). Structure only.
// SOT: packages/theme/tokens.ts · packages/app/features/tutor/xr-session.store.ts
// SOT-KEYWORDS: xr button spatial whiteboard entry pill tutor detail rail age band target

import { Box } from './icons';
import { PressScale } from './press-scale';
import { Text } from './Text';
import { View } from './primitives';

export interface XrBoardButtonProps {
  /** The age band's control size, from `buttonSizeForBand`. */
  size: 'sm' | 'md' | 'lg' | 'xl';
  /** True between the press and the scene being on screen. */
  entering: boolean;
  /**
   * False when this device cannot open a spatial board. The control is not
   * rendered at all then: an offer a child cannot take is worse than no offer,
   * and there is nothing here for them to fix.
   */
  available: boolean;
  /** Room for the word as well as the mark. Narrow rails get the mark alone. */
  showLabel?: boolean;
  onPress: () => void;
}

const PADDING = {
  sm: 'px-element py-element',
  md: 'px-element py-element',
  lg: 'px-group py-element',
  xl: 'px-group py-group',
} as const;

const GLYPH = { sm: 16, md: 18, lg: 20, xl: 24 } as const;

export function XrBoardButton({
  size,
  entering,
  available,
  showLabel = true,
  onPress,
}: XrBoardButtonProps) {
  if (!available) return null;

  return (
    <PressScale
      className={`flex-row items-center gap-element rounded-control bg-surface-raised border-2 border-border-strong ${PADDING[size]}`}
      onPress={entering ? undefined : onPress}
      role="button"
      /*
        What it does, not what it is. "XR" is a name for the technology; a child
        looking for their board is looking for their board.
      */
      aria-label="Open spatial whiteboard"
      aria-disabled={entering}>
      <Box size={GLYPH[size]} />
      {showLabel ? (
        <View>
          <Text variant="caption">{entering ? 'Opening…' : 'XR'}</Text>
        </View>
      ) : null}
    </PressScale>
  );
}
