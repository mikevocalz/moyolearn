/**
 * Brow strands — doc 22 §4 row 7, second half.
 *
 * The brows are ~0.45 mm-wide ribbons, two vertices across, six points long.
 * At that width a strand is roughly one pixel on a phone, and a hard-edged
 * one-pixel ribbon aliases into a crawling dotted line the moment the head
 * moves. The reference's fix is to fade the last 45 % of every strand out to
 * 15 % alpha:
 *
 *     diffuseColor.a *= 1.0 - smoothstep(0.55, 1.0, vTip) * 0.85;
 *
 * so the tip dissolves instead of ending. That is also anatomically right —
 * a real brow hair tapers to nothing — which is why the same term does double
 * duty as anti-aliasing and as grooming.
 *
 * WHY `opacityNode` IS THE EXACT PORT. The reference patched
 * `<color_fragment>` to multiply `diffuseColor.a`. In TSL, `opacityNode`
 * feeds precisely that: `NodeMaterial.setupDiffuseColor()` assigns
 * `diffuseColor.a` from it. So the semantics match — a MULTIPLY into alpha —
 * as long as we seed from `materialOpacity` rather than from a bare constant,
 * which is what keeps `material.opacity` meaningful (the tier system fades the
 * whole groom out on `presence-2d` handoff by writing `opacity`).
 *
 * `aTip` is a **`Float32Array`, itemSize 1** — §4 row 2's rule again; a
 * single-component 8-bit attribute cannot be bound on WebGPU at r185.
 *
 * The strand geometry itself ports unchanged: it is typed-array ribbon
 * construction with no DOM and no WebGL dependency, and `update()` still
 * translates each strand by its root vertex's displacement so a brow raise
 * carries the brow. Only the material moved.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §4 rows 2, 7
 * SOT-KEYWORDS: brow strands eyebrow tip fade alpha opacitynode ribbon groom tsl
 */
import { MeshStandardNodeMaterial } from 'three/webgpu';
import type { Node } from 'three/webgpu';
import { Color } from 'three';
/** Normalised distance along a strand: 0 at the root, 1 at the tip. */
export declare const BROW_TIP_ATTRIBUTE = "aTip";
/** Where the fade begins and how much alpha it removes. Reference values. */
export declare const BROW_FADE_START = 0.55;
export declare const BROW_FADE_AMOUNT = 0.85;
type Float = Node<'float'>;
/**
 * The tip fade. Note `.oneMinus()` on the smoothstep *before* the 0.85 scale,
 * matching `1.0 - smoothstep(...) * 0.85` — the strand keeps 15 % alpha at the
 * very tip rather than vanishing, which is what stops the ends popping.
 */
export declare function browOpacityNode(): Float;
export interface BrowMaterialOptions {
    /** Near-black warm brown by default; never pure black, which kills the rim. */
    color?: Color;
}
export interface BrowMaterial {
    material: MeshStandardNodeMaterial;
    dispose(): void;
}
export declare function createBrowMaterial(options?: BrowMaterialOptions): BrowMaterial;
export {};
