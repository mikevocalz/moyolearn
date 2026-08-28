/**
 * The one projection every tier shares.
 *
 * The globe is drawn with an ORTHOGRAPHIC camera, and that is a load-bearing
 * decision rather than an aesthetic one. Under orthographic projection a point
 * on the sphere lands on screen at `centre + (x, -y) * radiusPx` with no
 * perspective divide, so the exact same eight lines of trigonometry place:
 *
 *   - the WebGL camera (Tier A and B),
 *   - the build-time SVG silhouette (Tier C — see
 *     `scripts/build-globe-geometry.mjs:orthographic`, which is this function
 *     inlined), and
 *   - the DOM leader lines that tie a learning-node card to its anchor.
 *
 * A perspective camera would have forced the DOM layer to import three, read
 * the live camera matrix, and therefore only work on the tiers that have a
 * camera at all. It also flatters a printed object badly: a globe with
 * foreshortening reads as a photograph of a ball, and this chapter is a printed
 * puzzle-piece map.
 *
 * The rotation order is YAW then TILT and the scene mirrors it with two nested
 * groups rather than one Euler, because three's Euler order is a source of
 * silent sign errors and a group nesting is unambiguous.
 *
 * SOT: this file · apps/web-vite/scripts/build-globe-geometry.mjs
 *      apps/web-vite/src/globe/generated/manifest.ts
 * SOT-KEYWORDS: globe projection orthographic anchor lat lon screen radius tier shared
 */

export const DEG = Math.PI / 180;

/**
 * The ocean sphere's radius as a fraction of the stage's shorter side.
 *
 * 0.36 and not 0.5 because the ring system reaches 1.30 radii
 * (`composition.ts`): 0.36 x 1.30 = 46.8% of the shorter side, which clears the
 * stage edge on a square viewport with a little room for the offset shadow.
 * Raising this without lowering `COMPOSITION_EXTENT` clips the outer ring.
 */
export const GLOBE_SCREEN_FRACTION = 0.36;

/** The ocean disc's radius in CSS pixels for a stage of this size. */
export function globeRadiusPx(width: number, height: number): number {
  return Math.min(width, height) * GLOBE_SCREEN_FRACTION;
}

export interface ProjectedAnchor {
  /** Horizontal position in unit-disc coordinates, -1 (left limb) to 1 (right limb). */
  readonly x: number;
  /** Vertical position in unit-disc coordinates, -1 (south limb) to 1 (north limb). */
  readonly y: number;
  /** Depth toward the viewer. Positive is the near hemisphere; <= 0 is behind the globe. */
  readonly z: number;
}

/**
 * Project a lon/lat anchor onto the unit disc, for a globe yawed by `yaw` and
 * tilted by `tilt` (both radians).
 *
 * Convention, fixed here and repeated in the geometry pipeline: +Y is north and
 * longitude 0° faces +Z at zero yaw. A point is on screen when `z > 0`.
 */
export function projectAnchor(
  lonDeg: number,
  latDeg: number,
  yaw: number,
  tilt: number,
): ProjectedAnchor {
  const phi = latDeg * DEG;
  const theta = lonDeg * DEG;
  const cosPhi = Math.cos(phi);

  const x = cosPhi * Math.sin(theta);
  const y = Math.sin(phi);
  const z = cosPhi * Math.cos(theta);

  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;

  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  return { x: x1, y: y * ct - z1 * st, z: y * st + z1 * ct };
}

/**
 * The yaw that brings `lonDeg` to the centre of the disc.
 *
 * Negated because yaw rotates the GLOBE, not the camera: to look at 20°E the
 * globe turns -20°. Getting this backwards produces a focus animation that
 * spins to the antipode, which looks deliberate and is the single most likely
 * bug in the seam the motion agent drives.
 */
export function yawForLongitude(lonDeg: number): number {
  return -lonDeg * DEG;
}

/**
 * Shortest signed angular delta from `from` to `to`, in radians.
 *
 * Focusing Tokyo from São Paulo must take the 160° route, not the 200° one.
 * Without this the globe unwinds through several full turns as the motion
 * agent's timeline accumulates yaw.
 */
export function shortestAngle(from: number, to: number): number {
  const TAU = Math.PI * 2;
  return ((((to - from) % TAU) + Math.PI * 3) % TAU) - Math.PI;
}
