/**
 * MoyoSplash — animated splash for Moyo Learn, rendered with Redraw
 * (react-native-redraw on react-native-webgpu).
 *
 *   <MoyoSplash onFinished={() => setReady(true)} />
 *
 * Responsibilities:
 *  - Hosts <RedrawProvider> + <RedrawCanvas> running `moyo-splash-scene`.
 *  - Draws the tagline with a React Native <Text> (Redraw has no text API),
 *    on the scene's own TIMELINE so the two never drift.
 *  - Respects Reduce Motion: renders the settled frame, no animation.
 *  - Hides the native splash (expo-splash-screen) on the first GPU frame,
 *    so there is never a white flash between native splash and canvas.
 *  - Fires `onFinished` once at TIMELINE.done.
 *
 * Docs: https://redraw.dev/docs/react-native
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import * as SplashScreen from "expo-splash-screen";
import type { Canvas } from "redraw";
import { RedrawCanvas, RedrawProvider, type FrameInfo } from "react-native-redraw";

import { BRAND } from "./moyo-paths";
import { TIMELINE, computeLayout, library, render } from "./moyo-splash-scene";

export const TAGLINE = "Learn it by heart.";

export interface MoyoSplashProps {
  /** Called once, after the sequence settles (TIMELINE.done). */
  onFinished?: () => void;
  /** Force the static end state (tests, screenshots). Defaults to the OS Reduce Motion setting. */
  reduceMotion?: boolean;
  /** Family loaded via expo-font. Falls back to the platform serif. */
  taglineFontFamily?: string;
}

export function MoyoSplash(props: MoyoSplashProps) {
  return (
    <RedrawProvider
      // No fallback: the native splash is still on screen until onReady.
      errorFallback={() => <StaticFallback />}
    >
      <Splash {...props} />
    </RedrawProvider>
  );
}

function Splash({ onFinished, reduceMotion, taglineFontFamily }: MoyoSplashProps) {
  const { width, height } = useWindowDimensions();
  const layout = useMemo(() => computeLayout(width, height), [width, height]);

  const [osReduceMotion, setOsReduceMotion] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => live && setOsReduceMotion(v));
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setOsReduceMotion);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  const still = reduceMotion ?? osReduceMotion;

  // Tagline: same clock as the canvas. Reanimated runs on the UI thread and
  // the canvas on the GPU loop; both start from onReady, so they agree to
  // within a frame.
  const tagline = useSharedValue(still ? 1 : 0);
  const [t0, t1] = TIMELINE.tagline;
  const startTagline = useCallback(() => {
    if (still) return;
    tagline.value = withDelay(
      t0,
      withTiming(1, { duration: t1 - t0, easing: Easing.out(Easing.cubic) }),
    );
  }, [still, tagline, t0, t1]);

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: tagline.value,
    transform: [{ translateY: (1 - tagline.value) * 10 }],
  }));

  // Hand-off + native splash hide, both keyed off the first GPU frame.
  const finished = useRef(false);
  const onReady = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
    startTagline();
    const wait = still ? 250 : TIMELINE.done;
    const id = setTimeout(() => {
      if (finished.current) return;
      finished.current = true;
      onFinished?.();
    }, wait);
    return () => clearTimeout(id);
  }, [onFinished, startTagline, still]);

  // Reduce Motion: draw the settled frame once.
  const renderFrame = useCallback(
    (canvas: Canvas, info: FrameInfo) =>
      render(canvas, still ? { ...info, time: TIMELINE.settled } : info),
    [still],
  );

  return (
    <View style={[styles.root, { backgroundColor: BRAND.paper }]}>
      <RedrawCanvas
        style={StyleSheet.absoluteFill}
        library={library}
        render={renderFrame}
        loop={!still}
        transparent={false} // the scene fills the frame: opaque swapchain
        onReady={onReady}
      />
      <Animated.Text
        accessibilityRole="text"
        style={[
          styles.tagline,
          {
            top: layout.taglineTop,
            fontSize: layout.taglineFontSize,
            lineHeight: Math.round(layout.taglineFontSize * 1.3),
            fontFamily:
              taglineFontFamily ??
              Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
          },
          taglineStyle,
        ]}
      >
        {TAGLINE}
      </Animated.Text>
    </View>
  );
}

/** WebGPU unavailable (very old device / simulator without Metal): show the
 *  static lockup so the app still opens cleanly. Swap in an <Image> of the
 *  lockup asset here if you prefer; kept dependency-free on purpose. */
function StaticFallback() {
  const { width, height } = useWindowDimensions();
  const layout = computeLayout(width, height);
  return (
    <View style={[styles.root, { backgroundColor: BRAND.paper }]}>
      <Text
        style={[
          styles.tagline,
          { top: layout.taglineTop, fontSize: layout.taglineFontSize },
        ]}
      >
        {TAGLINE}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tagline: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    color: BRAND.plum,
    fontStyle: "italic",
    letterSpacing: 0.2,
  },
});

export default MoyoSplash;
