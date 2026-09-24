'use client';
// The native fork of CollapsiblePane: the same contract, with the width tween
// on the UI thread.
//
// WHY A FORK. The shared file animates width through Legend Motion, which is
// RN `Animated` and JS-driven for width. On the iPhone Duo the JS thread is
// also Natalie's render loop (three.js over WebGPU, 60 times a second), so a
// JS-driven tween runs only in the gaps and the panes open in steps. Android
// looked smooth because that thread is lighter there, not because the tween
// was. Reanimated applies a `width` style from the UI thread and commits the
// layout itself, so the neighbours still reflow frame by frame — the whole
// reason this is a width animation and not a slide — without waiting on JS.
// Web keeps the Legend Motion file: Reanimated is native-only in this kit
// (README, "Animation boundary").
//
// The measurement dance (`measured`, `grown`) is copied, not reinvented; read
// the shared file for why a fill pane must animate from the width it grew to.
// SOT: ./CollapsiblePane.tsx · ./README.md
// SOT-KEYWORDS: collapsible pane width animate reanimated ui thread native fork
import { useEffect, useState } from 'react';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { css } from '../html/css';
import { View } from '../tw';
import type { CollapsiblePaneProps } from './CollapsiblePane';
import { TRANSITIONS } from './transitions.ts';

const AnimatedPane = css(Animated.View, 'CollapsiblePane');

// The same token as the shared file, read once. Reanimated has no string
// easing names, so the tween's `easeInOut` is spelled with its own curve.
const PANE_WIDTH = {
  duration: TRANSITIONS.paneWidth.duration,
  easing: Easing.inOut(Easing.ease),
};

export function CollapsiblePane({ width, open, fill, children, className }: CollapsiblePaneProps) {
  const [measured, setMeasured] = useState<number | null>(null);
  const [grown, setGrown] = useState(false);
  if (grown && !(open && fill)) setGrown(false);
  const contentWidth = fill ? (measured ?? width) : width;
  const target = open ? contentWidth : 0;

  const paneWidth = useSharedValue(target);
  useEffect(() => {
    paneWidth.value = withTiming(target, PANE_WIDTH, (finished) => {
      'worklet';
      // `grown` is React state; the callback runs on the UI thread.
      if (finished && open && fill) scheduleOnRN(setGrown, true);
    });
  }, [paneWidth, target, open, fill]);

  // The animated width is the flex BASIS once grown, and `grow` absorbs the
  // remainder — the same handoff the shared file describes.
  const style = useAnimatedStyle(() => ({ width: paneWidth.value }));

  return (
    <AnimatedPane
      style={style}
      onLayout={
        fill
          ? (event: { nativeEvent: { layout: { width: number } } }) => {
              const laid = event.nativeEvent.layout.width;
              if (grown && Math.abs(laid - (measured ?? 0)) > 1) setMeasured(laid);
            }
          : undefined
      }
      className={`overflow-hidden ${grown ? 'grow' : ''} ${className ?? ''}`}
    >
      <View
        style={grown ? undefined : { width: contentWidth }}
        className="flex-1"
        aria-hidden={!open}
        pointerEvents={open ? 'auto' : 'none'}
      >
        {children}
      </View>
    </AnimatedPane>
  );
}
