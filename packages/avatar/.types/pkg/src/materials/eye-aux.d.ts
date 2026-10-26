/**
 * `aEyeAux` — the vec4 the eye materials read, computed from the geometry at
 * load. Four unrelated things share one attribute because a vec4 costs one
 * binding and four floats cost four:
 *
 *   `.xy`  the vertex's position on the iris PLANE, in model metres, measured
 *          from the pupil centre. `eyes.ts` divides it by `irisRadius`, so 1.0
 *          is the limbus. It is also differentiated (`dFdx`/`dFdy`) to build a
 *          tangent frame, which is why it has to be a real planar projection
 *          and not a 0..1 UV — a normalised coordinate would give the parallax
 *          the wrong scale and the derivative the wrong units.
 *   `.z`   distance to the lid margin, in metres. Consumed through
 *          `smoothstep(0.0004, 0.0013)`, so the whole wet band is 0.4 to 1.3 mm
 *          wide and anything past ~1.3 mm is simply dry.
 *   `.w`   how enclosed the vertex is by the lids, 0..1, which is the contact
 *          shadow under the upper lid.
 *
 * NOTHING PRODUCED IT. The manifest lists `gnm/eye-aux.json` with a sha256, and
 * neither that file nor any code that writes or parses it exists. The only
 * values the attribute has ever held come from the shader probe: `xy` from the
 * raw position, `z = 0.5` and `w = 0.8`. `z = 0.5` is 500 mm — 385 times past
 * the far edge of a band that ends at 1.3 mm — so the wet line was off in every
 * frame it has ever drawn, and `w = 0.8` is a flat 54% darkening of both whole
 * eyeballs.
 *
 * AN EYE IS FOUND BY BEING A SPHERE. Not by vertex index, not by a name the
 * asset does not carry, and not by a position measured from one export: the
 * eyeballs are the connected components whose vertices sit at a near-constant
 * distance from their own centroid. On the shipped head that is unmistakable —
 * radius 14.61 mm with a standard deviation of 0.11 mm, which is 0.7%, against
 * a head or an arm that is nothing like a sphere.
 *
 * THE FORWARD AXIS IS THE POLE NEAREST THE LID MARGIN. A UV sphere's poles are
 * its two high-valence vertices, and the lids ring the visible part of the eye,
 * so the anterior pole sits a few millimetres from that rim while the posterior
 * one is a whole diameter behind it. Nothing here depends on which way the head
 * faces or on the asset's handedness.
 *
 * "Fire a ray out of each pole and take whichever escapes" is the obvious test
 * and it picks the WRONG pole on this head, which is why it is not used. The
 * lashes and the lid margins stand in front of the cornea, so the forward ray
 * is blocked; the eye's back faces the inside of a hollow skull, so the
 * backward ray exits through the shell. Measured: it returned a forward of
 * (0.025, 0.034, -0.988) where the anterior pole is at +Z.
 *
 * Cost, measured on the shipped head rather than estimated: 618 ms, once, at
 * load. Most of it is the contact shadow — 24 rays for each of 1028 eyeball
 * vertices — and it is the slowest of the three bakes for that reason.
 *
 * SOT: ./eyes.ts · docs/pack/22-embodied-tutor-avatar-spec.md §4 row 3
 * SOT-KEYWORDS: eye aux bake iris plane parallax lid margin wet line contact shadow sphere pole
 */
import type { Geometry } from './skin-aux.ts';
export interface EyeFit {
    readonly centre: readonly [number, number, number];
    readonly radiusM: number;
    /** Unit vector out of the pupil, found by which pole a ray can escape from. */
    readonly forward: readonly [number, number, number];
    readonly vertexCount: number;
    /** Standard deviation of the fitted radii, as a fraction. Sphere-ness. */
    readonly radiusSpread: number;
}
export interface EyeAux {
    /** Four floats per vertex. Zero everywhere that is not an eyeball. */
    readonly aux: Float32Array;
    readonly eyes: readonly EyeFit[];
}
export declare function bakeEyeAux(g: Geometry): EyeAux;
