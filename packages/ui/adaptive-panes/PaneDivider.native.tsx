'use client';
// PLATFORM FORK — native: the drag gesture plus the keyboard affordance. The
// web fork keeps only the keyboard path, so react-native-gesture-handler stays
// out of the Next bundle (which lists it in no transpilePackages — the same
// trade the schedule feature's EventDrag fork records).
// Mobbin: https://mobbin.com/screens/1764602c-b875-482f-a13f-059bf78c15b7 (Plain —
//   hairline divider between list column and detail region) ·
//   https://mobbin.com/screens/0b8a7848-7bbb-4b35-8999-d71b47f469c3 (Featurebase —
//   full-height column seams in a multi-pane inbox). Structure only.
// SOT: docs/pack/37-onboarding-dual-pane.md §3.2 · ./README.md
// SOT-KEYWORDS: pane divider drag resize gesture handler native fork
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { View, Pressable } from '../tw';
import {
  PRIMARY_WIDTH_MAX,
  PRIMARY_WIDTH_MIN,
  RESIZE_KEYBOARD_STEP,
  widthAfterDrag,
} from './resize';
import { useAdaptivePanesStore } from './context';
import type { PaneDividerProps } from './PaneDivider.types';

export type { PaneDividerProps };

/**
 * Drag-to-resize affordance between the leading pane and its neighbour.
 *
 * GESTURE ARBITRATION.
 * There is nothing to arbitrate against by construction: the split view has no
 * other horizontal recognizer — collapse is derived from the window size class
 * and column stepping comes from Back — and this pan is confined to the
 * divider's own hit area, which is disjoint from the detail pane where a
 * detail surface's horizontal scroll lives. Two recognizers that can never
 * receive the same pointer do not need a race.
 *
 * The one rule that keeps it that way: this divider must NOT grow its hit slop
 * into the detail pane. If it ever needs a wider target, the pan has to be
 * composed against the detail's scroll with `useCompetingGestures` and the
 * arbitration written down here, because at that point they genuinely do
 * compete for the same pointer.
 *
 * API note: Gesture Handler 2.x (the version Expo SDK 57 pins), so this is the
 * builder API — `Gesture.Pan()` + `GestureDetector`, composed with
 * `Gesture.Race()`/`Gesture.Simultaneous()` if it ever needs to be. GH 3.x
 * deprecates the builder in favour of `usePanGesture` and the `use*Gestures`
 * hooks; revisit if the SDK moves forward again.
 *
 * `.runOnJS(true)` because the handler writes to a Zustand store, which is not
 * worklet-safe. The resize is a low-frequency drag, so keeping it on the JS
 * thread is the correct trade rather than marshalling through runOnJS per frame.
 */
export function PaneDivider({ width }: PaneDividerProps) {
  const setPrimaryWidth = useAdaptivePanesStore((state) => state.setPrimaryWidth);
  const resetPrimaryWidth = useAdaptivePanesStore((state) => state.resetPrimaryWidth);

  // Resolve from the width the drag STARTED at plus the total translation.
  // Accumulating per-frame deltas drifts once the pointer crosses a clamp
  // boundary and returns — see widthAfterDrag.
  const pan = Gesture.Pan()
    .runOnJS(true)
    .onUpdate((event) => {
      setPrimaryWidth(widthAfterDrag(width, event.translationX));
    });

  return (
    <GestureDetector gesture={pan}>
      <View className="h-full w-1 bg-border">
        {/* Keyboard affordance: a real <button> on web, Pressable on native.
            Double-press restores the token width. */}
        <Pressable
          accessibilityLabel="Resize sidebar"
          role="separator"
          aria-valuenow={width}
          aria-valuemin={PRIMARY_WIDTH_MIN}
          aria-valuemax={PRIMARY_WIDTH_MAX}
          onPress={resetPrimaryWidth}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            const step = event.key === 'ArrowRight' ? RESIZE_KEYBOARD_STEP : -RESIZE_KEYBOARD_STEP;
            setPrimaryWidth(width + step);
          }}
          className="h-full w-4 -translate-x-1.5"
        />
      </View>
    </GestureDetector>
  );
}
