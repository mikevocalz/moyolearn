/**
 * A uniform grid over a mesh's triangles, and exact ray queries against it.
 *
 * Extracted rather than copied. The thickness bake needed "how far to the far
 * surface along -normal" and the cavity bake needs "is the +normal ray blocked
 * at all"; those are the same broad phase and the same intersection test, and a
 * second copy is a second place for the self-hit rule and the stride handling
 * to drift.
 *
 * BROAD PHASE ONLY. The grid narrows which triangles a ray might meet and never
 * decides a distance — that comes from Möller-Trumbore. The distinction is not
 * academic: a march that reports the first occupied CELL quantises its answer
 * to the cell size, which on a 1.657 m body is 12.95 mm and collapsed the whole
 * thickness field onto seven values.
 *
 * SOT: ./skin-aux.ts · ./mouth-cavity.ts
 * SOT-KEYWORDS: mesh grid broad phase ray triangle moller trumbore occupancy bucket avatar bake
 */

import type { Geometry } from './skin-aux.ts';

/** Resolution along the longest axis. Broad phase, so it costs no accuracy. */
const GRID = 128;

export interface MeshGrid {
  readonly cell: number;
  /**
   * Distance to the first triangle the ray meets, or `Infinity`. Triangles
   * nearer than `epsilon` are skipped — an outward ray leaves through the
   * vertex's own faces, and they are not what it is looking for.
   */
  nearestHit(
    origin: readonly [number, number, number],
    direction: readonly [number, number, number],
    reach: number,
    epsilon: number,
  ): number;
}

