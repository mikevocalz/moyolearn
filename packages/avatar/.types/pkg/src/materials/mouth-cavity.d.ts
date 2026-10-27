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
import type { Geometry } from './skin-aux.ts';
export interface MouthGeometry extends Geometry {
    /**
     * Per-vertex magnitude of the `jawOpen` morph displacement, in metres. In a
     * glTF this target is usually SPARSE — only displaced vertices are stored —
     * so the caller expands it to a dense array of `position.count`.
     */
    readonly jawOpen: ArrayLike<number>;
}
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
export declare function bakeMouthCavity(g: MouthGeometry): MouthCavityBake;
