/**
 * The site's motion vocabulary. Every chapter animates by calling one of these
 * and nothing else — a marketing page that reaches for `gsap.to()` directly is
 * inventing a second design language.
 *
 * Objects on moyolearn.com have physical personalities: a card THUNKS, a
 * workbook OPENS, a sticker PEELS, a pencil DRAWS, a wrong approach is CROSSED
 * OUT, a mastery block SNAPS into the grid, a page TURNS, a draggable carries
 * rotational INERTIA, a button COMPRESSES toward its own shadow, the mark
 * PULSES while Natalie listens, and progress LOCKS pieces into place. Those are
 * the spec's eleven personalities. Two more exist because the reduced-motion
 * matrix has to answer for them and a chapter would otherwise hand-roll them:
 * `parallax` (the only ambient scroll motion) and `splitReveal` (SplitText over
 * a display heading). Thirteen, and no more — there is no generic entrance,
 * because the easing law is that an element with no personality assigned does
 * not animate.
 *
 * ── THE END-STATE LAW ───────────────────────────────────────────────────────
 * Every primitive is built as `{ rest, beats }` and routed through one private
 * `compose()`. `rest` is the documented final state and is NOT optional. Under
 * reduced motion `compose()` applies `rest` with `gsap.set()` and returns an
 * empty timeline — never a no-op, never a skipped tween that leaves an element
 * where its start state put it.
 *
 * The law is enforced by shape, not by discipline:
 *
 *   1. `compose()` is the only function in this file that constructs a
 *      timeline, and it cannot be called without `rest`.
 *   2. Markup authors the END state. A primitive creates its own start state at
 *      build time with `from`. Nothing on the site is authored hidden, so with
 *      JS off, with the bundle failing, or with reduced motion on, the reader
 *      gets the finished page. The classic "animates in, stays invisible" bug
 *      has nowhere to live.
 *   3. `rest` clears the properties the primitive introduced, so applying it
 *      twice, or to an element the primitive never touched, is identical to
 *      applying it once.
 *
 * Reduced motion has exactly two documented behaviours, and `compress` is the
 * only primitive on the second one — see `ReducedMotionBehaviour`.
 *
 * SOT: docs/site/motion-matrix.md · packages/theme/tokens.ts (siteMotion)
 *      node_modules/gsap/types/gsap-core.d.ts · node_modules/gsap/types/scroll-trigger.d.ts
 * SOT-KEYWORDS: site motion primitives gsap vocabulary thunk open peel draw
 *               cross-out snap page-turn compress pulse lock-in parallax
 *               reduced-motion end-state web-vite
 */
import { isReducedMotion } from '@/stores/perf-store';
// Aliased on purpose: gsap's option types live in an ambient `ScrollTrigger`
// NAMESPACE that an import of the class by the same name would shadow, taking
// `ScrollTrigger.Vars` with it.
import { ScrollTrigger as ScrollTriggerClass, SplitText, gsap } from './register';
import { degrees, ease, opacity, overshoot, scale, secs, travel } from './tokens';
import type { SiteMotionDuration, SiteMotionEase } from './tokens';

/*
  Scroll positions are geometry, not design tokens — there is nothing in the
  theme for "80% down the viewport" to point at. They are named here so a
  chapter picks a documented trigger point instead of tuning a string per
  section, which is how twelve sections end up with twelve reveal thresholds.
*/
const ENTER_START = 'top 78%';
const ENTER_END = 'bottom 20%';

/** How a primitive behaves when the reader has asked the OS for less motion. */
export type ReducedMotionBehaviour =
  /**
   * Apply `rest` immediately and run nothing. Every reveal, entrance and
   * scroll-driven primitive. The reader sees the finished composition.
   */
  | 'end-state'
  /**
   * Run the same beats at zero duration. Reserved for primitives whose end
   * state is decided by an interaction rather than by the page — a button's
   * pressed state has to still *look* pressed, or the control loses its
   * affordance for the reader who most needs it.
   */
  | 'instant';

/** One movement inside a personality. */
interface Beat {
  /** The state the primitive creates for itself. Never authored in markup. */
  from?: gsap.TweenVars;
  to: gsap.TweenVars;
  duration: SiteMotionDuration;
  ease: SiteMotionEase;
  /** GSAP position parameter — where this beat sits in the timeline. */
  at?: number | string;
}

