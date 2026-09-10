/**
 * The two per-vertex scalars `SkinNodeMaterial` reads, computed from the
 * geometry at load.
 *
 * THE TOOL THE COMMENTS POINTED AT DOES NOT EXIST. `skin.ts` and `skin.test.ts`
 * both cite `tools/bake_skin_aux.py` as the producer of `aCurvature` and
 * `aThickness`; there is no such file, and the only code that ever set those
 * attributes is the shader probe, which fills them with `0.5` and `0.4`. The
 * shipped assets carry POSITION, NORMAL, TEXCOORD_0, COLOR_0, JOINTS_0 and
 * WEIGHTS_0 and nothing else, so the material could not have been applied to
 * the real body — `attribute()` on a name the geometry does not have is not a
 * fallback, it is a bind failure.
 *
 * A load-time bake rather than an offline one, deliberately. Both attributes
 * are functions of the rest geometry alone, and an offline bake means a
 * re-export every time the asset moves plus a fourth copy of the mesh to keep
 * in sync.
 *
 * The cost, measured on the shipped phone body rather than estimated: 78 ms for
 * the 18k-vertex body primitive on an M-series Mac, once, at load. Only the
 * body is baked — `hair.ts` reads its own attributes. Budget for a phone CPU
 * being several times slower and keep it off the first frame.
 *
 * It was 22 ms when the thickness march reported cell indices instead of
 * distances. That version was 3.5x faster and wrong: it produced seven distinct
 * thicknesses across the whole mesh. The extra 56 ms buys 4744 of them and a
 * floor of 0.2 mm instead of 25.9 mm.
 *
 * IT TAKES THREE'S ATTRIBUTE ACCESSORS, NOT RAW ARRAYS, and that is the whole
 * reason the interface is shaped this way. Both shipped primitives are
 * INTERLEAVED — `byteStride` 64 on POSITION and NORMAL — so a caller that hands
 * over the underlying `Float32Array` reads every third vector from the wrong
 * offset and gets garbage. It is not a loud failure either: it produced `NaN`
 * curvature and 100% opaque thickness, both of which a shader consumes without
 * complaint. `BufferAttribute` and `InterleavedBufferAttribute` both implement
 * `getX/getY/getZ`, so accepting that shape makes the mistake unavailable.
 *
 * BOTH RETURN `Float32Array`, non-negotiably. three r185 cannot bind an
 * `itemSize === 1` attribute backed by an 8-bit array — `WebGPUAttributeUtils`
 * has no entry for it and throws "Vertex format not supported yet". Packing
 * these to int8 to save 100 KB is the obvious optimisation and it does not work
 * (doc 22 §4 row 2).
 *
 * SOT: ./skin.ts · docs/pack/22-embodied-tutor-avatar-spec.md §4 rows 1-2
 * SOT-KEYWORDS: skin aux bake curvature thickness attribute float32 sss preintegrated voxel
 */

/**
 * The curvature that maps to 1.0, in inverse metres — a radius of 2.5 cm.
 *
 * The shader wants 0..1, but curvature is 1/radius and has units. Anchoring it
 * to a real length is what keeps the scattering the same on a head whatever
 * scale the asset is exported at: a cheek at ~9 cm radius lands near 0.28 and
 * the nostril and lip edges push toward 1, which is the ordering the
 * pre-integrated term exists to express.
 */
export const CURVATURE_REFERENCE = 40;

/** Thickness at or beyond this, in metres, is opaque. A torso, not an ear. */
export const THICKNESS_REFERENCE = 0.1;

/**
 * Grid resolution along the longest axis. This is a BROAD-PHASE structure only
 * — it narrows which triangles a ray might hit and never decides the distance,
 * so its resolution costs accuracy nowhere.
 *
 * It used to decide the distance, and that was wrong in a way the synthetic
 * fixtures could not show. Marching cell by cell and reporting the cell index
 * of the first occupied cell quantises thickness to the cell size: on the
 * 1.657 m body that is 12.95 mm, the shortest measurable thickness is two cells
 * (25.9 mm), and the whole mesh collapses onto SEVEN distinct values with 82%
 * of vertices on the two end bins. Ears, eyelids, lips, nostril wings and
 * fingers are all thinner than 25.9 mm — they are the vertices subsurface
 * scattering exists for — and every one of them read the identical 0.2589.
 */
