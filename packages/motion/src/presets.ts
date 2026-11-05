/**
 * Motion presets: the only place a duration or a curve enters choreographed
 * motion. Every `defineMotion` in the product composes its tracks from these
 * through `track()`, and tooling/check-motion-durations.mjs fails the lint run
 * when a file that imports `@acme/motion` types a number into `durationMs`,
 * `delayMs` or a Reanimated `duration`.
 *
 * The numbers are not chosen here. They are parsed out of the theme's
 * `motion.duration` strings ('120ms'), so the CSS variables build-css.mjs emits
 * and the Kinetrell tracks below can never disagree. The bands follow
 * web-designer-pro motion.md §1: UI feedback 120–200 ms, transitions 250–400 ms,
 * longer only for a cinematic moment. `presets.test.ts` holds each preset to
 * its band, so a token edit that leaves a band fails a test instead of shipping.
 *
 * SOT: packages/theme/tokens.ts (`motion`) · web-designer-pro references/motion.md
 * SOT-KEYWORDS: motion presets kinetrell duration easing spring feedback
 *               transition entrance cinematic track
 */
import { motion } from '@acme/theme';
import type { EaseName, MotionState, MotionTrack } from 'kinetrell/core';

const MS = /^(\d+)ms$/;

/** '120ms' -> 120. Throws on anything else so a malformed token fails at import. */
export function tokenMs(value: string): number {
  const match = MS.exec(value);
  if (!match) throw new Error(`motion token "${value}" is not a whole-millisecond value`);
  return Number(match[1]);
}

export type MotionPreset = Readonly<{ durationMs: number; ease: EaseName }>;

/**
 * - `feedback`: a control answering a touch or click (press, toggle, select).
 * - `transition`: a state or view changing place (panel swap, value settling).
 * - `entrance`: something arriving; decelerates and never overshoots.
 * - `cinematic`: reserved for the four signatures (DIRECTION.md §Signatures).
 */
export const presets = {
  feedback: { durationMs: tokenMs(motion.duration.base), ease: motion.curve.entrance },
  transition: { durationMs: tokenMs(motion.duration.slow), ease: motion.curve.travel },
  entrance: { durationMs: tokenMs(motion.duration.slow), ease: motion.curve.entrance },
  exit: { durationMs: tokenMs(motion.duration.fast), ease: motion.curve.exit },
  cinematic: { durationMs: tokenMs(motion.duration.slower), ease: motion.curve.entrance },
} as const satisfies Record<string, MotionPreset>;

export type PresetName = keyof typeof presets;

/** The named spring, for Reanimated `withSpring` and Legend Motion `spring`. */
export const spring = {
  settle: {
    damping: motion.spring.settle.damping,
    stiffness: motion.spring.settle.stiffness,
    mass: motion.spring.settle.mass,
  },
} as const;

/** The same settle as a CSS `linear()` timing function, for the web. */
export const springCss = { settle: motion.spring.settle.css } as const;

/**
 * Where a track starts, in preset units rather than milliseconds: `after` lists
 * the presets that play before it in sequence, `overlap` pulls it earlier by a
 * fraction of the last of them. Choreography reads as "after the entrance,
 * overlapping a third" and stays correct when a token changes.
 */
export type TrackTiming = Readonly<{
  after?: readonly PresetName[];
  overlap?: number;
}>;

export function startOf(timing: TrackTiming = {}): number {
  const after = timing.after ?? [];
  const total = after.reduce((sum, name) => sum + presets[name].durationMs, 0);
  const last = after.length ? presets[after[after.length - 1]!].durationMs : 0;
  const overlap = Math.min(1, Math.max(0, timing.overlap ?? 0));
  return Math.max(0, Math.round(total - last * overlap));
}

export type TrackSpec = Readonly<{
  target: string;
  to: MotionState;
  from?: MotionState;
  repeat?: number;
  yoyo?: boolean;
}> & TrackTiming;

/** A Kinetrell track whose timing and curve come from a preset. */
export function track(preset: PresetName, spec: TrackSpec): MotionTrack {
  const { after, overlap, ...rest } = spec;
  const { durationMs, ease } = presets[preset];
  return { ...rest, atMs: startOf({ after, overlap }), durationMs, ease };
}
