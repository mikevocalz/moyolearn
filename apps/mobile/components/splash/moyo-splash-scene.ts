// Colour and timing for the animated splash. Geometry is moyo-paths.ts; this
// file is the half of the scene that a designer changes.
//
// The paths file names its inks ('plum', 'coral', …) instead of carrying the
// traced hexes, for the same reason packages/ui/logo-fill.ts maps them: the
// brand hues live in the token palette, and a second copy of #3C2357 in a
// generated file is a copy that will not follow the palette when it moves.
// SOT: packages/theme/tokens.ts (colour) · this file (order and timing)
// SOT-KEYWORDS: splash scene ink timing moyo animated brand

import { palette } from '@acme/theme';

import type { MarkInk } from './moyo-paths';

/** The paths file's ink names, resolved. Same mapping as `logo-fill.ts`. */
export const INK: Record<MarkInk, string> = {
  plum: palette['moyo-purple'],
  coral: palette['moyo-coral'],
  amber: palette['moyo-mango'],
  teal: palette['moyo-teal'],
  // Not `surface`: this is the mark's own page-edge highlight, which has to
  // stay a real off-white rather than dissolving into whatever it sits on.
  white: palette.white,
};

/**
 * The wordmark's four letters, in the order they are written.
 *
 * The traced wordmark carries no colour — only the mark's ornaments do — so the
 * lockup's inks are named here, matching the shipped art letter for letter
 * (M plum, O coral, Y mango, O teal; LEARN and its rules in plum and coral).
 */
export const WORDMARK_INK = {
  m: INK.plum,
  o1: INK.coral,
  y: INK.amber,
  o2: INK.teal,
  learn: INK.plum,
  dashes: INK.coral,
} as const;

/**
 * The ground. It MUST equal the `backgroundColor` given to expo-splash-screen
 * in app.config.ts — the native splash cross-fades into this view, and any
 * difference between the two reads as a flash at the handoff.
 */
export const SPLASH_GROUND = palette.ink[50];

/**
 * The beats, in ms — slower than the authored Redraw timeline, and reordered.
 *
 * Two departures from that scene's `TIMELINE`, both deliberate:
 *
 *  1. THE BOOK COMES IN FIRST. Redraw draws the plum M as ink from its
 *     bottom-left foot and brings the pages in over it. Without a pen there is
 *     no writing to watch, so the two halves OPEN instead — the gesture the
 *     mark is a picture of — and the M rises into them once they are apart.
 *     The mark assembles rather than fading up.
 *  2. IT IS SLOWER. Every beat is longer and they overlap less, because the
 *     first pass at 1.1s and the second at 3.9s both ended before the eye had
 *     finished reading the frame it was on.
 *
 * ponytail: fixed duration, not "ready when the app is". Nothing here blocks —
 * fonts are embedded by the expo-font plugin and the session restores behind
 * the overlay — so there is no readiness signal worth waiting on yet. If one
 * appears (a first paint that needs data), gate `settled` on it rather than
 * lengthening it.
 */
export const BEAT = {
  /** The heart field rises with the book and is gone before the hand-off. */
  heartFieldIn: 1400,
  heartFieldOut: 4200,
  heartFieldFade: 900,
  /** The two page halves swing open about the spine. Coral leads, amber follows. */
  page: 900,
  pageStagger: 140,
  /** The plum M rises into the open book. */
  markDelay: 620,
  mark: 820,
  /** One lub-dub in the heart's negative space, on the beat the halves meet. */
  heartDelay: 1500,
  heart: 760,
  /** The leg ornaments cascade down the mark, top to bottom, in rhythm. */
  ornamentDelay: 1900,
  ornament: 340,
  /** Between buckets — six of them, so the cascade reads as one movement. */
  ornamentStagger: 110,
  /** The mark eases from hero size down into its lockup position. */
  liftDelay: 2500,
  lift: 900,
  /** MOYO's four glyphs rise, one after another. */
  wordDelay: 2900,
  word: 560,
  wordStagger: 170,
  /** LEARN settles under them. */
  learnDelay: 3700,
  learn: 560,
  /** The rules follow the word rather than arriving with it. */
  dashDelay: 180,
  /** The tagline lands last, and is the reason the hold is not dead air. */
  taglineDelay: 4150,
  tagline: 620,
  /** Everything is on screen; the composition is simply held. */
  settled: 5000,
  /** The overlay fades and unmounts, revealing the app already built behind. */
  out: 560,
} as const;

/** Hand-off. Long enough to read the finished lockup, not long enough to wait. */
export const SPLASH_TOTAL = 5600;

/** The tagline, drawn as real text so a screen reader gets it. */
export const TAGLINE = 'Learn it by heart.';
