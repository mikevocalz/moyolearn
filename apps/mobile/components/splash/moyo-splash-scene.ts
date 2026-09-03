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
 * One place for the beats, in ms. Total is what the whole thing costs a cold
 * start, so it is spelled out rather than left to be added up by hand.
 *
 * ponytail: fixed duration, not "ready when the app is". Nothing here blocks —
 * fonts are embedded by the expo-font plugin and the session restores behind
 * the overlay — so there is no readiness signal worth waiting on yet. If one
 * appears (a first paint that needs data), gate `hold` on it rather than
 * lengthening it.
 */
export const BEAT = {
  /** The mark rises and settles. */
  mark: 460,
  /** The wordmark follows, starting while the mark is still moving. */
  wordDelay: 300,
  word: 380,
  /** Time the finished lockup is simply held. */
  hold: 420,
  /** The overlay fades and unmounts, revealing the app already built behind. */
  out: 320,
} as const;

export const SPLASH_TOTAL = BEAT.wordDelay + BEAT.word + BEAT.hold;
