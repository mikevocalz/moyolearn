'use client';
// Mobbin: https://mobbin.com/screens/1764602c-b875-482f-a13f-059bf78c15b7 (Plain —
//   fixed-width leading list column beside a flexible detail region) ·
//   https://mobbin.com/screens/0b8a7848-7bbb-4b35-8999-d71b47f469c3 (Featurebase —
//   inbox columns that collapse away while the conversation keeps the width).
//   Structure only.
// SOT: docs/pack/37-onboarding-dual-pane.md §3.2 · ./README.md
// SOT-KEYWORDS: collapsible pane width animate reflow leading column
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
  return (
    <MotionView
      animate={{ width: open ? width : 0 }}
      transition={TRANSITIONS.paneWidth}
      className={`overflow-hidden ${fill && open ? 'grow' : ''} ${className ?? ''}`}
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
        /* No fixed inner width while filling — the whole point is that the
           content follows the pane rather than being clipped to a token. */
        style={fill && open ? undefined : { width }}
        className="flex-1"
        aria-hidden={!open}
        pointerEvents={open ? 'auto' : 'none'}
      >
        {children}
      </View>
    </MotionView>
  );
}
