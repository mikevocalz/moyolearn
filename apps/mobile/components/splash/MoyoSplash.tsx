// The animated splash: the logomark draws itself, the wordmark follows, and the
// overlay fades off the app that was built behind it.
//
// WHY THERE IS A SECOND SPLASH AT ALL. expo-splash-screen's native splash is a
// static image that can only be shown until JS is ready — it cannot animate,
// and left on autohide it disappears the instant the first frame renders, which
// is the "no splash" this replaces. So the native one holds (its `image` and
// `backgroundColor` in app.config.ts are the FIRST frame of this animation),
// this view takes over on mount, and the mark carries on moving from where the
// static image left it. The two grounds are the same token for that reason —
// see SPLASH_GROUND.
//
// Geometry: ./moyo-paths.ts. Colour and beats: ./moyo-splash-scene.ts.
// SOT: apps/mobile/app/_layout.tsx (mount + preventAutoHide)
// SOT-KEYWORDS: splash animated boot logomark wordmark cold start

import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, { FadeOut, useReducedMotion } from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';

import { MARK, MARK_SIZE, WORDMARK, WORDMARK_SIZE } from './moyo-paths';
import { BEAT, INK, SPLASH_GROUND, SPLASH_TOTAL, WORDMARK_INK } from './moyo-splash-scene';

// The mark lands at the width the native splash drew it (`imageWidth: 200`), so
// the handoff is a continuation rather than a jump. The wordmark is sized off
// the mark, not the screen, so the lockup holds its proportions on a tablet.
const MARK_WIDTH = 200;
const WORDMARK_WIDTH = MARK_WIDTH * 1.25;
const GAP = 28;

// Keyframes rather than worklets: nothing here is gesture-driven or
// interruptible, so the whole animation is a declaration the UI thread runs on
// its own (Reanimated 4 CSS animations). No shared values, no JS↔UI crossings,
// and no per-frame React renders.
const RISE = {
  from: { opacity: 0, transform: [{ scale: 0.88 }, { translateY: 12 }] },
  to: { opacity: 1, transform: [{ scale: 1 }, { translateY: 0 }] },
};

const FOLLOW = {
  from: { opacity: 0, transform: [{ translateY: 16 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }] },
};

function Mark() {
  return (
    <Svg
      width={MARK_WIDTH}
      height={(MARK_WIDTH * MARK_SIZE.height) / MARK_SIZE.width}
      viewBox={`0 0 ${MARK_SIZE.width} ${MARK_SIZE.height}`}
    >
      {/* Paint order is the traced source's: the M, then the two book halves
          over it, then the ornaments on top. Resorting these changes the seams
          where contours meet. */}
      <Path fill={INK.plum} d={MARK.m} />
      <Path fill={INK.white} d={MARK.pageLeft} />
      <Path fill={INK.white} d={MARK.pageRight} />
      {MARK.ornaments.map((o) => (
        <Path key={o.d} fill={INK[o.color]} d={o.d} />
      ))}
    </Svg>
  );
}

function Wordmark() {
  return (
    <Svg
      width={WORDMARK_WIDTH}
      height={(WORDMARK_WIDTH * WORDMARK_SIZE.height) / WORDMARK_SIZE.width}
      viewBox={`0 0 ${WORDMARK_SIZE.width} ${WORDMARK_SIZE.height}`}
    >
      <Path fill={WORDMARK_INK.m} d={WORDMARK.m} />
      <Path fill={WORDMARK_INK.o1} d={WORDMARK.o1} />
      <Path fill={WORDMARK_INK.y} d={WORDMARK.y} />
      <Path fill={WORDMARK_INK.o2} d={WORDMARK.o2} />
      <Path fill={WORDMARK_INK.learn} d={WORDMARK.learn} />
      <Path fill={WORDMARK_INK.dashes} d={WORDMARK.dashes} />
    </Svg>
  );
}

export function MoyoSplash() {
  const [gone, setGone] = useState(false);
  // Reduced motion keeps the splash — a cold start still needs to be covered —
  // and drops only the movement: the lockup is simply present, then fades.
  const reduced = useReducedMotion();
  // Read so an orientation change while the splash is up re-centres it; the
  // lockup itself is a fixed size, deliberately (see MARK_WIDTH).
  useWindowDimensions();

  useEffect(() => {
    // Mounted means painted, so the native splash can go: it is holding the
    // same mark on the same ground, and hiding it any earlier is the flash of
    // an unbuilt app this whole file exists to prevent.
    SplashScreen.hideAsync().catch(() => {
      // Already hidden (Fast Refresh, or a second mount). Nothing to do.
    });
    const timer = setTimeout(() => setGone(true), SPLASH_TOTAL);
    return () => clearTimeout(timer);
  }, []);

  if (gone) return null;

  return (
    <Animated.View
      // The overlay is removed by this component's own render, so `exiting`
      // runs: MoyoSplash stays mounted and returns null, which is what a layout
      // animation needs to play an unmount.
      exiting={FadeOut.duration(BEAT.out)}
      accessibilityRole="image"
      accessibilityLabel="Moyo Learn"
      // Absolute fill, last child of the root — it covers every provider's
      // output, and it swallows taps while it is up, which is correct: there is
      // nothing behind it a person means to press yet.
      style={[StyleSheet.absoluteFill, styles.ground]}
    >
      <Animated.View
        style={
          reduced
            ? undefined
            : {
                animationName: RISE,
                animationDuration: BEAT.mark,
                animationTimingFunction: 'ease-out',
                animationFillMode: 'both',
              }
        }
      >
        <Mark />
      </Animated.View>
      <View style={styles.gap} />
      <Animated.View
        style={
          reduced
            ? undefined
            : {
                animationName: FOLLOW,
                animationDuration: BEAT.word,
                animationDelay: BEAT.wordDelay,
                animationTimingFunction: 'ease-out',
                animationFillMode: 'both',
              }
        }
      >
        <Wordmark />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ground: {
    alignItems: 'center',
    backgroundColor: SPLASH_GROUND,
    justifyContent: 'center',
  },
  gap: { height: GAP },
});
