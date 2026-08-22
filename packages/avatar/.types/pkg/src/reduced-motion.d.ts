/**
 * Reduced motion as one render mode — doc 22 §7, doc 01.
 *
 * Doc 01 says it plainly: *"reduced-motion honored (tutor avatar included)"*,
 * and §7 sharpens it — *"a first-class render mode, not a CSS afterthought…
 * This is vestibular accessibility, and on a headset it is safety, not
 * preference."*
 *
 * ── THE PROBLEM THIS FILE EXISTS TO FIX ─────────────────────────────────────
 *
 * Before this, reduced motion was **three independent booleans**: the face bus
 * had `setReducedMotion`, the hair material took a `motionScale` argument, and
 * camera float had nothing at all. Each one worked. Nothing connected them, so
 * honouring the setting meant remembering three call sites — and the fourth
 * animated surface someone adds next quarter would ship unwired, because
 * nothing would fail when they forgot.
 *
 * That is precisely the "CSS afterthought" failure §7 names. An accessibility
 * setting that depends on every future author remembering it is not honoured;
 * it is honoured *so far*.
 *
 * So: one `MotionMode`, one `MotionPolicy` derived from it, and a registry of
 * every animated surface with the policy field that governs it. `ANIMATED_SURFACES`
 * is the thing that makes forgetting fail — a new surface without an entry
 * fails `assertMotionPolicyComplete()`, and a new surface with an entry cannot
 * be read without also reading its scale.
 *
 * ── WHY XR IS A FLOOR AND NOT A DEFAULT ─────────────────────────────────────
 *
 * On a screen, reduced motion is a preference: the user may turn it off and
 * accept a bit of sway. In a headset, vection from a moving virtual world with
 * a stationary inner ear is a nausea mechanism, and someone susceptible to it
 * often does not know until it is happening. So `resolveMotionMode()` treats a
 * system-level reduce request on an XR surface as **non-overridable**. A user
 * preference can turn reduced motion ON anywhere; it can only turn it OFF where
 * the consequence is aesthetic.
 *
 * ── WHAT STAYS MOVING, AND WHY ──────────────────────────────────────────────
 *
 * Not everything is pinned, and pinning everything would be its own failure.
 * The mouth keeps tracking speech — a tutor whose lips do not move is broken,
 * not restful — and blink stays at the engine's own rate, because **a face that
 * never blinks is not calm, it is unsettling**. Reduced motion removes the
 * vestibular load (translation, sway, drift, float), not the signs of life.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §7, §9; docs/pack/01
 * SOT-KEYWORDS: reduced motion accessibility vestibular xr safety idle sway hair camera float policy
 */
export type MotionMode = 'full' | 'reduced';
/** Where the avatar is being drawn. The distinction is a safety one, not a layout one. */
export type MotionSurface = 'screen' | 'xr';
export interface MotionInputs {
    /** The OS/browser setting. `prefers-reduced-motion`, `UIAccessibility`, etc. */
    systemPrefersReduced: boolean;
    /**
     * An explicit in-product choice, if the user made one. `null` means "follow
     * the system", which is the correct default and the one most products get
     * wrong by defaulting to `false`.
     */
    userPreference: MotionMode | null;
    surface: MotionSurface;
}
/**
 * Resolves the mode.
 *
 * The asymmetry is deliberate and is the whole point: a user may always ask for
 * LESS motion, anywhere. They may only ask for MORE where the consequence is
 * aesthetic — which is not a headset.
 */
export declare function resolveMotionMode(inputs: MotionInputs): MotionMode;
/**
 * Every scale a consumer needs, derived once. Scales rather than booleans so a
 * surface can be damped instead of pinned where that reads better — and so the
 * golden harness can capture an intermediate state if a designer asks for one.
 */
export interface MotionPolicy {
    mode: MotionMode;
    /** Breath, sway, drift, nod — the body's vegetative layer. */
    idleBodyScale: number;
    /** Eye saccades and gaze drift. Vestibular load is low, but they are motion. */
    gazeScale: number;
    /** Hair secondary motion — `createHairMaterial().update(t, scale)`. */
    hairSwayScale: number;
    /** Camera float / handheld breathing. The single biggest vection source. */
    cameraFloatScale: number;
    /** Speech-driven mouth. NEVER scaled — see the header. */
    mouthScale: 1;
    /** Blink. NEVER disabled — a face that never blinks is unsettling, not calm. */
    blinkScale: 1;
}
export declare const MOTION_POLICIES: Readonly<Record<MotionMode, MotionPolicy>>;
export declare function motionPolicy(mode: MotionMode): MotionPolicy;
export interface AnimatedSurface {
    id: string;
    /** What physically moves. Written for the person deciding whether it is covered. */
    moves: string;
    /** The `MotionPolicy` field that governs it. */
    governedBy: keyof MotionPolicy;
    /** Where the scale is consumed, so a reviewer can check the wiring exists. */
    consumer: string;
}
/**
 * Every animated surface on the stage, and what governs it.
 *
 * This is the anti-forgetting mechanism. Adding an animation without an entry
 * here fails `assertMotionPolicyComplete()`; adding an entry forces you to name
 * the policy field and the consumer, which is exactly the wiring that used to
 * get skipped.
 */
export declare const ANIMATED_SURFACES: readonly AnimatedSurface[];
/**
 * Fails if any animated surface has no governing policy field, or if a surface
 * claims a field that does not exist.
 *
 * Run in the test suite, not at runtime: its job is to break the build when
 * someone adds an animation and forgets the accessibility wiring, which is a
 * review-time problem rather than a user-time one.
 */
export declare function assertMotionPolicyComplete(surfaces?: readonly AnimatedSurface[]): void;
/** The consumers, injected. Every one is optional — a 2D surface has no hair. */
export interface MotionConsumers {
    faceBus?: {
        setReducedMotion(reduced: boolean): void;
    };
    hair?: {
        update(timeSeconds: number, motionScale?: number): void;
    };
    cameraFloat?: {
        setScale(scale: number): void;
    };
}
/**
 * One call site. This is the function that makes the setting real: pass the
 * policy and everything that can move is told about it together, rather than
 * three call sites that drift apart.
 *
 * The hair is not updated here — its scale rides along on the per-frame
 * `update(t, scale)` — so this returns the scale for the frame loop to use,
 * which keeps the policy as the single source rather than a value the loop
 * caches and forgets to refresh.
 */
export declare function applyMotionPolicy(policy: MotionPolicy, consumers: MotionConsumers): {
    hairSwayScale: number;
};
