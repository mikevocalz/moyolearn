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
  const visit = (t: number, mark: (c: number) => void): void => {
    const a = corner(t, 0);
    const b = corner(t, 1);
    const c = corner(t, 2);
    const ax = P.getX(a);
    const ay = P.getY(a);
    const az = P.getZ(a);
    const bx = P.getX(b);
    const by = P.getY(b);
    const bz = P.getZ(b);
    const cx = P.getX(c);
    const cy = P.getY(c);
    const cz = P.getZ(c);
    const edge = Math.max(
      Math.abs(bx - ax) + Math.abs(by - ay) + Math.abs(bz - az),
      Math.abs(cx - ax) + Math.abs(cy - ay) + Math.abs(cz - az),
    );
    const steps = Math.max(1, Math.ceil(edge / cell));
    let last = -1;
    for (let i = 0; i <= steps; i += 1) {
      for (let j = 0; i + j <= steps; j += 1) {
        const u = i / steps;
        const w = j / steps;
        const q = 1 - u - w;
        const marked = cellOf(ax * q + bx * u + cx * w, ay * q + by * u + cy * w, az * q + bz * u + cz * w);
        if (marked !== last) {
          mark(marked);
          last = marked;
        }
      }
    }
  };

  // Two passes so the storage is one flat array rather than millions of arrays.
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
      // Half-cell steps so no cell is skipped on a diagonal. Each candidate
      // triangle is tested once per query, not once per cell it spans.
      const steps = Math.ceil((reach / cell) * 2) + 1;
      for (let step = 0; step <= steps; step += 1) {
        const d = (step * cell) / 2;
        if (d > reach) break;
        const x = ox + dx * d;
        const y = oy + dy * d;
        const z = oz + dz * d;
        if (x < minX - cell || y < minY - cell || z < minZ - cell) break;
        if (x > maxX + cell || y > maxY + cell || z > maxZ + cell) break;
        const c = cellOf(x, y, z);
        for (let i = starts[c]!; i < starts[c + 1]!; i += 1) {
          const t = buckets[i]!;
          if (seen[t] === query) continue;
          seen[t] = query;
          const hit = hitDistance(ox, oy, oz, dx, dy, dz, t);
          if (hit > epsilon && hit < nearest) nearest = hit;
        }
        if (nearest < d) break; // nothing further along can be nearer
      }
      return nearest;
    },
  };
}
