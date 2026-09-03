// The geometry the Redraw scene imports, resolved against the repo's copy.
//
// `moyo-splash-scene.ts` beside this file is the AUTHORED scene, kept as
// written so it can be diffed against the source drop — it imports `BRAND`,
// `MARK`, `WORDMARK` and friends from "./moyo-paths". The repo already carries
// that geometry one directory up, and it names its inks ('plum', 'coral') so
// the palette stays the single source of colour. This bridges the two rather
// than committing a second 50KB copy of the same traced paths.
//
// SOT: ../moyo-paths.ts (geometry) · ../moyo-splash-scene.ts (ink → token)
// SOT-KEYWORDS: redraw splash paths shim brand geometry re-export

export {
  MARK,
  MARK_HEART,
  MARK_SIZE,
  WORDMARK,
  WORDMARK_SIZE,
  type MarkInk,
} from '../moyo-paths';

import { INK } from '../moyo-splash-scene';
import { SPLASH_GROUND } from '../moyo-splash-scene';

/**
 * The scene's colour names, resolved through the token palette.
 *
 * The authored file carried the traced hexes (#3C2357 plum, #E65545 coral,
 * #F5A628 amber, #099FA6 teal, #FFF7EA paper). Those are the same brand hues
 * the palette already holds — `packages/ui/logo-fill.ts` maps them one for one
 * — so they resolve rather than being copied. A second literal #3C2357 in this
 * repo is a copy that will not follow the palette when it moves.
 */
export const BRAND = {
  plum: INK.plum,
  coral: INK.coral,
  amber: INK.amber,
  teal: INK.teal,
  paper: SPLASH_GROUND,
  white: INK.white,
} as const;

export type BrandColor = keyof typeof BRAND;