/** Scroll wiring, shared by every primitive that can be scroll-driven. */
export interface ScrollSpec {
  /** Defaults to the animated element itself. */
  trigger?: gsap.DOMTarget;
  start?: string;
  end?: string;
  /** Tie progress to scroll position instead of playing on entry. */
  scrub?: boolean | number;
  /** Play once and never again. Stickers peel once; they do not loop. */
  once?: boolean;
  pin?: boolean | gsap.DOMTarget;
}

export interface BaseOptions {
  targets: gsap.TweenTarget;
  /** Seconds before the first beat. Chapters stagger groups with this. */
  delay?: number;
  /** Per-target offset when `targets` resolves to more than one element. */
  stagger?: number;
  /** Build the timeline paused, for a caller that drives it (press, listen). */
  paused?: boolean;
  /** Drive the timeline from scroll. Omit for an imperative timeline. */
  scroll?: ScrollSpec;
  onComplete?: () => void;
}

interface ComposeSpec extends BaseOptions {
  /**
   * The documented end state. Applied with `gsap.set()` under reduced motion.
   * Required — this is the end-state law, expressed as a type.
   */
  rest: gsap.TweenVars;
  beats: readonly Beat[];
  reducedMotion?: ReducedMotionBehaviour;
}

/**
 * The single constructor. Nothing else in this file builds a timeline.
 *
 * Under reduced motion with the default behaviour it does two things and stops:
 * writes `rest`, and hands back an empty paused timeline so a caller that
 * stores it, plays it, reverses it or kills it behaves identically. It does not
 * return `null` — a nullable return is how a caller ends up guarding on the
 * wrong side and leaving the start state on screen.
 */
function compose(spec: ComposeSpec): gsap.core.Timeline {
  const reduced = isReducedMotion();
  const behaviour = spec.reducedMotion ?? 'end-state';

  if (reduced && behaviour === 'end-state') {
    gsap.set(spec.targets, spec.rest);
    return gsap.timeline({ paused: true });
  }

  // 'instant' keeps the beats and removes the time. The scroll wiring goes with
  // the time: a zero-duration scrubbed timeline is a jump, not a transition.
  const instant = reduced;

  const scrollTrigger: ScrollTrigger.Vars | undefined =
    spec.scroll && !instant
      ? {
          trigger: spec.scroll.trigger ?? (spec.targets as gsap.DOMTarget),
          start: spec.scroll.start ?? ENTER_START,
          end: spec.scroll.end ?? ENTER_END,
          scrub: spec.scroll.scrub,
          once: spec.scroll.once,
          pin: spec.scroll.pin,
          // Sizes are measured after fonts land and after Lenis has settled the
          // document height; without this a trigger computed during the first
          // paint keeps stale numbers for the life of the page.
          invalidateOnRefresh: true,
        }
      : undefined;

  const timeline = gsap.timeline({
    paused: spec.paused ?? false,
    delay: instant ? 0 : spec.delay,
    onComplete: spec.onComplete,
    ...(scrollTrigger ? { scrollTrigger } : {}),
  });

  for (const beat of spec.beats) {
    const vars: gsap.TweenVars = {
      ...beat.to,
      duration: instant ? 0 : secs(beat.duration),
      ease: ease(beat.ease),
      ...(spec.stagger === undefined || instant ? {} : { stagger: spec.stagger }),
    };
    if (beat.from) {
      timeline.fromTo(spec.targets, beat.from, vars, beat.at);
    } else {
      timeline.to(spec.targets, vars, beat.at);
    }
  }

  return timeline;
}

/* ── cards: THUNK ─────────────────────────────────────────────────────────── */

/**
 * Fast in, 2.5% overshoot, hard settle. The site's workhorse entrance and the
 * reason nothing here "gracefully fades upward": a card is an object with mass
 * that arrives and stops, not a layer whose opacity changes.
 */