const GRID = 128;

/** Ignore a hit nearer than this; below skin thickness, above float noise. */
const SELF_HIT_EPSILON = 0.0002;

export interface SkinAux {
  readonly curvature: Float32Array;
  readonly thickness: Float32Array;
}

/** The subset of `BufferAttribute` this needs — `InterleavedBufferAttribute` too. */
export interface VectorAttribute {
  readonly count: number;
  getX(i: number): number;
  getY(i: number): number;
  getZ(i: number): number;
}

export interface Geometry {
  readonly position: VectorAttribute;
  readonly normal: VectorAttribute;
  readonly index: { readonly count: number; getX(i: number): number } | null;
}

/**
 * Curvature MAGNITUDE per vertex, from how much the normal turns per metre
 * across the one-ring. Unsigned, so it is not mean curvature and must not be
 * called that: a convex and a concave sphere of the same radius both measure
 * 0.5. That is the right quantity for `skin.ts`, which uses it only to scale
 * the terminator scatter, but the name would be a lie. Scale-anchored through `CURVATURE_REFERENCE` rather than
 * normalised against the mesh's own maximum — a per-mesh normalisation makes
 * the body and the head shade differently for no reason other than which one
 * happened to contain the sharpest crease.
 */
function bakeCurvature(g: Geometry, count: number): Float32Array {
  const sum = new Float64Array(count);
  const seen = new Uint32Array(count);
  const { position: P, normal: N, index } = g;
  const triangles = index ? index.count : count;

  const accumulate = (a: number, b: number): void => {
    const dx = P.getX(b) - P.getX(a);
    const dy = P.getY(b) - P.getY(a);
    const dz = P.getZ(b) - P.getZ(a);
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (distance < 1e-7) return;
    const nx = N.getX(b) - N.getX(a);
    const ny = N.getY(b) - N.getY(a);
    const nz = N.getZ(b) - N.getZ(a);
    sum[a] = sum[a]! + Math.sqrt(nx * nx + ny * ny + nz * nz) / distance;
    seen[a] = seen[a]! + 1;
  };

  for (let t = 0; t < triangles; t += 3) {
    const a = index ? index.getX(t) : t;
    const b = index ? index.getX(t + 1) : t + 1;
    const c = index ? index.getX(t + 2) : t + 2;
    accumulate(a, b);
    accumulate(b, c);
    accumulate(c, a);
    accumulate(b, a);
    accumulate(c, b);
    accumulate(a, c);
  }

  const out = new Float32Array(count);
  for (let v = 0; v < count; v += 1) {
    const k = seen[v]! > 0 ? sum[v]! / seen[v]! : 0;
    out[v] = Math.min(1, k / CURVATURE_REFERENCE);
  }
  return out;
}

/**
 * Thickness by marching inward along −normal through an occupancy grid until
 * the far surface is met.
 *
 * A SURFACE grid, not a solid one, which is what makes this cheap: filling a
 * closed volume needs a watertight mesh and this body is not one — it is a
 * skinned shell with a separate hair primitive and open boundaries at the
 * wrists and neck. Marching from one surface to the next needs neither.
 *
 * The march starts two cells in so it does not immediately re-hit the vertex's
 * own surface, and a ray that leaves the bounds without meeting anything is
 * opaque rather than infinitely thin — an unmet ray means the geometry did not
 * close, not that the flesh is translucent.
 */
