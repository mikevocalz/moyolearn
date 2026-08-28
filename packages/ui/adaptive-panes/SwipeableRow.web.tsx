'use client';
// PLATFORM FORK — web: renders the row content, mounts no gesture and hides
// the swipe actions. Swipe-to-reveal is a touch idiom; a pointer-and-keyboard
// surface exposes the same action as a visible control on the row instead
// (the schedule feature's EventDrag fork records the identical trade), and
// react-native-gesture-handler + Reanimated stay out of the Next bundle,
// which lists neither in `transpilePackages`.
// Mobbin: see SwipeableRow.native.tsx — the touch fork carries the structure
//   citations; this fork draws no swipe affordance at all.
// SOT: ./swipe-actions.ts · ./README.md
// SOT-KEYWORDS: swipeable row web static no gesture fork
import { View } from '../tw';
import type { SwipeableRowProps } from './SwipeableRow.types';

/** Matches the native fork so call sites and layouts agree on the shape. */
export const ACTION_WIDTH = 88;

export type { SwipeableRowProps };

export function SwipeableRow({ children }: SwipeableRowProps) {
  return <View className="relative overflow-hidden">{children}</View>;
}
