/**
 * Moyo splash — Redraw scene.
 *
 * One immediate-mode `render` re-records the whole picture every frame from
 * `time`. There is no retained scene graph: every value below is a pure
 * function of the clock, so scrubbing, replaying, and reduced-motion
 * (jump to `TIMELINE.settled`) all fall out for free.
 *
 * Choreography ("drawn together"):
 *   1. Ink      — the plum M is stroked in with a swelling pen head; the
 *                 two book halves draw from the outer edges toward the
 *                 spine and meet over the heart.
 *   2. Flood    — fills bloom in behind the ink (glow sigma collapses to 0),
 *                 the heart negative-space pulses once (lub-dub).
 *   3. Rhythm   — the leg ornaments pop top-to-bottom with a small overshoot.
 *   4. Lift     — the mark eases up and settles at its lockup scale.
 *   5. Rise     — MOYO glyphs rise one by one with analytical motion blur
 *                 (Feather.sweep driven by the easing's velocity), then
 *                 LEARN fades and the dashes extend outward.
 *   6. Tagline  — rendered by React Native <Text> (see MoyoSplash.tsx);
 *                 Redraw has no text API. Same clock, same easing.
 *
 * Coordinates are logical (dp) pixels; the React Native canvas is pre-scaled
 * by PixelRatio.
 *
 * Docs: https://redraw.dev/docs/drawings · https://redraw.dev/docs/paths
 *       https://redraw.dev/docs/paints   · https://redraw.dev/docs/vector-feathering
 *       https://redraw.dev/docs/custom-effects/stroke
 */

import type { Canvas, Path } from "redraw";
import {
  BlendMode,
  Feather,
  Grain,
  Paint,
  PathBuilder,
  createStrokeWidth,
  parseSVG,
  vec,
} from "redraw";
import { std } from "typegpu";
import type { FrameInfo } from "react-native-redraw";

import {
  BRAND,
  MARK,
  MARK_HEART,
  MARK_SIZE,
  WORDMARK,
  WORDMARK_SIZE,
} from "./moyo-paths";

// ---------------------------------------------------------------------------
// Timeline (ms). Single source of truth; MoyoSplash.tsx reads it for the
// tagline and for the hand-off to the app.
// ---------------------------------------------------------------------------

export const TIMELINE = {
  inkM: [80, 1040],
  inkPages: [380, 1180],
  meet: 1180, // the two halves touch over the heart
  flood: [1080, 1520],
  heartbeat: [1180, 1720],
  ornaments: [1420, 1900], // stagger window for the leg ornaments
  lift: [1780, 2360],
  moyo: [2000, 2620], // first glyph starts, last glyph settles
  learn: [2440, 2900],
  tagline: [2700, 3180],
  settled: 3400,
  /** When the host should unmount the splash / navigate. */
  done: 3900,
} as const;

// ---------------------------------------------------------------------------
// Easing. Pure functions of u ∈ [0, 1].
// ---------------------------------------------------------------------------

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Normalised progress of `t` through [a, b]. */
const span = (t: number, [a, b]: readonly [number, number]) =>
  clamp01((t - a) / (b - a));

const easeOutCubic = (u: number) => 1 - Math.pow(1 - u, 3);
const easeOutQuint = (u: number) => 1 - Math.pow(1 - u, 5);
const easeInOutQuint = (u: number) =>
  u < 0.5 ? 16 * u * u * u * u * u : 1 - Math.pow(-2 * u + 2, 5) / 2;
/** Overshoot; s = 1.70158 is the classic back curve. */
const easeOutBack = (u: number, s = 1.45) => {
  const c = s + 1;
  return 1 + c * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2);
};
/** Numeric derivative — used to drive motion-blur sigma from velocity. */
const velocity = (fn: (u: number) => number, u: number, h = 0.004) =>
  (fn(clamp01(u + h)) - fn(clamp01(u - h))) / (2 * h);

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