export function thunk(options: BaseOptions): gsap.core.Timeline {
  return compose({
    ...options,
    rest: { clearProps: 'transform' },
    beats: [
      {
        from: { y: travel.thunk, scale: 1 / overshoot.thunk },
        to: { y: 0, scale: overshoot.thunk },
        duration: 'thunk',
        ease: 'thunk',
      },
      { to: { scale: 1 }, duration: 'settle', ease: 'settle' },
    ],
  });
}

/* ── workbooks: OPEN ──────────────────────────────────────────────────────── */

export interface OpenOptions extends BaseOptions {
  /** Where the spine is. A cover hinges on its binding, not on its middle. */
  origin?: 'left' | 'right';
}

/**
 * A cover swinging past vertical on its spine. `transformPerspective` is set on
 * the element rather than inherited from a parent so a chapter can open a
 * workbook anywhere without the ancestor chain having to cooperate.
 */
export function open({ origin = 'left', ...options }: OpenOptions): gsap.core.Timeline {
  const hinge = origin === 'left' ? 'left center' : 'right center';
  const angle = origin === 'left' ? -degrees('open') : degrees('open');
  return compose({
    ...options,
    rest: { clearProps: 'transform,transformOrigin,transformPerspective' },
    beats: [
      {
        from: { rotationY: 0, transformOrigin: hinge, transformPerspective: 1200 },
        to: { rotationY: angle },
        duration: 'open',
        ease: 'turn',
      },
    ],
  });
}

/* ── stickers: PEEL ───────────────────────────────────────────────────────── */

/**
 * A corner lifts, the sticker rises toward the reader, and it lands. Forced to
 * `once` — a sticker that peels every time it crosses the viewport is a loop,
 * and the brief bans looping delight outright.
 */
export function peel(options: BaseOptions): gsap.core.Timeline {
  return compose({
    ...options,
    scroll: options.scroll ? { ...options.scroll, once: true } : undefined,
    rest: { clearProps: 'transform,transformOrigin' },
    beats: [
      {
        from: { rotation: 0, scale: 1, y: 0, transformOrigin: 'left bottom' },
        to: { rotation: -degrees('peel'), scale: scale.peel, y: `-${travel.peel}` },
        duration: 'peel',
        ease: 'peel',
      },
      { to: { rotation: 0, scale: 1, y: 0 }, duration: 'settle', ease: 'settle' },
    ],
  });
}

/* ── pencil underlines: DRAW ──────────────────────────────────────────────── */

/**
 * An SVG stroke drawn by `stroke-dashoffset`, per spec — not DrawSVGPlugin.
 * The length is measured off each path at build time and the dash is written by
 * this primitive, never by a stylesheet: a CSS-authored dash would render the
 * underline invisible to a reader with JS off, which is the exact failure the
 * end-state law exists to prevent. `rest` clears the dash outright rather than
 * only zeroing the offset, so even a path that arrived with one ends up drawn.
 */
export function draw(options: BaseOptions): gsap.core.Timeline {
  const lengthOf = (target: Element): number =>
    target instanceof SVGGeometryElement ? target.getTotalLength() : 0;

  return compose({
    ...options,
    rest: { strokeDasharray: 'none', strokeDashoffset: 0 },
    beats: [
      {
        from: {
          strokeDasharray: (_index: number, target: Element) => lengthOf(target),
          strokeDashoffset: (_index: number, target: Element) => lengthOf(target),
        },
        to: { strokeDashoffset: 0 },
        duration: 'draw',
        ease: 'draw',
      },
    ],
  });
}

/* ── wrong approaches: CROSS OUT ──────────────────────────────────────────── */

/**
 * The strike is drawn left to right and lands off-level, because a hand drew
 * it. The end state is the crossed-out mark VISIBLE: a reduced-motion reader
 * sees the wrong approach already struck through, which is the information —
 * the movement was only ever the delivery.
 */
export function crossOut(options: BaseOptions): gsap.core.Timeline {
  return compose({
    ...options,
    rest: { clearProps: 'transform,transformOrigin' },
    beats: [
      {
        from: { scaleX: 0, rotation: 0, transformOrigin: 'left center' },
        to: { scaleX: 1, rotation: -degrees('strike') },
        duration: 'cross-out',
        ease: 'strike',
      },
    ],
  });
}

/* ── mastery blocks: SNAP ─────────────────────────────────────────────────── */

