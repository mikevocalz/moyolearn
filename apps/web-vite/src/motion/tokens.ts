/**
 * The one place `siteMotion` (packages/theme/tokens.ts) is translated into the
 * units GSAP takes. Durations are authored as CSS ms strings so build-css.mjs
 * can emit them as `--moyo-duration-*` for the CSS-transition micro-inter-
 * actions; GSAP counts in seconds. Converting here — once, in a typed helper —
 * is what stops `0.3` appearing in a timeline as a literal.
 *
 * `secs` is deliberately keyed to `SiteMotionDuration`, so a primitive cannot
 * pass a number it made up: there is no overload that accepts one.
 *
 * SOT: packages/theme/tokens.ts (siteMotion) · docs/site/motion-matrix.md
 * SOT-KEYWORDS: site motion tokens gsap seconds duration ease adapter web-vite
 */
import { siteMotion } from '@acme/theme';
import type { SiteMotionDuration, SiteMotionEase } from '@acme/theme';

/** A token duration in seconds. The only place ms becomes s. */
export const secs = (name: SiteMotionDuration): number =>
  Number.parseFloat(siteMotion.duration[name]) / 1000;

/** A token ease, by name. Exists so an ease is spelled as a key, not a string. */
export const ease = (name: SiteMotionEase): string => siteMotion.ease[name];

/**
 * A rotation token as a bare number. GSAP reads `rotation` in degrees, and the
 * tokens are unsigned magnitudes, so a primitive writes `-degrees('open')` and
 * the direction stays a decision at the call site rather than a second token.
 */
export const degrees = (name: keyof typeof siteMotion.rotate): number =>
  Number.parseFloat(siteMotion.rotate[name]);

export const { overshoot, travel, scale, opacity } = siteMotion;

export type { SiteMotionDuration, SiteMotionEase };
