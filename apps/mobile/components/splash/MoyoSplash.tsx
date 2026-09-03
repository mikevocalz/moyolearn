// The animated splash: the mark arrives, the wordmark rises glyph by glyph,
// LEARN and its rules settle, the tagline lands, and the overlay fades off the
// app that was built behind it.
//
// ── REDRAW HAND-OFF ─────────────────────────────────────────────────────────
// The choreography this follows was authored against Redraw (redraw.dev), and
// that scene is in the tree at ./redraw/moyo-splash-scene.ts — the ink drawing
// itself on, the two book halves converging on the heart, the heartbeat, the
// ornaments popping in rhythm, per-glyph motion blur from the easing's own
// velocity. None of that is reachable from React Native views: it needs
// `path.segment`, a custom GPU stroke width, and vector feathering.
//
// Redraw is a technical preview distributed as .tgz tarballs to wcandillon.dev
// subscribers (redraw.dev/docs/installation) — the npm package of that name is
// an empty placeholder. Everything else it needs is already wired:
// react-native-webgpu 0.9.0 with its API 26 floor (app.config.ts),
// `unplugin-typegpu/babel` (babel.config.js), and vendors/ waiting for the two
// files. Drop them in per vendors/README.md and this whole component becomes:
//
//     import { MoyoSplash } from './redraw/MoyoSplash';
//
// Until then this draws the same lockup, on the same TIMELINE, with the beats
// Reanimated and react-native-svg can honestly do: arrival, stagger, settle.
// It is the composition without the ink.
// ─────────────────────────────────────────────────────────────────────────────
//
// The native splash is the FIRST FRAME of this, not a preview of the end: it is
// the paper and nothing else (app.config.ts), so the cut has nothing in it to
// see. Hiding it any earlier is the flash of an unbuilt app.
//
// Geometry: ./moyo-paths.ts. Colour and beats: ./moyo-splash-scene.ts.
// SOT: apps/mobile/app/_layout.tsx (mount + preventAutoHide) · ./redraw/
// SOT-KEYWORDS: splash animated boot logomark wordmark cold start redraw

import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, { FadeOut, useReducedMotion } from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';

import { HeartField, type HeartFieldLevels } from './hearts-gpu';
import { MARK, MARK_HEART, MARK_SIZE, WORDMARK, WORDMARK_SIZE } from './moyo-paths';
import {
  BEAT,
  INK,
  SPLASH_GROUND,
  SPLASH_TOTAL,
  TAGLINE,
  WORDMARK_INK,
} from './moyo-splash-scene';

// Layout follows the authored scene's `computeLayout`: the mark leads at 30% of
// the short edge, the wordmark is the caption under half its area, and the
// group sits slightly above true centre because optical centre is not centre.
const MARK_SHORT_EDGE_RATIO = 0.3;
/** MOYO's four glyphs, in reading order — each gets its own layer and delay. */
const WORDMARK_GLYPHS = ['m', 'o1', 'y', 'o2'] as const;
const WORDMARK_WIDTH_RATIO = 0.46;
const WORDMARK_MAX = 300;

// Keyframes rather than worklets: nothing here is gesture-driven or
// interruptible, so the whole animation is a declaration the UI thread runs on
// its own (Reanimated 4 CSS animations). No shared values, no JS↔UI crossings,
// no per-frame React renders.
/*
  THE BOOK OPENS — as a horizontal unfold about the spine.

  The first version swung each half in 3D (`rotateY` behind a `perspective`),
  which is the truer gesture and did not animate at all: the layers stayed at
  their `from` opacity of 0, so the mark's whole top half was missing on device
  while the wordmark beneath it animated correctly. Reanimated's CSS keyframes
  did not take that transform pair here, and a mark that does not draw is worse
  than a mark that unfolds flat.

  `scaleX` on a layer whose box is the whole mark scales about the box's centre
  — which IS the spine — so each half opens outward from it. Both halves use
  the same keyframes and differ only in when they start.
*/
const PAGE_LEFT_OPEN = {
  from: { opacity: 0, transform: [{ scaleX: 0.05 }] },
  '72%': { opacity: 1, transform: [{ scaleX: 1.04 }] },
  to: { opacity: 1, transform: [{ scaleX: 1 }] },
};

const PAGE_RIGHT_OPEN = {
  from: { opacity: 0, transform: [{ scaleX: 0.05 }] },
  '72%': { opacity: 1, transform: [{ scaleX: 1.04 }] },
  to: { opacity: 1, transform: [{ scaleX: 1 }] },
};