export function buildMeshGrid(g: Geometry): MeshGrid {
  const { position: P } = g;
  const count = P.count;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let v = 0; v < count; v += 1) {
    minX = Math.min(minX, P.getX(v));
    maxX = Math.max(maxX, P.getX(v));
    minY = Math.min(minY, P.getY(v));
    maxY = Math.max(maxY, P.getY(v));
    minZ = Math.min(minZ, P.getZ(v));
    maxZ = Math.max(maxZ, P.getZ(v));
  }
  const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
  const cell = span > 0 && Number.isFinite(span) ? span / GRID : 1;
  const nx = Math.max(1, Math.ceil((maxX - minX) / cell) + 1);
  const ny = Math.max(1, Math.ceil((maxY - minY) / cell) + 1);
  const nz = Math.max(1, Math.ceil((maxZ - minZ) / cell) + 1);
  const cellOf = (x: number, y: number, z: number): number =>
    (Math.min(nz - 1, Math.max(0, Math.round((z - minZ) / cell))) * ny +
      Math.min(ny - 1, Math.max(0, Math.round((y - minY) / cell)))) *
      nx +
    Math.min(nx - 1, Math.max(0, Math.round((x - minX) / cell)));

  const index = g.index;
  const triangleCount = index ? Math.floor(index.count / 3) : Math.floor(count / 3);
  const corner = (t: number, k: number): number => (index ? index.getX(t * 3 + k) : t * 3 + k);

  /*
    Bucketed from a barycentric raster, not from vertices: a vertex-only bucket
    misses every cell a triangle crosses without landing in, and a missed cell
    is a ray that passes through a surface as if it were not there.
  */
  /*
    EVERY CELL THE TRIANGLE'S BOUNDING BOX COVERS, enumerated — not sampled.
    A barycentric raster only VISITS cells, so a triangle can sit in a cell no
    sample landed in, and a ray stepping through that cell passes through the
    surface as if it were not there. Measured against brute-force
    Möller-Trumbore over all 33,136 body triangles, sampling lost 2.16% of hits
    with a worst error of 95 mm — a thin vertex reading fully opaque, which is
    speckled subsurface scattering over the ears and eyelids.

    A bounding box over-includes where an exact triangle-box overlap would not,
    and that is the right trade here: these triangles are millimetres against a
    13 mm cell, so a box is one to eight cells, while the 3x3x3 dilation that
    also fixes it puts 27x the triangles in every cell and made the eye bake
    take 1.4 seconds. Over-inclusion costs an intersection test that returns no
    hit; under-inclusion costs a wrong render.
  */
  const visit = (t: number, mark: (c: number) => void): void => {
    const a = corner(t, 0);
    const b = corner(t, 1);
    const c = corner(t, 2);
    const lo = (v: number, min: number, n: number): number =>
      Math.min(n - 1, Math.max(0, Math.floor((v - min) / cell)));
    const hi = (v: number, min: number, n: number): number =>
      Math.min(n - 1, Math.max(0, Math.ceil((v - min) / cell)));
    const x0 = lo(Math.min(P.getX(a), P.getX(b), P.getX(c)), minX, nx);
    const x1 = hi(Math.max(P.getX(a), P.getX(b), P.getX(c)), minX, nx);
    const y0 = lo(Math.min(P.getY(a), P.getY(b), P.getY(c)), minY, ny);
    const y1 = hi(Math.max(P.getY(a), P.getY(b), P.getY(c)), minY, ny);
    const z0 = lo(Math.min(P.getZ(a), P.getZ(b), P.getZ(c)), minZ, nz);
    const z1 = hi(Math.max(P.getZ(a), P.getZ(b), P.getZ(c)), minZ, nz);
    for (let k = z0; k <= z1; k += 1) {
      for (let j = y0; j <= y1; j += 1) {
        const row = (k * ny + j) * nx;
        for (let i = x0; i <= x1; i += 1) mark(row + i);
      }
    }
  };

  // Two passes so the storage is one flat array rather than millions of them:
  // count per cell, prefix-sum, then fill.
  const starts = new Uint32Array(nx * ny * nz + 1);
  for (let t = 0; t < triangleCount; t += 1) {
    visit(t, (c) => {
      starts[c + 1] = starts[c + 1]! + 1;
    });
  }
  for (let i = 1; i < starts.length; i += 1) starts[i] = starts[i]! + starts[i - 1]!;
  const cursor = starts.slice(0, -1);
  const buckets = new Uint32Array(starts[starts.length - 1]!);
  for (let t = 0; t < triangleCount; t += 1) {
    visit(t, (c) => {
      buckets[cursor[c]!] = t;
      cursor[c] = cursor[c]! + 1;
    });
  }

  const hitDistance = (
    ox: number, oy: number, oz: number,
    dx: number, dy: number, dz: number,
    t: number,
  ): number => {
    const a = corner(t, 0);
    const b = corner(t, 1);
    const c = corner(t, 2);
    const ax = P.getX(a);
    const ay = P.getY(a);
    const az = P.getZ(a);
    const e1x = P.getX(b) - ax;
    const e1y = P.getY(b) - ay;
    const e1z = P.getZ(b) - az;
    const e2x = P.getX(c) - ax;
    const e2y = P.getY(c) - ay;
    const e2z = P.getZ(c) - az;
    const px = dy * e2z - dz * e2y;
    const py = dz * e2x - dx * e2z;
    const pz = dx * e2y - dy * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    // Two-sided on purpose: a ray crossing a cavity meets the far wall from
    // behind, and a one-sided test would call the mouth open.
    if (Math.abs(det) < 1e-12) return -1;
    const inv = 1 / det;
    const tx = ox - ax;
    const ty = oy - ay;
    const tz = oz - az;
    const u = (tx * px + ty * py + tz * pz) * inv;
    if (u < 0 || u > 1) return -1;
    const qx = ty * e1z - tz * e1y;
    const qy = tz * e1x - tx * e1z;
    const qz = tx * e1y - ty * e1x;
    const v = (dx * qx + dy * qy + dz * qz) * inv;
    if (v < 0 || u + v > 1) return -1;
    return (e2x * qx + e2y * qy + e2z * qz) * inv;
  };

  const seen = new Int32Array(triangleCount).fill(-1);
  let query = 0;

  return {
    cell,
    nearestHit(origin, direction, reach, epsilon) {
      const [ox, oy, oz] = origin;
      const [dx, dy, dz] = direction;
      let nearest = Infinity;
      query += 1;
      /*
        Amanatides & Woo: step from cell to cell along the ray, crossing one
        boundary at a time, so every cell it passes through is visited exactly
        once. The half-cell sampling this replaces could step over a cell on a
        diagonal, which is the other half of the same 2.16% — enumerating the
        triangles is no use if the traversal skips the cell holding them.
      */
      const step = (d: number): number => (d > 0 ? 1 : d < 0 ? -1 : 0);
      const sx = step(dx);
      const sy = step(dy);
      const sz = step(dz);
      let ix = Math.min(nx - 1, Math.max(0, Math.floor((ox - minX) / cell)));
      let iy = Math.min(ny - 1, Math.max(0, Math.floor((oy - minY) / cell)));
      let iz = Math.min(nz - 1, Math.max(0, Math.floor((oz - minZ) / cell)));
      // Distance along the ray to the next boundary on each axis, and the
      // distance between successive boundaries. Infinity for a flat axis.
      const boundary = (o: number, min: number, i: number, s2: number): number => {
        if (s2 === 0) return Infinity;
        const edge = min + (s2 > 0 ? i + 1 : i) * cell;
        return edge - o;
      };
      let tMaxX = sx === 0 ? Infinity : boundary(ox, minX, ix, sx) / dx;
      let tMaxY = sy === 0 ? Infinity : boundary(oy, minY, iy, sy) / dy;
      let tMaxZ = sz === 0 ? Infinity : boundary(oz, minZ, iz, sz) / dz;
      const tDeltaX = sx === 0 ? Infinity : Math.abs(cell / dx);
      const tDeltaY = sy === 0 ? Infinity : Math.abs(cell / dy);
      const tDeltaZ = sz === 0 ? Infinity : Math.abs(cell / dz);

      let travelled = 0;
      for (;;) {
        const c = (iz * ny + iy) * nx + ix;
        for (let i = starts[c]!; i < starts[c + 1]!; i += 1) {
          const t = buckets[i]!;
          if (seen[t] === query) continue;
          seen[t] = query;
          const hit = hitDistance(ox, oy, oz, dx, dy, dz, t);
          /*
            `hit <= reach` is not optional. Without it a triangle that happens
            to lie in a visited cell is accepted at any distance: 53 of 3932
            finite hits came back beyond a 0.06 m reach, up to 0.072 m.
            Thickness clamps afterwards and did not care; the cavity reads
            `isFinite(hit)` as "blocked within reach" and misclassified all 53.
          */
          if (hit > epsilon && hit <= reach && hit < nearest) nearest = hit;
        }
        // Nothing in a cell further along can beat a hit already inside this one.
        if (nearest <= travelled) break;
        if (tMaxX < tMaxY && tMaxX < tMaxZ) {
          travelled = tMaxX;
          ix += sx;
          tMaxX += tDeltaX;
        } else if (tMaxY < tMaxZ) {
          travelled = tMaxY;
          iy += sy;
          tMaxY += tDeltaY;
        } else {
          travelled = tMaxZ;
          iz += sz;
          tMaxZ += tDeltaZ;
        }
        if (travelled > reach) break;
        if (ix < 0 || iy < 0 || iz < 0 || ix >= nx || iy >= ny || iz >= nz) break;
      }
      return nearest;
    },
  };
}