export interface SnapOptions extends BaseOptions {
  /** Which side of the grid slot the block comes from. */
  from?: 'above' | 'below' | 'left' | 'right';
}

/**
 * A block arrives small and off-axis, then squares up into its slot with a 2%
 * overshoot. This is the progress language: learning is construction, so a
 * completed piece LOCKS into a grid. It is never a burst, and it is never
 * confetti.
 */
export function snap({ from = 'above', ...options }: SnapOptions): gsap.core.Timeline {
  const axis: gsap.TweenVars =
    from === 'above'
      ? { y: `-${travel.snap}` }
      : from === 'below'
        ? { y: travel.snap }
        : from === 'left'
          ? { x: `-${travel.snap}` }
          : { x: travel.snap };

  return compose({
    ...options,
    rest: { clearProps: 'transform' },
    beats: [
      {
        from: { ...axis, scale: scale.snap, rotation: -degrees('snap') },
        to: { x: 0, y: 0, scale: overshoot.snap, rotation: 0 },
        duration: 'snap',
        ease: 'snap',
      },
      { to: { scale: 1 }, duration: 'settle', ease: 'settle' },
    ],
  });
}

/* ── registers: PAGE TURN ─────────────────────────────────────────────────── */

export interface PageTurnOptions extends BaseOptions {
  /** The page being turned away. Defaults to no outgoing page. */
  outgoing?: gsap.TweenTarget;
}

/**
 * The transition between registers ("for parents" ↔ "for schools"). Two sheets
 * hinged on the same spine: the outgoing page rotates away while the incoming
 * one rotates in behind it. Under reduced motion the incoming register is
 * simply present and the outgoing one is simply gone — a register switch is
 * navigation, and navigation must not depend on an animation completing.
 */
export function pageTurn({ outgoing, ...options }: PageTurnOptions): gsap.core.Timeline {
  const timeline = compose({
    ...options,
    rest: { clearProps: 'transform,transformOrigin,transformPerspective' },
    beats: [
      {
        from: {
          rotationY: -degrees('page-turn'),
          x: travel['page-turn'],
          transformOrigin: 'left center',
          transformPerspective: 1600,
        },
        to: { rotationY: 0, x: 0 },
        duration: 'page-turn',
        ease: 'turn',
      },
    ],
  });

  if (outgoing) {
    // The outgoing page leaves through the same builder so it inherits the same
    // reduced-motion contract; its `rest` is `display: none`, which is what a
    // register that is not showing actually is.
    compose({
      targets: outgoing,
      rest: { clearProps: 'transform,transformOrigin,transformPerspective', display: 'none' },
      beats: [
        {
          from: { rotationY: 0, transformOrigin: 'left center', transformPerspective: 1600 },
          to: { rotationY: degrees('page-turn'), display: 'none' },
          duration: 'page-turn',
          ease: 'turn',
        },
      ],
    });
  }

  return timeline;
}

/* ── buttons: COMPRESS ────────────────────────────────────────────────────── */

/**
 * A button is an object: pressing it moves it TOWARD its own shadow by exactly
 * the shadow's offset, and the shadow shrinks to nothing underneath it.
 *
 * One tweened scalar drives both halves. `.moyo-pressable` (globals.css) writes
 * its box-shadow and its `translate` as `calc()`s over `--moyo-press`, so the
 * travel distance and the shadow offset are literally the same number and
 * cannot drift — that is why there is no `travel.compress` token. GSAP tweens
 * custom properties directly (node_modules/gsap/CSSPlugin.js:1385), and
 * `translate` is a standalone CSS property, so this never fights GSAP's own
 * transform cache on the same element.
 *
 * Built paused and reversible: press plays it, release reverses it. This is the
 * one primitive on `reducedMotion: 'instant'` — the press still reads as a
 * press, it just has no duration. A control that stops responding under reduced
 * motion has lost its affordance for the reader who asked for less movement.
 */
export function compress(options: BaseOptions): gsap.core.Timeline {
  return compose({
    ...options,
    paused: options.paused ?? true,
    reducedMotion: 'instant',
    rest: { clearProps: '--moyo-press' },
    beats: [
      {
        from: { '--moyo-press': 1 },
        to: { '--moyo-press': 0 },
        duration: 'compress',
        ease: 'compress',
      },
    ],
  });
}

