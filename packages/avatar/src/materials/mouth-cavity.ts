/**
 * `aCavity` — how deep inside the mouth a vertex is, 0 at the lip aperture and
 * 1 at the back of the throat. `mouth.ts` multiplies base colour by it, which
 * is what stops an open mouth reading as a picture of a mouth pasted onto a
 * head.
 *
 * `buildCavityAttribute` in `mouth.ts` is a scatter and nothing more: it writes
 * a depth array into vertex slots. The depths themselves were to come from
 * `gnm/mouth-cavity.json`, produced by a tool that is not in this repo and
 * listed in a manifest whose nineteen assets are all absent. So the attribute
 * was declared, consumed, and never once computed.
 *
 * THE CAVITY IS FOUND, NOT LOOKED UP, and the criterion is deliberately not a
 * plane. An earlier reading located it as "behind z = 0.135", which is a number
 * true of one export of one head. Two properties define it without measuring
 * the asset first:
 *
 *   1. Its outward ray is blocked. A vertex on the cheek fires +normal into
 *      open air; a vertex on the palate fires +normal across the cavity and
 *      hits the tongue a couple of centimetres away.
 *   2. It moves with `jawOpen`. That is what separates the mouth from every
 *      other enclosed pocket on a body — an armpit is occluded too, and does
 *      not care whether the jaw is open.
 *
 * Neither alone is enough and the pair is: measured on the shipped body, 3939
 * vertices are occluded, 1470 move with the jaw, and 657 do both. That 657 is
 * larger than the cavity lining proper because it also catches the lip seam,
 * and that costs nothing — depth is measured FROM the aperture, so a vertex
 * wrongly included at the lip line gets a depth near zero, which is what it
 * would have been given anyway.
 *
 * POSITIONS ARE WELDED BEFORE THE WALK. UV seams split this mesh into far more
 * index components than it has surfaces, and a geodesic that stops at a texture
 * seam is a dark band across the palate. Welding at a tenth of a millimetre
 * merges 18,104 vertices into 16,833.
 *
 * Measured on the shipped head: 608 welded lining points, a 62-vertex aperture,
 * 69.5 mm deep, 196 distinct depths, 309 more adopted by the teeth and tongue,
 * 209 ms.
 *
 * SOT: ./mouth.ts · docs/pack/22-embodied-tutor-avatar-spec.md §4 row 7
 * SOT-KEYWORDS: mouth cavity aCavity bake depth geodesic jawOpen occlusion weld shell aperture
 */

import { buildMeshGrid } from './mesh-grid.ts';
import type { Geometry } from './skin-aux.ts';

/** How far an outward ray may travel before the vertex counts as open to air. */
const OUTWARD_REACH = 0.06;
/** A ray leaves through the vertex's own faces; ignore hits nearer than this. */
const SELF_HIT_EPSILON = 0.0002;
/** Jaw displacement below this is the morph's falloff, not the mouth. */
const JAW_MIN_M = 0.001;
/** Weld tolerance. A tenth of a millimetre is far below any real feature. */
const WELD_M = 0.0001;
/**
 * Teeth and the tongue are separate shells, so the walk cannot reach them.
 * They take the depth of the nearest lining vertex within this radius —
 * capped, so an ear canal on the far side of the head cannot claim to be a
 * throat.
 */
const ADOPT_RADIUS_M = 0.03;

export interface MouthGeometry extends Geometry {
  /**
   * Per-vertex magnitude of the `jawOpen` morph displacement, in metres. In a
   * glTF this target is usually SPARSE — only displaced vertices are stored —
   * so the caller expands it to a dense array of `position.count`.
   */
  readonly jawOpen: ArrayLike<number>;
}

/*
  Named for the BAKE, not the cavity: `mouth.ts` already exports a `MouthCavity`
  — the shape of the JSON its scatter was meant to parse, from a producer that
  never existed. Two types with one name in one barrel is a compile error, and
  the older one is the published API.
*/
export interface MouthCavityBake {
  /** 0 outside the mouth and at the lips, 1 at the deepest point found. */
  readonly depth: Float32Array;
  /** Distinct surface points the walk covered. Welded, so a UV seam is one. */
  readonly liningCount: number;
  /** Vertices that took a depth from a neighbour instead — teeth and tongue. */
  readonly adoptedCount: number;
  /** Vertices on the aperture ring the walk started from. */
  readonly apertureCount: number;
  /** The deepest geodesic distance found, in metres. */
  readonly maxDepthM: number;
}

