'use client';
// Mobbin: https://mobbin.com/screens/1764602c-b875-482f-a13f-059bf78c15b7 (Plain —
//   fixed-width leading list column beside a flexible detail region) ·
//   https://mobbin.com/screens/0b8a7848-7bbb-4b35-8999-d71b47f469c3 (Featurebase —
//   inbox columns that collapse away while the conversation keeps the width).
//   Structure only.
// SOT: docs/pack/37-onboarding-dual-pane.md §3.2 · ./README.md
// SOT-KEYWORDS: collapsible pane width animate reflow leading column
import { useEffect, useState } from 'react';
import { MotionView } from '../motion';
import { View } from '../tw';
import { TRANSITIONS } from './transitions.ts';

export interface CollapsiblePaneProps {
  /** Width in dp when open. */
  width: number;
  open: boolean;
  /**
   * Take the leftover width as well as the fixed one.
   *
   * The trailing detail pane is normally the flexible one, so the leading panes
   * are all fixed. Hide the detail and nothing is left to absorb the window:
   * the panes sit at their token widths and the rest of the screen is a band of
   * background. Whichever pane is LAST STANDING gets this, so "hide Natalie" on
   * the tutor session gives the conversation the window rather than leaving a
   * hole where she was.
   *
   * `grow`, not `flex-1`: `flex-1` sets `flex-basis: 0%`, which would discard
   * the animated width this pane collapses along. Growing FROM the width keeps
   * the collapse animation intact and simply lets the pane expand past it.
   */
  fill?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * A leading pane that collapses to zero width instead of vanishing.
 *
 * WHY WIDTH AND NOT translateX: sliding the pane out with a native-driven
 * transform would leave its width in the layout, so the detail pane would keep
 * its old size and a blank strip would sit where the pane used to be. The
 * neighbours have to reflow, and only an animated width makes them do it
 * continuously — the detail pane is `flex-1`, so it grows frame by frame as
 * this shrinks.
 *
 * Width is not on React Native's native-driver list, so this animation runs on
 * the JS thread. That is the cost of neighbours reflowing, and it is why this
 * node animates WIDTH AND NOTHING ELSE: mixing a JS-driven property with a
 * native-driven one on a single component is unsupported by RN's Animated, and
 * Legend Motion inherits that constraint.
 *
 * The child keeps its full width on a plain inner View, so text inside the pane
 * does not re-wrap on every frame of the collapse — the pane is clipped rather
 * than reflowed internally.
 */
export function CollapsiblePane({ width, open, fill, children, className }: CollapsiblePaneProps) {
  /*
    THE FILL PANE'S SNAP, and why a filling pane needs a measured width.

    `grow` was a class swap: the frame `open` flipped false the pane fell from
    its GROWN width (the window's leftover — often two or three times the
    token) to the token, and only then animated token → 0. Two of the three
    tutor panes never fill, so they always animated smoothly; the third —
    Natalie's — was the fill pane, and it was the one that snapped.

    So the pane records the width it actually grew to, and animates from THAT.
    The sequence: opening animates 0 → (last measured, or the token on a
    first-ever open); `onAnimationComplete` then applies `grow`, at which
    point the explicit width is the flex BASIS and grow absorbs any remainder
    — a seamless handoff when the window has not changed, a short animated
    catch-up when it has (onLayout keeps the measurement current while
    grown). Closing drops `grow` but the animated width IS the measured value
    it was displaying, so the collapse starts from the exact width on screen.

    The inner child holds the measured width too, which is what keeps a 3D
    canvas in a fill pane from being resized during the animation at all: the
    clip moves, the content does not.
  */
  const [measured, setMeasured] = useState<number | null>(null);
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    if (!(open && fill)) setGrown(false);
  }, [open, fill]);
  const contentWidth = fill ? (measured ?? width) : width;
  return (
    <MotionView
      animate={{ width: open ? contentWidth : 0 }}
      transition={TRANSITIONS.paneWidth}
      onAnimationComplete={(key: string) => {
        if (key === 'width' && open && fill) setGrown(true);
      }}
      onLayout={
        fill
          ? (event: { nativeEvent: { layout: { width: number } } }) => {
              const laid = event.nativeEvent.layout.width;
              // Only while grown: mid-animation the layout IS the animation,
              // and recording it would re-target the tween to its own frames.
              if (grown && Math.abs(laid - (measured ?? 0)) > 1) setMeasured(laid);
            }
          : undefined
      }
      className={`overflow-hidden ${grown ? 'grow' : ''} ${className ?? ''}`}
    >
      {/*
        Clipping only hides a collapsed pane from SIGHT. Its children keep their
        layout inside the clip, so a screen reader still walks them and taps
        still land on them at the pane's old bounds — `describe` reported the
        whole hidden sidebar. Hiding it from the a11y tree and dropping pointer
        events makes "collapsed" mean the same thing to every input method,
        while the subtree stays mounted so scroll position and selection
        survive the collapse.
      */}
      <View
        /* Grown, the content follows the pane. Every other moment — closed,
           closing, or opening — it holds the last real width, so nothing
           inside re-wraps or resizes while the clip moves over it. */
        style={grown ? undefined : { width: contentWidth }}
        className="flex-1"
        aria-hidden={!open}
        pointerEvents={open ? 'auto' : 'none'}
      >
        {children}
      </View>
    </MotionView>
  );
}