/* ── the mark: PULSE ──────────────────────────────────────────────────────── */

/**
 * The soft breath the mark takes WHILE Natalie is listening, and at no other
 * time. Built paused and yo-yo'd: the caller plays it when listening starts and
 * kills it when listening stops, so there is no state in which this runs
 * unattended.
 *
 * Under reduced motion it never runs and the mark sits at rest — the listening
 * state has to be carried by the live region and the copy, which it should have
 * been carrying anyway. A pulse is not an accessible status.
 */
export function pulse(options: BaseOptions): gsap.core.Timeline {
  const timeline = compose({
    ...options,
    paused: options.paused ?? true,
    rest: { clearProps: 'transform,opacity' },
    beats: [
      {
        from: { scale: 1, opacity: 1 },
        to: { scale: scale.pulse, opacity: opacity.pulse },
        duration: 'pulse',
        ease: 'breath',
      },
    ],
  });
  // Configured only on a real timeline. Under reduced motion `compose` returns
  // an empty one, and an infinite repeat over zero duration is a timeline the
  // ticker can never finish rendering — the reduced-motion path must be inert,
  // not merely silent.
  if (!isReducedMotion()) timeline.repeat(-1).yoyo(true);
  return timeline;
}

/* ── progress: LOCK IN ────────────────────────────────────────────────────── */

/**
 * A piece dropping the last few millimetres into a slot it is already aligned
 * with. Shorter travel and harder ease than `snap`: `snap` is a block arriving,
 * `lockIn` is the click of it seating. Chapters use `snap` for the piece and
 * `lockIn` for the slot receiving it.
 */
export function lockIn(options: BaseOptions): gsap.core.Timeline {
  return compose({
    ...options,
    rest: { clearProps: 'transform' },
    beats: [
      {
        from: { y: `-${travel['lock-in']}`, scale: overshoot.snap },
        to: { y: 0, scale: 1 },
        duration: 'lock-in',
        ease: 'lock',
      },
    ],
  });
}

/* ── depth: PARALLAX ──────────────────────────────────────────────────────── */

export interface ParallaxOptions extends BaseOptions {
  /** Travel across the whole scroll range. Negative moves against the scroll. */
  distance: string;
}

/**
 * The only ambient, scroll-scrubbed movement in the vocabulary. Under reduced
 * motion it FREEZES at the layout position the markup already put it in — not
 * at some mid-scroll offset, because that would mean the reduced-motion reader
 * sees a composition nobody designed. Depth on a frozen page comes from the
 * layering, which was doing the work anyway.
 *
 * Always scrubbed: a parallax that plays on entry is not a parallax, it is a
 * decorative tween with no personality, which the easing law forbids.
 */
export function parallax({ distance, ...options }: ParallaxOptions): gsap.core.Timeline {
  return compose({
    ...options,
    scroll: {
      start: 'top bottom',
      end: 'bottom top',
      ...options.scroll,
      scrub: options.scroll?.scrub ?? true,
    },
    rest: { clearProps: 'transform' },
    beats: [{ from: { y: 0 }, to: { y: distance }, duration: 'page-turn', ease: 'turn' }],
  });
}

/* ── type: SPLIT ──────────────────────────────────────────────────────────── */

export interface SplitOptions extends BaseOptions {
  /** What the hero is cut into. Lines read best at display sizes. */
  unit?: 'lines' | 'words' | 'chars';
}

export interface SplitResult {
  timeline: gsap.core.Timeline;
  /** Null under reduced motion — the text was never split. */
  split: SplitText | null;
}

/**
 * SplitText, verified present in the installed package (see ./register).
 *
 * Under reduced motion the element is NOT SPLIT AT ALL — the text renders as
 * one whole node with its original markup, which is both the documented reduced
 * -motion behaviour and the better screen-reader result. That is why this
 * returns the instance: the caller reverts it, and a null means there is
 * nothing to revert.
 *
 * `mask: 'lines'` gives each line an overflow-hidden wrapper so the pieces rise
 * out of the line box instead of sliding over the paragraph above it.
 * `aria: 'auto'` puts the original string back on the element as a label, so
 * splitting a heading does not turn it into a bag of single characters for a
 * screen reader.
 */