export function bakeMouthCavity(g: MouthGeometry): MouthCavityBake {
  const { position: P, normal: N } = g;
  const count = P.count;

  // -- weld -----------------------------------------------------------------
  const key = (v: number): string =>
    `${Math.round(P.getX(v) / WELD_M)},${Math.round(P.getY(v) / WELD_M)},${Math.round(P.getZ(v) / WELD_M)}`;
  const representative = new Map<string, number>();
  const welded = new Int32Array(count);
  for (let v = 0; v < count; v += 1) {
    const k = key(v);
    const existing = representative.get(k);
    if (existing === undefined) {
      representative.set(k, v);
      welded[v] = v;
    } else {
      welded[v] = existing;
    }
  }

  // -- who is inside the mouth ---------------------------------------------
  const grid = buildMeshGrid(g);
  const lining = new Uint8Array(count);
  let liningCount = 0;
  for (let v = 0; v < count; v += 1) {
    if (!(g.jawOpen[v]! > JAW_MIN_M)) continue;
    const hit = grid.nearestHit(
      [P.getX(v), P.getY(v), P.getZ(v)],
      [N.getX(v), N.getY(v), N.getZ(v)],
      OUTWARD_REACH,
      SELF_HIT_EPSILON,
    );
    // Counted on the WELDED representative: a vertex split across a UV seam is
    // one surface point, and counting it twice made this disagree with the
    // number of points the walk actually visits.
    if (Number.isFinite(hit) && lining[welded[v]!] !== 1) {
      lining[welded[v]!] = 1;
      liningCount += 1;
    }
  }

  const depth = new Float32Array(count);
  if (liningCount === 0) {
    return { depth, liningCount: 0, adoptedCount: 0, apertureCount: 0, maxDepthM: 0 };
  }

  // -- adjacency, on welded vertices ---------------------------------------
  const index = g.index;
  const edgeCount = index ? index.count : count;
  const neighbours = new Map<number, number[]>();
  const link = (a: number, b: number): void => {
    const wa = welded[a]!;
    const wb = welded[b]!;
    if (wa === wb) return;
    const bucket = neighbours.get(wa);
    if (bucket) {
      if (!bucket.includes(wb)) bucket.push(wb);
    } else neighbours.set(wa, [wb]);
  };
  for (let t = 0; t + 2 < edgeCount; t += 3) {
    const a = index ? index.getX(t) : t;
    const b = index ? index.getX(t + 1) : t + 1;
    const c = index ? index.getX(t + 2) : t + 2;
    link(a, b);
    link(b, a);
    link(b, c);
    link(c, b);
    link(c, a);
    link(a, c);
  }

  /*
    The aperture is the boundary of the lining, found rather than declared: a
    lining vertex with a neighbour that is not lining is standing at the lip.
    Starting the walk from every one of them at once is what makes the depth a
    distance from the OPENING rather than from an arbitrary seed.
  */
  const distance = new Float64Array(count).fill(Infinity);
  const queue: number[] = [];
  let apertureCount = 0;
  for (const [v, adjacent] of neighbours) {
    if (lining[v] !== 1) continue;
    if (adjacent.some((w) => lining[w] !== 1)) {
      distance[v] = 0;
      queue.push(v);
      apertureCount += 1;
    }
  }
  /*
    A lining with no boundary is a sealed pocket — every neighbour is lining
    too. There is no aperture to measure from, so nothing is written rather
    than seeding somewhere arbitrary and producing a plausible gradient.
  */
  if (apertureCount === 0) {
    return { depth, liningCount, adoptedCount: 0, apertureCount: 0, maxDepthM: 0 };
  }

  // Dijkstra over Euclidean edge lengths. The frontier is small — hundreds of
  // vertices — so a linear scan for the minimum beats a heap's bookkeeping.
  const settled = new Uint8Array(count);
  let maxDepthM = 0;
  for (;;) {
    let best = -1;
    let bestDistance = Infinity;
    for (const v of queue) {
      if (settled[v] === 1) continue;
      if (distance[v]! < bestDistance) {
        bestDistance = distance[v]!;
        best = v;
      }
    }
    if (best < 0) break;
    settled[best] = 1;
    if (bestDistance > maxDepthM) maxDepthM = bestDistance;
    for (const w of neighbours.get(best) ?? []) {
      if (lining[w] !== 1 || settled[w] === 1) continue;
      const step = Math.hypot(
        P.getX(w) - P.getX(best),
        P.getY(w) - P.getY(best),
        P.getZ(w) - P.getZ(best),
      );
      if (bestDistance + step < distance[w]!) {
        distance[w] = bestDistance + step;
        if (!queue.includes(w)) queue.push(w);
      }
    }
  }

  const scale = maxDepthM > 0 ? 1 / maxDepthM : 0;
  for (let v = 0; v < count; v += 1) {
    const w = welded[v]!;
    if (lining[w] === 1 && Number.isFinite(distance[w]!)) depth[v] = Math.min(1, distance[w]! * scale);
  }

  /*
    Teeth and tongue are their own shells, so the walk cannot reach them across
    an edge — and leaving them at 0 lights them as brightly as a cheek, which
    is the exact "picture of a mouth" this attribute exists to prevent. They
    adopt the nearest lining vertex's depth, within a radius.
  */
  const liningVertices: number[] = [];
  for (let v = 0; v < count; v += 1) if (lining[welded[v]!] === 1 && depth[v]! > 0) liningVertices.push(v);
  let adoptedCount = 0;
  for (let v = 0; v < count; v += 1) {
    if (lining[welded[v]!] === 1) continue;
    const hit = grid.nearestHit(
      [P.getX(v), P.getY(v), P.getZ(v)],
      [N.getX(v), N.getY(v), N.getZ(v)],
      OUTWARD_REACH,
      SELF_HIT_EPSILON,
    );
    if (!Number.isFinite(hit)) continue; // open to air: not in the mouth
    let nearest = ADOPT_RADIUS_M;
    let adopted = 0;
    for (const l of liningVertices) {
      const d = Math.hypot(P.getX(l) - P.getX(v), P.getY(l) - P.getY(v), P.getZ(l) - P.getZ(v));
      if (d < nearest) {
        nearest = d;
        adopted = depth[l]!;
      }
    }
    depth[v] = adopted;
    if (adopted > 0) adoptedCount += 1;
  }

  return { depth, liningCount, adoptedCount, apertureCount, maxDepthM };
}