/** The M rises into the open book, from under it, with a little overshoot. */
const M_RISE = {
  from: { opacity: 0, transform: [{ translateY: 46 }, { scale: 0.94 }] },
  '75%': { opacity: 1, transform: [{ translateY: -6 }, { scale: 1.01 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
};

/*
  The heartbeat, drawn as a soft coral bloom in the heart's negative space —
  the scene does this with `Feather.glow` on the heart contour under a Screen
  blend. Without vector feathering it is a blurred-edge shape whose scale and
  opacity carry the beat: sharp rise, slow fall, twice, the second softer.
*/
const HEARTBEAT = {
  from: { opacity: 0, transform: [{ scale: 0.7 }] },
  '18%': { opacity: 0.85, transform: [{ scale: 1.15 }] },
  '38%': { opacity: 0.28, transform: [{ scale: 0.95 }] },
  '58%': { opacity: 0.6, transform: [{ scale: 1.08 }] },
  to: { opacity: 0, transform: [{ scale: 0.9 }] },
};

/*
  The LIFT: hero size, centred, down into the lockup. The scene moves the mark
  from 1.28x at 46% of the height to 1x at its settled rect; here the container
  carries the same movement, so everything inside it — pages, M, ornaments —
  travels as one object rather than each re-animating.
*/
const LIFT = {
  from: { transform: [{ scale: 1.24 }, { translateY: 34 }] },
  to: { transform: [{ scale: 1 }, { translateY: 0 }] },
};

/** MOYO's glyphs rise, each with a touch of rotation so it is not a slide. */
const GLYPH_RISE = {
  from: { opacity: 0, transform: [{ translateY: 34 }, { rotate: '-4deg' }, { scale: 0.9 }] },
  '72%': { opacity: 1, transform: [{ translateY: -4 }, { rotate: '1deg' }, { scale: 1.02 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }, { rotate: '0deg' }, { scale: 1 }] },
};

const SETTLE = {
  from: { opacity: 0, transform: [{ translateY: 10 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }] },
};

/** The rules under LEARN, growing outward from the word. */
const DASHES = {
  from: { opacity: 0, transform: [{ scaleX: 0.08 }] },
  to: { opacity: 1, transform: [{ scaleX: 1 }] },
};

/*
  The ornament POP — the scene's `easeOutBack` overshoot, written as keyframes.
  A back curve is not expressible as a timing function here, so the overshoot
  is a keyframe: past the target at 70%, settled at 100%. This is the beat that
  gives the mark its rhythm; without it the legs simply appear.
*/
const POP = {
  from: { opacity: 0, transform: [{ scale: 0.35 }] },
  '70%': { opacity: 1, transform: [{ scale: 1.14 }] },
  to: { opacity: 1, transform: [{ scale: 1 }] },
};

/** One layer of the mark, on the traced viewBox so every contour keeps its place. */
function MarkLayer({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: React.ReactNode;
}) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${MARK_SIZE.width} ${MARK_SIZE.height}`}>
      {children}
    </Svg>
  );
}

/*
  The ornaments, bucketed top-to-bottom so they can pop in rhythm.

  The scene staggers all 32 individually across its window. Thirty-two absolutely
  positioned Svg layers is not a trade worth making in views, so they are sorted
  by the y of their contour start — the same top-to-bottom order the scene uses
  — and dealt into a handful of buckets that fire in sequence. The eye reads the
  cascade, not the individual delays.

  The y is parsed from the path's opening `M x y`, which every traced contour
  has by construction (moyo-paths.ts is generated with an explicit moveto).
*/
const ORNAMENT_BUCKETS = 6;

const ornamentRows = (() => {
  const withY = MARK.ornaments.map((o) => {
    const m = /^M\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/.exec(o.d);
    return { ...o, y: m ? Number(m[2]) : 0 };
  });
  withY.sort((a, b) => a.y - b.y);
  const rows: (typeof withY)[] = Array.from({ length: ORNAMENT_BUCKETS }, () => []);
  withY.forEach((o, i) => {
    rows[Math.floor((i / withY.length) * ORNAMENT_BUCKETS)]?.push(o);
  });
  return rows;
})();

/**
 * MOYO and LEARN are drawn as two Svgs on one viewBox rather than one.
 *
 * They arrive on different beats (the scene's `moyo` and `learn` windows), and
 * an animation driving a subset of paths inside a single Svg would have to
 * animate the paths themselves. Two overlaid Svgs sharing `WORDMARK_SIZE` keep
 * every glyph in its authored position while letting each layer be moved by an
 * ordinary view transform.
 */
function WordmarkLayer({
  width,
  children,
}: {
  width: number;
  children: React.ReactNode;
}) {
  return (
    <Svg
      width={width}
      height={(width * WORDMARK_SIZE.height) / WORDMARK_SIZE.width}
      viewBox={`0 0 ${WORDMARK_SIZE.width} ${WORDMARK_SIZE.height}`}
    >
      {children}
    </Svg>
  );
}

export function MoyoSplash() {
  const [gone, setGone] = useState(false);
  /*
    The heart field's own level, on the splash's clock rather than a clock of
    its own. A ref, not state: it is read inside a GPU frame loop, and a state
    write per frame would re-render this component 60 times a second to move a
    number the renderer already has a pointer to.
  */
  const gpuLevels = useRef<HeartFieldLevels>({ hearts: 0, sparks: 0 });
  // Reduced motion keeps the splash — a cold start still needs to be covered —
  // and drops only the movement: the lockup is simply present, then fades. The
  // authored scene does the same by rendering its settled frame.
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();

  const short = Math.min(width, height);
  const markHeight = short * MARK_SHORT_EDGE_RATIO;
  const markWidth = (markHeight * MARK_SIZE.width) / MARK_SIZE.height;
  const wordWidth = Math.min(width * WORDMARK_WIDTH_RATIO, WORDMARK_MAX);
  const wordHeight = (wordWidth * WORDMARK_SIZE.height) / WORDMARK_SIZE.width;

  /*
    Reduced motion decides how things MOVE, not how long the splash lives. Read
    through a ref inside the effect below, because the hook resolves the OS
    setting after mount: as a dependency it re-ran the effect, which cleared the
    hand-off timer and set a new one — and a splash whose timer keeps being
    replaced never ends. Measured on device: it sat there indefinitely.
  */
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  useEffect(() => {
    // Mounted means painted, so the native splash can go: it is holding the
    // same paper, and hiding it any earlier is the flash of an unbuilt app.
    SplashScreen.hideAsync().catch(() => {
      // Already hidden (Fast Refresh, or a second mount). Nothing to do.
    });
    const timer = setTimeout(() => setGone(true), SPLASH_TOTAL);

    /*
      THE HEARTS SWELL AND THEN GIVE WAY. They come up with the book, hold
      under the lockup, and are gone before the hand-off — a field still
      rising as the app appears reads as the app inheriting someone else's
      animation. Reduced motion gets a still field at a low level rather than
      no field: it is texture, not movement, at that setting.

      Stepped on an interval rather than per frame, because the value only has
      to be right to the eye and the GPU loop reads whatever is current.
    */
    if (reducedRef.current) {
      gpuLevels.current = { hearts: 0.35, sparks: 0 };
      return () => clearTimeout(timer);
    }
    const started = Date.now();
    const level = setInterval(() => {
      const t = Date.now() - started;
      const rise = Math.min(1, t / BEAT.heartFieldIn);
      const fall = Math.max(0, 1 - Math.max(0, t - BEAT.heartFieldOut) / BEAT.heartFieldFade);
      /*
        The sparks belong to the ORNAMENT CASCADE, not to the whole splash:
        they climb while it runs, hold through the last bucket, and are out
        before the lift takes the mark to its lockup position. Same clock as
        the cascade above, so the burst and the pops cannot drift.
      */
      const cascade = BEAT.ornamentDelay;
      const cascadeEnd =
        BEAT.ornamentDelay + BEAT.ornament + BEAT.ornamentStagger * ORNAMENT_BUCKETS;
      const sparks =
        t < cascade
          ? 0
          : t < cascadeEnd
            ? Math.min(1, (t - cascade) / 260)
            : Math.max(0, 1 - (t - cascadeEnd) / 420);
      gpuLevels.current = { hearts: rise * fall, sparks };
    }, 50);

    return () => {
      clearTimeout(timer);
      clearInterval(level);
    };
    // Mount-scoped on purpose: see `reducedRef` above.
  }, []);

  if (gone) return null;

  const anim = (name: object, duration: number, delay = 0) =>
    reduced
      ? undefined
      : {
          animationName: name,
          animationDuration: duration,
          animationDelay: delay,
          animationTimingFunction: 'ease-out' as const,
          animationFillMode: 'both' as const,
        };

  return (
    <Animated.View
      exiting={FadeOut.duration(BEAT.out)}
      accessibilityRole="image"
      accessibilityLabel={`Moyo Learn. ${TAGLINE}`}
      /*
        SIZED IN PIXELS, not just `absoluteFill` — and that is the difference
        between this drawing and not drawing at all.

        It is mounted as the last child of the root's provider stack, and those
        providers pass children through without a flex container of their own.
        An absolutely-positioned child resolves `top/left/right/bottom: 0`
        against its PARENT's box, and that box was 0x0: the overlay was
        mounted, laid out, and had no area to paint, so the native splash faded
        away to reveal the app rather than this. Stating the window's size makes
        the layer independent of whatever the parent's box turns out to be.

        It swallows taps while it is up, which is correct: there is nothing
        behind it a person means to press yet.
      */
      style={[StyleSheet.absoluteFill, { width, height }, styles.ground]}
    >
      {/*
        THE HEARTS, UNDER EVERYTHING. A GPU field rising from the bottom edge
        and spreading across the paper in the mark's own colours — coral, amber,
        teal — while the lockup assembles over it. It renders nothing at all if
        WebGPU is unavailable, so the splash never depends on it.
      */}
      <HeartField levelsRef={gpuLevels} />
      {/*
        THE MARK ASSEMBLES, IN FIVE LAYERS ON ONE VIEWBOX.

        Order of arrival is the order of the story the mark tells: the book
        OPENS (coral half, then amber, each swinging about the spine), the plum
        M RISES into it, the heart BEATS in the space they leave, the leg
        ornaments CASCADE down, and then the whole assembly LIFTS from hero size
        into its place in the lockup.

        Layers share `MARK_SIZE`, so every contour keeps its traced position
        while each layer is moved by an ordinary view transform — no path is
        re-authored to animate, and nothing here is a second copy of the
        geometry. Paint order is bottom-up in JSX: the M sits behind the pages
        exactly as the traced source stacks them.
      */}
      <Animated.View
        style={[{ width: markWidth, height: markHeight }, anim(LIFT, BEAT.lift, BEAT.liftDelay)]}
      >
        {/* The M — behind the pages, arriving after them. */}
        <Animated.View style={[StyleSheet.absoluteFill, anim(M_RISE, BEAT.mark, BEAT.markDelay)]}>
          <MarkLayer width={markWidth} height={markHeight}>
            <Path fill={INK.plum} d={MARK.m} />
          </MarkLayer>
        </Animated.View>

        {/* The heartbeat, in the negative space between the halves. It is under
            the pages so the bloom reads as light held inside the book. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.heart,
            {
              left: (MARK_HEART.cx - MARK_HEART.halfWidth) * (markWidth / MARK_SIZE.width),
              top: MARK_HEART.top * (markHeight / MARK_SIZE.height),
              width: MARK_HEART.halfWidth * 2 * (markWidth / MARK_SIZE.width),
              height:
                (MARK_HEART.bottom - MARK_HEART.top) * (markHeight / MARK_SIZE.height),
              borderRadius: MARK_HEART.halfWidth * (markWidth / MARK_SIZE.width),
            },
            anim(HEARTBEAT, BEAT.heart, BEAT.heartDelay),
          ]}
        />

        {/* The two halves of the book, opening. Coral leads by one stagger step
            — simultaneous halves read as a single shape scaling up. */}
        <Animated.View style={[StyleSheet.absoluteFill, anim(PAGE_LEFT_OPEN, BEAT.page)]}>
          <MarkLayer width={markWidth} height={markHeight}>
            <Path fill={INK.coral} d={MARK.pageLeft} />
          </MarkLayer>
        </Animated.View>
        <Animated.View
          style={[StyleSheet.absoluteFill, anim(PAGE_RIGHT_OPEN, BEAT.page, BEAT.pageStagger)]}
        >
          <MarkLayer width={markWidth} height={markHeight}>
            <Path fill={INK.amber} d={MARK.pageRight} />
          </MarkLayer>
        </Animated.View>

        {/* The ornaments, cascading top to bottom. */}
        {ornamentRows.map((row, i) => (
          <Animated.View
            key={row[0]?.d ?? i}
            style={[
              StyleSheet.absoluteFill,
              anim(POP, BEAT.ornament, BEAT.ornamentDelay + i * BEAT.ornamentStagger),
            ]}
          >
            <MarkLayer width={markWidth} height={markHeight}>
              {row.map((o) => (
                <Path key={o.d} fill={INK[o.color]} d={o.d} />
              ))}
            </MarkLayer>
          </Animated.View>
        ))}
      </Animated.View>

      <View style={{ height: short * 0.075 }} />

      {/*
        THE WORDMARK IS ONE BOX, AND EVERY LAYER IS ABSOLUTE INSIDE IT.

        MOYO, LEARN and the two rules all live in one traced viewBox
        (`WORDMARK_SIZE`), which is what holds LEARN under the O's with its
        dashes either side of it. They only arrive on different beats, so each
        is its own layer — and the layers must be absolute WITHIN THIS BOX. The
        first attempt absolute-filled the screen instead, which re-centred LEARN
        on the window and put it through the middle of MOYO.

        MOYO itself is glyph by glyph: M, O, Y, O each with its own delay, which
        is the scene's stagger. One fade of all four is the version that read as
        boring — four letters arriving together is a crossfade, not an entrance.
        What is missing without Redraw is the per-glyph motion blur taken from
        the easing's velocity; the stagger and the travel are here.
      */}
      <View style={{ width: wordWidth, height: wordHeight }}>
        {WORDMARK_GLYPHS.map((glyph, i) => (
          <Animated.View
            key={glyph}
            style={[
              StyleSheet.absoluteFill,
              anim(GLYPH_RISE, BEAT.word, BEAT.wordDelay + i * BEAT.wordStagger),
            ]}
          >
            <WordmarkLayer width={wordWidth}>
              <Path fill={WORDMARK_INK[glyph]} d={WORDMARK[glyph]} />
            </WordmarkLayer>
          </Animated.View>
        ))}

        <Animated.View
          style={[StyleSheet.absoluteFill, anim(SETTLE, BEAT.learn, BEAT.learnDelay)]}
        >
          <WordmarkLayer width={wordWidth}>
            <Path fill={WORDMARK_INK.learn} d={WORDMARK.learn} />
          </WordmarkLayer>
        </Animated.View>

        {/*
          The rules follow the word rather than arriving with it. The scene
          grows each one outward from the edge nearest LEARN; a horizontal
          scale on the layer is the honest approximation — both grow from the
          lockup's centre line instead of from their inner ends.
        */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            anim(DASHES, BEAT.learn, BEAT.learnDelay + BEAT.dashDelay),
          ]}
        >
          <WordmarkLayer width={wordWidth}>
            <Path fill={WORDMARK_INK.dashes} d={WORDMARK.dashes} />
          </WordmarkLayer>
        </Animated.View>
      </View>

      {/*
        REAL TEXT, not a path. It is a sentence a screen reader should get, and
        the authored scene draws it as an RN `<Text>` for the same reason —
        Redraw has no text API. Italic serif is the editorial register in the
        design direction; Fraunces would be the face if it were loaded.
      */}
      <Animated.Text
        style={[
          styles.tagline,
          {
            marginTop: short * 0.05,
            fontSize: Math.round(Math.max(17, Math.min(22, short * 0.052))),
          },
          anim(SETTLE, BEAT.tagline, BEAT.taglineDelay),
        ]}
      >
        {TAGLINE}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ground: {
    alignItems: 'center',
    backgroundColor: SPLASH_GROUND,
    /*
      ELEVATION, NOT JUST TREE ORDER — this is why it did not cover the app.

      On Android the view hierarchy is composited by ELEVATION FIRST and draw
      order second, and react-navigation's screen containers carry an elevation
      of their own. So a later sibling at elevation 0 — which is what this
      overlay was, mounted last in the provider stack — paints UNDERNEATH the
      navigator, and the native splash faded away to reveal the app with the
      splash sitting behind it, laid out and painting into nothing visible.
      `zIndex` alone does not fix it: on Android zIndex only orders siblings
      that share an elevation.

      A number this large is deliberate: the splash outranks everything for the
      few seconds it exists, including any sheet or toast that a boot-time
      restore raises behind it.
    */
    elevation: 1000,
    justifyContent: 'center',
    zIndex: 1000,
  },
  /*
    The heartbeat bloom. A rounded coral block behind the pages rather than the
    heart's own contour: the traced heart is negative space (there is no heart
    path — it is the hole the two pages leave), so what pulses is light in that
    hole, clipped by the pages drawn over it. `MARK_HEART` is the rect the
    geometry file publishes for exactly this.
  */
  heart: {
    backgroundColor: INK.coral,
    position: 'absolute',
  },
  tagline: {
    color: INK.plum,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontStyle: 'italic',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
