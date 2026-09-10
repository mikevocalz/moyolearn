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

import { buildMeshGrid } from './mesh-grid.ts';

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
  const grid = buildMeshGrid(g);
  const out = new Float32Array(count);
  for (let v = 0; v < count; v += 1) {
    const hit = grid.nearestHit(
      [P.getX(v), P.getY(v), P.getZ(v)],
      [-N.getX(v), -N.getY(v), -N.getZ(v)],
      THICKNESS_REFERENCE,
      SELF_HIT_EPSILON,
    );
    /*
      An unmet ray is opaque, not infinitely thin. It means the geometry did
      not close in that direction — this body is a shell with open boundaries
      at the wrists and neck — and "no far surface" must not read as "light
      passes straight through".
    */
    out[v] = Number.isFinite(hit) ? Math.min(1, hit / THICKNESS_REFERENCE) : 1;
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
