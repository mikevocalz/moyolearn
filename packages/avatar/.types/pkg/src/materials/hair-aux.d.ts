/**
 * The two per-vertex scalars `hairSwayNode` reads, computed from the geometry
 * at load: `aHairT`, the root-to-tip parameter, and `aHairPhase`, the per-card
 * offset that stops the braids moving together.
 *
 * Neither had a producer. `positionNode` binds both, so the braid sway could
 * not run on the real body at all — a bound name the geometry does not carry is
 * a bind failure, not a fallback. The only code that had ever set them was the
 * shader probe, with `(i % 64) / 63` and a golden-angle spin over the raw
 * vertex index, which is a plausible-looking ramp across whatever order the
 * exporter happened to write and has nothing to do with any braid.
 *
 * THE CARDS COME FROM THE INDEX BUFFER, not from a naming convention. Hair is
 * one primitive of 27,534 vertices; a card is a connected component of it.
 * Measured on the shipped asset: 379 components, 42 to 82 vertices each, which
 * is a groom of separate braids rather than one welded shell.
 *
 * THE STRAND PARAMETER IS `TEXCOORD_0.v`, and that is measured rather than
 * assumed. Across all 379 cards |corr(uv.v, worldY)| is 0.975 while
 * |corr(uv.u, worldY)| is 0.044, so v runs along the braid and u across it. The
 * root end is the scalp end: every card puts its v=1 end at mean Y 1.641 m
 * against a crown at 1.654 m, and its v=0 end at 1.350 m. So t is 1 - v, and
 * because a card's v does not quite span the full 0..1 (0.933 on average) it is
 * renormalised per card — the sway pins the root with `smoothstep(0.08, 1.0, t)`
 * and a root sitting at t = 0.03 is a root that moves.
 *
 * Orientation is derived per card from geometry rather than hardcoded, so a
 * re-export that flips a UV island does not invert that card's braid. Where a
 * card lies flat enough that its two ends have no meaningful height difference,
 * it follows the majority of the groom instead of a coin toss.
 *
 * Cost, measured on the shipped groom rather than estimated: 9.8 ms for 27,534
 * vertices on an M-series Mac, once, at load. 379 cards, 379 distinct phases —
 * no hash collisions — with 18.6% of the groom inside the sway's pinned root
 * band and a mean t of 0.450.
 *
 * SOT: ./hair.ts · docs/pack/22-embodied-tutor-avatar-spec.md §4 rows 4-5
 * SOT-KEYWORDS: hair aux bake card connected component strand root tip phase uv braid sway
 */
import type { Geometry, VectorAttribute } from './skin-aux.ts';
export interface HairGeometry extends Geometry {
    /** `TEXCOORD_0`. Only `getY` is read — `u` runs across the braid. */
    readonly uv: Pick<VectorAttribute, 'count' | 'getX' | 'getY'>;
}
/** A vec4 tangent per vertex: xyz direction, w the bitangent handedness. */
export type HairTangents = Float32Array;
export interface HairAux {
    /** 0 at the root, 1 at the tip. */
    readonly t: Float32Array;
    /** Radians, 0..2π, constant within a card. */
    readonly phase: Float32Array;
    /** How many connected components the index buffer yielded. */
    readonly cardCount: number;
}
/**
 * Per-vertex tangents, by the standard UV-gradient method (Lengyel), averaged
 * over each vertex's triangles and Gram-Schmidt orthogonalised against the
 * normal.
 *
 * `hair.ts` sets `anisotropy: 0.88`, which routes BRDF_GGX through its
 * anisotropic branch, and its header says "the groom must keep authoring
 * tangents". No shipped asset carries TANGENT, so three has been falling back
 * to the screen-derivative frame the same header calls "wrong for hair".
 *
 * THE DIRECTION THIS PRODUCES IS ACROSS THE BRAID, NOT ALONG IT, and that is
 * correct rather than a bug to work around. A UV tangent points along +u by
 * definition, and on this groom u runs across the strand while v runs along it.
 * Measured on the shipped groom rather than argued from convention: the baked
 * tangent sits 0.6 degrees from the across-card edge and 83.5 degrees from the
 * along-strand edge, against a folded-random baseline of 57.3.
 *
 * Hair is anisotropic ALONG the fibre, so the material rotates the frame a
 * quarter turn — `hair.ts` sets `anisotropyRotation` to PI/2 for exactly this.
 * Expressing the hair-specific fact as a rotation of a standard frame beats
 * baking a non-standard one that every other consumer would have to know about.
 */
export declare function bakeHairTangents(g: HairGeometry): HairTangents;
export declare function bakeHairAux(g: HairGeometry): HairAux;