// ---------------------------------------------------------------------------
// Colours. `rgba()` strings keep alpha unambiguous across Paint.setColor.
// ---------------------------------------------------------------------------

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgba = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${clamp01(a).toFixed(3)})`;
};

// ---------------------------------------------------------------------------
// Custom GPU stroke: a pen whose head swells toward the tip of the segment
// currently being drawn. `ctx.t` is the arc-length position along the drawn
// sub-path, so the head always sits at the ink front.
// Requires the unplugin-typegpu Babel plugin (see README).
// ---------------------------------------------------------------------------

const InkHead = createStrokeWidth(
  (ctx, _tctx, props) => {
    "use gpu";
    const head = std.smoothstep(props.headStart, 1.0, ctx.t);
    return std.mix(props.width, props.width * props.headScale, head);
  },
  { width: 0, headStart: 0.86, headScale: 2.6 },
  { maxStrokeWidth: 24 },
);

export const library = {
  functions: [InkHead, Grain.fn],
  // Every path draw records one command per tile; the ornaments and the
  // page slivers overlap the M, so give the binner headroom.
  maxPerTile: 96,
};

// ---------------------------------------------------------------------------
// Geometry: parsed once at module scope, fitted once per canvas size.
// ---------------------------------------------------------------------------

const longestContour = (p: Path) =>
  p.splitContours().reduce((best, c) => {
    const bb = c.bounds();
    const bl = best.bounds();
    const size = bb.width * bb.height;
    const bestSize = bl.width * bl.height;
    return size > bestSize ? c : best;
  });

const src = {
  m: parseSVG(MARK.m),
  pageLeft: parseSVG(MARK.pageLeft),
  pageRight: parseSVG(MARK.pageRight),
  ornaments: MARK.ornaments.map((o) => ({
    color: BRAND[o.color],
    path: parseSVG(o.d),
  })),
  word: {
    m: parseSVG(WORDMARK.m),
    o1: parseSVG(WORDMARK.o1),
    y: parseSVG(WORDMARK.y),
    o2: parseSVG(WORDMARK.o2),
    learn: parseSVG(WORDMARK.learn),
    dashes: parseSVG(WORDMARK.dashes),
  },
};

// The ornaments pop top-to-bottom; sort once by their source-space y.
const ornamentOrder = [...src.ornaments].sort(
  (a, b) => a.path.bounds().y - b.path.bounds().y,
);
const ornamentCount = ornamentOrder.length;

/** Build the negative-space heart in mark space. */
const buildHeart = () => {
  const { cx, top, bottom, halfWidth } = MARK_HEART;
  const h = bottom - top;
  const b = new PathBuilder();
  // Two lobes meeting at a notch ~25% down, tip at the bottom.
  b.moveTo(vec(cx, top + h * 0.28));
  b.cubicTo(
    vec(cx + halfWidth * 0.45, top - h * 0.1),
    vec(cx + halfWidth * 1.05, top + h * 0.25),
    vec(cx, bottom),
  );
  b.cubicTo(
    vec(cx - halfWidth * 1.05, top + h * 0.25),
    vec(cx - halfWidth * 0.45, top - h * 0.1),
    vec(cx, top + h * 0.28),
  );
  b.close();
  return b.makePath();
};
const heartSrc = buildHeart();

// ---------------------------------------------------------------------------
// Layout. Exported so the RN tagline lands exactly under the wordmark.
// ---------------------------------------------------------------------------

export interface SplashLayout {
  width: number;
  height: number;
  /** Final (settled) mark rect. */
  mark: { x: number; y: number; width: number; height: number };
  /** Hero mark scale during the ink phase, relative to the settled size. */
  heroScale: number;
  heroCenterY: number;
  word: { x: number; y: number; width: number; height: number };
  /** Top of the tagline baseline block, in dp. */
  taglineTop: number;
  taglineFontSize: number;
}

export function computeLayout(width: number, height: number): SplashLayout {
  const short = Math.min(width, height);
  // The mark leads; the wordmark is the caption. Two stacked Ms at equal
  // weight read as clutter, so keep the wordmark under half the mark's area.
  const markH = short * 0.3;
  const markW = markH * (MARK_SIZE.width / MARK_SIZE.height);
  const wordW = Math.min(width * 0.46, 300);
  const wordH = wordW * (WORDMARK_SIZE.height / WORDMARK_SIZE.width);
  const gap = short * 0.075;
  const taglineFontSize = Math.round(Math.max(17, Math.min(22, short * 0.052)));
  const taglineGap = short * 0.05;

  const groupH = markH + gap + wordH + taglineGap + taglineFontSize * 1.3;
  // Optical centre: sit the group slightly above true centre.
  const top = (height - groupH) / 2 - height * 0.035;

  return {
    width,
    height,
    mark: { x: (width - markW) / 2, y: top, width: markW, height: markH },
    heroScale: 1.28,
    heroCenterY: height * 0.46,
    word: { x: (width - wordW) / 2, y: top + markH + gap, width: wordW, height: wordH },
    taglineTop: top + markH + gap + wordH + taglineGap,
    taglineFontSize,
  };
}

interface Fitted {
  key: string;
  layout: SplashLayout;
  m: Path;
  mOutline: Path;
  pageLeft: Path;
  pageLeftOutline: Path;
  pageRight: Path;
  pageRightOutline: Path;
  ornaments: { color: string; path: Path; cx: number; cy: number }[];
  heart: Path;
  word: { path: Path; color: string; cx: number; cy: number }[];
  learn: Path;
  dashLeft: Path;
  dashRight: Path;
  dashCenterX: number;
}

let cache: Fitted | null = null;

function fitFor(width: number, height: number): Fitted {
  const key = `${width}x${height}`;
  if (cache && cache.key === key) return cache;

  const layout = computeLayout(width, height);
  // Fit everything at its settled size at origin (0,0); position with the
  // canvas transform so the hero → settled move is a pure transform.
  const markDst = { x: 0, y: 0, width: layout.mark.width, height: layout.mark.height };
  const markSrc = { x: 0, y: 0, ...MARK_SIZE };
  const fitMark = (p: Path) => p.fit("contain", markSrc, markDst);

  const wordDst = { x: 0, y: 0, width: layout.word.width, height: layout.word.height };
  const wordSrc = { x: 0, y: 0, ...WORDMARK_SIZE };
  const fitWord = (p: Path) => p.fit("contain", wordSrc, wordDst);

  const m = fitMark(src.m);
  const pageLeft = fitMark(src.pageLeft);
  const pageRight = fitMark(src.pageRight);

  const center = (p: Path) => {
    const b = p.bounds();
    return { cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
  };

  const dashes = fitWord(src.word.dashes).splitContours();
  const [dashLeft, dashRight] = dashes.sort((a, b) => a.bounds().x - b.bounds().x);

  cache = {
    key,
    layout,
    m,
    mOutline: longestContour(m),
    pageLeft,
    pageLeftOutline: longestContour(pageLeft),
    pageRight,
    pageRightOutline: longestContour(pageRight),
    ornaments: ornamentOrder.map((o) => {
      const path = fitMark(o.path);
      return { color: o.color, path, ...center(path) };
    }),
    heart: fitMark(heartSrc),
    word: [
      { path: fitWord(src.word.m), color: BRAND.plum },
      { path: fitWord(src.word.o1), color: BRAND.coral },
      { path: fitWord(src.word.y), color: BRAND.amber },
      { path: fitWord(src.word.o2), color: BRAND.teal },
    ].map((g) => ({ ...g, ...center(g.path) })),
    learn: fitWord(src.word.learn),
    dashLeft,
    dashRight,
    dashCenterX: layout.word.width / 2,
  };
  return cache;
}

// ---------------------------------------------------------------------------
// Static paints.
// ---------------------------------------------------------------------------

/** Warm paper with a whisper of grain — the "tactile" in Tactile Learning Modernism. */
const paper = new Paint().setColor(BRAND.paper).addShader(new Grain(0.035, 7));

// ---------------------------------------------------------------------------
// Render.
// ---------------------------------------------------------------------------

export function render(canvas: Canvas, { width, height, time }: FrameInfo) {
  const t = time;
  const F = fitFor(width, height);
  const L = F.layout;

  canvas.fill(paper);

  // ---- Mark transform: hero (centred, larger) → settled lockup position ----
  const lift = easeInOutQuint(span(t, TIMELINE.lift));
  const scale = lerp(L.heroScale, 1, lift);
  const settledCx = L.mark.x + L.mark.width / 2;
  const settledCy = L.mark.y + L.mark.height / 2;
  const cx = settledCx;
  const cy = lerp(L.heroCenterY, settledCy, lift);

  canvas.save();
  canvas.translate(cx, cy);
  canvas.scale(scale);
  canvas.translate(-L.mark.width / 2, -L.mark.height / 2);

  // ---- 1. Ink ---------------------------------------------------------------
  const flood = easeOutCubic(span(t, TIMELINE.flood));
  const inkAlpha = 1 - flood; // ink fades as fills take over
  const pen = 3.2 / scale; // constant on-screen width

  const inkM = easeOutCubic(span(t, TIMELINE.inkM));
  if (inkM > 0.002 && inkAlpha > 0.01) {
    const paint = new Paint()
      .setColor(rgba(BRAND.plum, inkAlpha))
      .setStroke(InkHead, { width: pen, headStart: 0.86, headScale: 2.6 });
    canvas.drawPath(F.mOutline.segment(0, inkM), paint, { grouping: "strand" });
  }

  // Pages: each outline starts at its OUTER edge (contour start rotated in
  // moyo-paths.ts). Ink leaves that point in both directions, so the two
  // fronts of each page converge on the antipode — the spine over the heart —
  // and the coral and amber halves arrive there together.
  const inkPages = easeOutQuint(span(t, TIMELINE.inkPages));
  if (inkPages > 0.002 && inkAlpha > 0.01) {
    const half = inkPages / 2;
    const stroke = { width: pen, headStart: 0.8, headScale: 2.4 };
    const left = new Paint().setColor(rgba(BRAND.coral, inkAlpha)).setStroke(InkHead, stroke);
    const right = new Paint().setColor(rgba(BRAND.amber, inkAlpha)).setStroke(InkHead, stroke);
    // Forward front (head swells at its tip) …
    canvas.drawPath(F.pageLeftOutline.segment(0, half), left);
    canvas.drawPath(F.pageRightOutline.segment(0, half), right);
    // … and the backward front. Its tip is at t=0 of the sub-path, so use a
    // flat head there; the forward front carries the visible pen swell.
    const flat = { width: pen, headStart: 1.0, headScale: 1.0 };
    canvas.drawPath(F.pageLeftOutline.segment(1 - half, 1), new Paint().setColor(rgba(BRAND.coral, inkAlpha)).setStroke(InkHead, flat));
    canvas.drawPath(F.pageRightOutline.segment(1 - half, 1), new Paint().setColor(rgba(BRAND.amber, inkAlpha)).setStroke(InkHead, flat));
  }

  // ---- 2. Flood: fills bloom in behind the ink -------------------------------
  if (flood > 0.001) {
    const sigma = (1 - flood) * 18;
    const fillPaint = (hex: string, delay: number) => {
      const a = easeOutCubic(span(t, [TIMELINE.flood[0] + delay, TIMELINE.flood[1] + delay]));
      const p = new Paint().setColor(rgba(hex, a));
      if (sigma > 0.5) p.setFeather(Feather.glow(sigma));
      return p;
    };
    canvas.drawPath(F.m, fillPaint(BRAND.plum, 0));
    canvas.drawPath(F.pageLeft, fillPaint(BRAND.coral, 60));
    canvas.drawPath(F.pageRight, fillPaint(BRAND.amber, 60));
  }

  // ---- Heartbeat: one lub-dub of warm light in the negative space ----------
  const hb = span(t, TIMELINE.heartbeat);
  if (hb > 0 && hb < 1) {
    // Two beats: quick strong, then softer; each a sharp rise and slow fall.
    const beat = (u: number, at: number, w: number) => {
      const x = (u - at) / w;
      return x < 0 || x > 1 ? 0 : Math.sin(Math.PI * Math.pow(x, 0.6));
    };
    const glow = beat(hb, 0.0, 0.42) * 1.0 + beat(hb, 0.4, 0.55) * 0.55;
    if (glow > 0.01) {
      const paint = new Paint()
        .setColor(rgba(BRAND.coral, 0.55 * glow))
        .setFeather(Feather.glow(14 + 26 * glow));
      paint.blendMode = BlendMode.Screen;
      canvas.drawPath(F.heart, paint);
      const core = new Paint()
        .setColor(rgba(BRAND.amber, 0.35 * glow))
        .setFeather(Feather.blur(6 + 10 * glow));
      core.blendMode = BlendMode.Screen;
      canvas.drawPath(F.heart, core);
    }
  }

  // ---- 3. Rhythm: ornaments pop top-to-bottom ------------------------------
  {
    const [o0, o1] = TIMELINE.ornaments;
    const stagger = (o1 - o0) / ornamentCount;
    const dur = 260;
    F.ornaments.forEach((o, i) => {
      const start = o0 + i * stagger;
      const u = span(t, [start, start + dur]);
      if (u <= 0) return;
      const s = easeOutBack(u, 1.9);
      canvas.save();
      canvas.translate(o.cx, o.cy);
      canvas.scale(s);
      canvas.translate(-o.cx, -o.cy);
      canvas.drawPath(o.path, new Paint().setColor(rgba(o.color, Math.min(1, u * 2.5))));
      canvas.restore();
    });
  }

  canvas.restore(); // mark transform

  // ---- 5. Rise: MOYO glyphs -------------------------------------------------
  {
    const [w0, w1] = TIMELINE.moyo;
    const glyphDur = 460;
    const stagger = (w1 - w0 - glyphDur) / (F.word.length - 1);
    const travel = L.word.height * 0.9;

    canvas.save();
    canvas.translate(L.word.x, L.word.y);
    F.word.forEach((g, i) => {
      const start = w0 + i * stagger;
      const u = span(t, [start, start + glyphDur]);
      if (u <= 0) return;
      const e = easeOutBack(u, 0.9);
      const dy = (1 - e) * travel;
      // Motion blur from the easing's velocity: fast at launch, none at rest.
      const v = velocity((x) => easeOutBack(x, 0.9), u) * travel / glyphDur; // dp per ms
      const sigma = Math.min(Math.abs(v) * 28, 22);

      const paint = new Paint().setColor(rgba(g.color, Math.min(1, u * 3)));
      if (sigma > 0.6) paint.setFeather(Feather.sweep(sigma, [0, v > 0 ? 1 : -1]));

      canvas.save();
      canvas.translate(0, dy);
      canvas.drawPath(g.path, paint);
      canvas.restore();
    });

    // ---- LEARN + dashes ----------------------------------------------------
    const learn = easeOutCubic(span(t, TIMELINE.learn));
    if (learn > 0.002) {
      const ly = (1 - learn) * L.word.height * 0.12;
      canvas.save();
      canvas.translate(0, ly);
      canvas.drawPath(F.learn, new Paint().setColor(rgba(BRAND.plum, learn)));
      canvas.restore();

      // Dashes extend outward from the word toward the edges.
      const dash = easeOutQuint(span(t, [TIMELINE.learn[0] + 120, TIMELINE.learn[1] + 60]));
      if (dash > 0.002) {
        const dashPaint = new Paint().setColor(rgba(BRAND.coral, Math.min(1, dash * 2)));
        // Left dash grows leftward: scale about its right edge.
        const lb = F.dashLeft.bounds();
        canvas.save();
        canvas.translate(lb.x + lb.width, lb.y + lb.height / 2);
        canvas.scale(dash, 1);
        canvas.translate(-(lb.x + lb.width), -(lb.y + lb.height / 2));
        canvas.drawPath(F.dashLeft, dashPaint);
        canvas.restore();
        // Right dash grows rightward: scale about its left edge.
        const rb = F.dashRight.bounds();
        canvas.save();
        canvas.translate(rb.x, rb.y + rb.height / 2);
        canvas.scale(dash, 1);
        canvas.translate(-rb.x, -(rb.y + rb.height / 2));
        canvas.drawPath(F.dashRight, dashPaint);
        canvas.restore();
      }
    }
    canvas.restore();
  }
}

/** Tagline progress on the shared clock, for the RN overlay. */
export const taglineProgress = (time: number) => easeOutCubic(span(time, TIMELINE.tagline));