function bakeThickness(g: Geometry, count: number): Float32Array {
  const { position: P, normal: N } = g;
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
  if (!Number.isFinite(span) || span <= 0) return new Float32Array(count).fill(1);
  const cell = span / GRID;
  const nx = Math.max(1, Math.ceil((maxX - minX) / cell) + 1);
  const ny = Math.max(1, Math.ceil((maxY - minY) / cell) + 1);
  const nz = Math.max(1, Math.ceil((maxZ - minZ) / cell) + 1);
  const at = (ix: number, iy: number, iz: number): number => (iz * ny + iy) * nx + ix;

  const index = g.index;
  const triangleCount = index ? Math.floor(index.count / 3) : Math.floor(count / 3);
  const corner = (t: number, k: number): number => (index ? index.getX(t * 3 + k) : t * 3 + k);

  /*
    Triangles bucketed per cell, in two passes so the storage is one flat array
    rather than 2 million sub-arrays: pass one counts, pass two fills. Bucketed
    from a barycentric raster rather than from vertices, because a vertex-only
    bucket misses every cell a triangle crosses without landing in.
  */
  const cellOf = (x: number, y: number, z: number): number =>
    at(
      Math.min(nx - 1, Math.max(0, Math.round((x - minX) / cell))),
      Math.min(ny - 1, Math.max(0, Math.round((y - minY) / cell))),
      Math.min(nz - 1, Math.max(0, Math.round((z - minZ) / cell))),
    );

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

  const counts = new Uint32Array(nx * ny * nz + 1);
  for (let t = 0; t < triangleCount; t += 1) visit(t, (c) => { counts[c + 1] = counts[c + 1]! + 1; });
  for (let i = 1; i < counts.length; i += 1) counts[i] = counts[i]! + counts[i - 1]!;
  const cursor = counts.slice(0, -1);
  const buckets = new Uint32Array(counts[counts.length - 1]!);
  for (let t = 0; t < triangleCount; t += 1) {
    visit(t, (c) => {
      buckets[cursor[c]!] = t;
      cursor[c] = cursor[c]! + 1;
    });
  }

  /** Möller-Trumbore, two-sided: an inward ray meets the far surface from behind. */
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

  const out = new Float32Array(count);
  const reach = THICKNESS_REFERENCE;
  const maxCells = Math.ceil(reach / cell) + 1;
  const seenTriangle = new Int32Array(triangleCount).fill(-1);
  for (let v = 0; v < count; v += 1) {
    const ox = P.getX(v);
    const oy = P.getY(v);
    const oz = P.getZ(v);
    const dx = -N.getX(v);
    const dy = -N.getY(v);
    const dz = -N.getZ(v);
    let nearest = Infinity;
    /*
      The cells the ray passes through, sampled at half a cell so none is
      skipped diagonally. Every candidate triangle is tested exactly once —
      a triangle spans several cells, and testing it per cell is the same
      answer computed repeatedly.
    */
    for (let step = 0; step <= maxCells * 2; step += 1) {
      const d = (step * cell) / 2;
      if (d > reach) break;
      const x = ox + dx * d;
      const y = oy + dy * d;
      const z = oz + dz * d;
      if (x < minX - cell || y < minY - cell || z < minZ - cell) break;
      if (x > maxX + cell || y > maxY + cell || z > maxZ + cell) break;
      const c = cellOf(x, y, z);
      for (let i = counts[c]!; i < counts[c + 1]!; i += 1) {
        const t = buckets[i]!;
        if (seenTriangle[t] === v) continue;
        seenTriangle[t] = v;
        const hit = hitDistance(ox, oy, oz, dx, dy, dz, t);
        // Its own faces sit at ~0; the far surface is the first real distance.
        if (hit > SELF_HIT_EPSILON && hit < nearest) nearest = hit;
      }
      if (nearest < d) break; // nothing further along can be nearer
    }
    out[v] = nearest === Infinity ? 1 : Math.min(1, nearest / THICKNESS_REFERENCE);
  }
  return out;
}

/**
 * Both attributes for one primitive. Pure: it reads the rest geometry and
 * returns arrays, so it is testable without a GPU and callable from either
 * platform's loader.
 */
export function bakeSkinAux(g: Geometry): SkinAux {
  const count = g.position.count;
  return { curvature: bakeCurvature(g, count), thickness: bakeThickness(g, count) };
}