export function splitReveal({ unit = 'lines', ...options }: SplitOptions): SplitResult {
  if (isReducedMotion()) {
    return { timeline: gsap.timeline({ paused: true }), split: null };
  }

  // Splitting to `chars` alone emits every letter as its own inline element,
  // which hands the browser a legal break point between any two letters — a
  // display headline then sets as "LEARNING H / AS A HEART". Asking for
  // 'words,chars' keeps each word as a wrapper the line breaker cannot enter,
  // while still yielding the per-character targets the animation staggers over.
  // Words wrap at spaces or the line overflows; a letterform is never split.
  const split = SplitText.create(options.targets as gsap.DOMTarget, {
    type: unit === 'chars' ? 'words,chars' : unit,
    mask: unit,
    aria: 'auto',
    autoSplit: true,
  });
  const pieces = unit === 'lines' ? split.lines : unit === 'words' ? split.words : split.chars;

  return {
    timeline: compose({
      ...options,
      targets: pieces,
      stagger: options.stagger ?? secs('settle'),
      rest: { clearProps: 'transform' },
      beats: [
        {
          from: { yPercent: 100 },
          to: { yPercent: 0 },
          duration: 'thunk',
          ease: 'entrance',
        },
      ],
    }),
    split,
  };
}

/* ── draggables: ROTATIONAL INERTIA ───────────────────────────────────────── */

export interface TiltOptions extends BaseOptions {
  /**
   * Signed pointer velocity, normalised to −1…1. The caller measures it; this
   * primitive only decides what a card does with it.
   */
  velocity: number;
}

/**
 * The rotational lag a held object has: it trails the hand, then squares up
 * when the hand stops. `rotate.drag` is the ceiling — "slight" is the brief,
 * and a draggable that spins is a toy rather than a piece of work.
 */
export function inertialTilt({ velocity, ...options }: TiltOptions): gsap.core.Timeline {
  const angle = degrees('drag') * gsap.utils.clamp(-1, 1, velocity);
  return compose({
    ...options,
    rest: { clearProps: 'transform' },
    beats: [
      { to: { rotation: angle }, duration: 'compress', ease: 'compress' },
      { to: { rotation: 0 }, duration: 'release', ease: 'release' },
    ],
  });
}

/**
 * Binds pointer drag on one element to `inertialTilt`. Separated from the
 * primitives on purpose: everything above returns a timeline and owns no
 * listeners, so a chapter can compose them freely. This owns listeners, so it
 * returns its disposer and the caller is responsible for calling it.
 */
export function bindDragInertia(element: HTMLElement): () => void {
  let lastX = 0;
  let lastTime = 0;
  let tilt: gsap.core.Timeline | undefined;

  const onPointerMove = (event: PointerEvent): void => {
    if (event.buttons === 0) return;
    const now = event.timeStamp;
    const elapsed = now - lastTime;
    if (elapsed <= 0) return;
    // px/ms scaled so an ordinary drag reaches the ceiling rather than a flick.
    const velocity = ((event.clientX - lastX) / elapsed) * 0.5;
    lastX = event.clientX;
    lastTime = now;
    tilt?.kill();
    tilt = inertialTilt({ targets: element, velocity });
  };

  const onPointerDown = (event: PointerEvent): void => {
    lastX = event.clientX;
    lastTime = event.timeStamp;
  };

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  return () => {
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('pointermove', onPointerMove);
    tilt?.kill();
  };
}

/**
 * The whole vocabulary, as the object `useMotionScene` hands a chapter. Adding
 * a verb here is a design decision, not a refactor — these personalities ARE the
 * identity, and a fourteenth needs a reason and a row in the motion matrix.
 */
export const motionApi = {
  thunk,
  open,
  peel,
  draw,
  crossOut,
  snap,
  pageTurn,
  compress,
  pulse,
  lockIn,
  parallax,
  splitReveal,
  inertialTilt,
  bindDragInertia,
  /** Escape hatch for a chapter that must read trigger state; not for building. */
  ScrollTrigger: ScrollTriggerClass,
} as const;

export type MotionApi = typeof motionApi;
