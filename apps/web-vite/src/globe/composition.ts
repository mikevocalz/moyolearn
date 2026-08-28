/**
 * The parts of the composition all three tiers have to agree on.
 *
 * Split out of `scene.tsx` because Tier C has to draw the same rings, and
 * `scene.tsx` is the file that imports three — a Tier C visitor must not
 * download 200 kB of renderer to find out how wide the second ring is.
 *
 * SOT: this file · apps/web-vite/src/globe/scene.tsx
 *      apps/web-vite/src/globe/static-globe.tsx
 * SOT-KEYWORDS: globe composition atmosphere rings flat hard edged tiers shared
 */

import type { MoyoSceneToken } from './theme-tokens';

export const RADIAN = Math.PI / 180;

export interface AtmosphereRing {
  /** Inner radius, in ocean-sphere radii. */
  readonly inner: number;
  readonly outer: number;
  /** Rotation about the screen-horizontal axis, degrees. */
  readonly tiltDeg: number;
  /** Rotation in the screen plane, degrees. */
  readonly rollDeg: number;
  /** A packages/theme token NAME, closed so a lookup cannot be undefined. */
  readonly token: MoyoSceneToken;
}

/**
 * Three flat rings, from the inside out. NEVER A GLOW: no additive blending, no
 * falloff, no bloom. Each is tilted enough to pass behind the globe and be
 * occluded there, which is what makes a flat disc read as an orbit rather than
 * a halo.
 *
 * Widths are a constant 2.5–4.5% of the radius so they stay printed rules
 * instead of thinning toward hairlines as the stage shrinks.
 *
 * The outermost radius is 1.30 and `GLOBE_SCREEN_FRACTION` is 0.36, so the ring
 * system reaches 46.8% of the stage's shorter side. Those two numbers are a
 * pair: raise either and the outer ring is clipped by the stage on a square
 * viewport, which is the aspect the composition is designed at.
 */
export const ATMOSPHERE_RINGS = [
  { inner: 1.1, outer: 1.145, tiltDeg: 22, rollDeg: -6, token: 'moyoOutline' },
  { inner: 1.195, outer: 1.235, tiltDeg: -31, rollDeg: 9, token: 'moyoSecondary' },
  { inner: 1.275, outer: 1.3, tiltDeg: 15, rollDeg: 24, token: 'moyoOutline' },
] as const satisfies readonly AtmosphereRing[];

/** The outermost extent of the whole composition, in ocean-sphere radii. */
export const COMPOSITION_EXTENT = 1.3;
