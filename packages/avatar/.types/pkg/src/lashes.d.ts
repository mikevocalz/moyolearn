/**
 * Eyelashes — doc 22 §4 row 13.
 *
 * Alpha-card ribbons along the baked lid margins. `tools/bake_lash_lines.py`
 * emits, per eye, the upper and lower lid-margin polylines as VERTEX INDICES
 * into the head's streamed position attribute (inner canthus → outer). Each
 * polyline becomes a 3-row ribbon strip — base row sitting on the margin verts,
 * mid and tip rows extruded away from the eyeball — cut out of a strand texture
 * with `alphaTest`, so it reads as a fringe rather than a flap.
 *
 * The ribbons FOLLOW BLINKS. `update()` rebuilds every ribbon from the current
 * margin-vert positions after each `computeVertices`, and recomputes the
 * directions too, so the fringe tilts with the lid instead of intersecting it.
 * A few hundred verts — the cost is noise next to the head evaluation.
 *
 * WHAT CHANGED IN THE PORT, AND WHAT DID NOT.
 * The geometry is typed-array arithmetic with no DOM and no WebGL dependency,
 * so it ports unchanged. The ONE blocker was the texture: the reference painted
 * it at startup with `document.createElement('canvas')` and 120 strokes, and
 * React Native has no DOM canvas. That paint is now baked offline by
 * `tools/bake_lash_texture.mjs` and shipped as a PNG on the CDN — see that
 * file's header for why baking beats a canvas polyfill. `createLashes` takes
 * the loaded texture; it no longer knows how the texture was made.
 *
 * ON `noUncheckedIndexedAccess`: this file stays strict. Every loop bound is
 * derived from a length that `assertMarginBounds` has already checked against
 * the position array, so `at()` narrows once, at one place, with that reason
 * written down — rather than the file buying a project-wide exemption the way
 * `src/gnm/model.ts` and `src/conform/driver.ts` had to.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §4 row 13
 * SOT-KEYWORDS: lashes lash ribbon lid margin blink alphatest texture bake canthus
 */
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { Mesh } from 'three';
import type { Texture } from 'three';
/** Parsed `gnm/lash-lines.json` (`tools/bake_lash_lines.py`). */
export interface LashLines {
    identitySha256: string;
    eyes: {
        side: 'left' | 'right';
        upper: number[];
        lower: number[];
    }[];
}
/** Upper lashes are twice the length of lower ones, as they are on a face. */
export declare const UPPER_LENGTH = 0.007;
export declare const LOWER_LENGTH = 0.0035;
/** Base, mid, tip. Three rows is the minimum that can curl. */
export declare const ROWS = 3;
/** One texture tile per 2.5 mm of lid margin. */
export declare const TILE_METRES = 0.0025;
/**
 * Fails loudly at construction if any margin index would read past the end of
 * the head's position array — which is what a stale `lash-lines.json` against a
 * rebaked identity looks like. Without this the ribbons would silently fill
 * with `NaN` and the lashes would vanish, which is a miserable bug to chase.
 */
export declare function assertMarginBounds(lines: LashLines, vertexCount: number): void;
/**
 * Applies the settings the baked PNG expects. Kept here rather than at the load
 * site so there is exactly one place that knows the texture's contract.
 */
export declare function configureLashTexture(texture: Texture): Texture;
export declare function createLashMaterial(texture: Texture): MeshStandardNodeMaterial;
export interface Lashes {
    meshes: Mesh[];
    material: MeshStandardNodeMaterial;
    /** Call after every `computeVertices` — rebuilds the ribbons from the lids. */
    update(positions: Float32Array): void;
    dispose(): void;
}
export declare function createLashes(lines: LashLines, positions: Float32Array, texture: Texture): Lashes;
