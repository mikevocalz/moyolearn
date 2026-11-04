/**
 * Who is allowed to write which joint.
 *
 * Two systems writing one joint is the defect behind every artifact worth
 * naming — the shrug on every breath, the hand through the torso, the pose that
 * snaps back when a clip ends. None of them is fixed where it is seen; they are
 * fixed by deciding who owns the joint, and by making a second claim fail the
 * build instead of blending.
 *
 * TODAY THERE IS EXACTLY ONE WRITER. `HumanoPresence` restores the reference
 * pose each frame and applies local-frame deltas on top of it, and it works
 * precisely because nothing else writes a bone. This table exists so that stays
 * true by construction rather than by nobody having added a second writer yet —
 * the moment a clip, an IK solver or a gesture layer arrives, the conflict is a
 * build error at the point it is introduced rather than a visual bug found
 * three screens away.
 *
 * OWNERSHIP AND MODULATION ARE DIFFERENT PERMISSIONS, which is what lets the
 * skill's two rules coexist. An OWNER writes the joint's absolute value; a
 * MODULATOR adds a bounded delta on top. Exactly one owner per joint, any
 * number of modulators. "The clip is the base, the life layer is additive on
 * top" and "two layers claiming one joint is a build error" are then the same
 * rule read at two tiers, and the split already matches the code: restoring the
 * reference pose is the owning write, and every `pose()` call is a modulation.
 *
 * Names are derived, never retyped. `HUMANO_BONES` and `FINGER_BONES` are the
 * writer's own lists; a hand-typed name here would be a name that drifts from
 * the asset silently, and on this rig a bone that does not resolve moves
 * nothing while every test still passes.
 *
 * SOT: docs/decisions/adr-113-body-motion-layer.md · packages/avatar/rig-manifest.json
 * SOT-KEYWORDS: pose compositor joint ownership layer owner modulator deform bone conflict build error
 */
/** The driven leg joints — what stance and a weight shift actually rotate. */
export declare const LEG_DRIVEN: readonly string[];
/** Deform joints below the pelvis that follow their parent and are never written. */
export declare const LEG_PASSIVE: readonly string[];
export interface Layer {
    readonly name: string;
    /**
     * Set on exactly one layer. That layer owns every deform joint no other layer
     * owns — including joints nothing ever writes, which still need a decision
     * recorded against them.
     */
    readonly ownsRemainder?: boolean;
    /** Joints whose absolute value this layer writes. Exactly one layer per joint. */
    readonly owns: readonly string[];
    /** Joints this layer adds a bounded delta to. Must be owned by some layer. */
    readonly modulates: readonly string[];
    readonly why: string;
}
export declare const LAYERS: readonly Layer[];
/** Every joint any layer touches, deduplicated. */
export declare const CLAIMED_JOINTS: readonly string[];
export interface OwnershipProblem {
    readonly kind: 'unowned' | 'double-owned';
    readonly joint: string;
    readonly layers: readonly string[];
}
/**
 * The invariant, as a pure function so the build check and a unit test assert
 * the same thing rather than two similar things.
 */
export declare function ownershipProblems(layers?: readonly Layer[], 
/**
 * Every deform joint in the rig. Passed in rather than imported so this stays
 * a pure function the unit test can drive with synthetic layers — and so the
 * list comes from the generated manifest rather than a second copy here.
 */
deformJoints?: readonly string[]): OwnershipProblem[];
