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
 * The cost, measured on the shipped phone body rather than estimated: 193 ms
 * for the 18k-vertex body primitive on an M-series Mac, once, at load. Only the
 * body is baked — `hair.ts` reads its own attributes. Budget for a phone CPU
 * being several times slower and keep it off the first frame.
 *
 * It was 22 ms when the thickness march reported cell INDICES instead of
 * distances, and 78 ms once it reported distances but sampled the grid instead
 * of enumerating it. Both were faster and wrong: the first produced seven
 * distinct thicknesses across the whole mesh, the second lost 2.16% of hits
 * with a worst error of 95 mm. What the time buys is 4751 distinct values, a
 * floor of 0.21 mm rather than 25.9 mm, and agreement with brute force on every
 * ray tested.
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
export declare const CURVATURE_REFERENCE = 40;
/** Thickness at or beyond this, in metres, is opaque. A torso, not an ear. */
export declare const THICKNESS_REFERENCE = 0.1;
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
    readonly index: {
        readonly count: number;
        getX(i: number): number;
    } | null;
}
/**
 * Both attributes for one primitive. Pure: it reads the rest geometry and
 * returns arrays, so it is testable without a GPU and callable from either
 * platform's loader.
 */
export declare function bakeSkinAux(g: Geometry): SkinAux;
