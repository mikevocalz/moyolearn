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
export function resolveMotionMode(inputs: MotionInputs): MotionMode {
  if (inputs.userPreference === 'reduced') return 'reduced';
  if (inputs.systemPrefersReduced) {
    // On a screen the user may override back to full; in XR they may not.
    // Vection with a stationary inner ear is a nausea mechanism, and people
    // susceptible to it often do not find out until it is happening.
    if (inputs.surface === 'xr') return 'reduced';
    return inputs.userPreference === 'full' ? 'full' : 'reduced';
  }
  return 'full';
}

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

export const MOTION_POLICIES: Readonly<Record<MotionMode, MotionPolicy>> = Object.freeze({
  full: Object.freeze({
    mode: 'full',
    idleBodyScale: 1,
    gazeScale: 1,
    hairSwayScale: 1,
    cameraFloatScale: 1,
    mouthScale: 1,
    blinkScale: 1,
  }),
  reduced: Object.freeze({
    mode: 'reduced',
    idleBodyScale: 0,
    gazeScale: 0,
    // Pinned, not damped. Hair at 20 % still swings on a head turn, and the
    // braids are the largest moving silhouette on screen.
    hairSwayScale: 0,
    // The one that matters most in a headset, and the one nothing was wiring.
    cameraFloatScale: 0,
    mouthScale: 1,
    blinkScale: 1,
  }),
});

export function motionPolicy(mode: MotionMode): MotionPolicy {
  return MOTION_POLICIES[mode];
}

/* ------------------------------------------------------- the registry ---- */

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
export const ANIMATED_SURFACES: readonly AnimatedSurface[] = Object.freeze([
  { id: 'breath', moves: 'chest rise and head pitch', governedBy: 'idleBodyScale', consumer: 'face-bus pinFrame' },
  { id: 'sway', moves: 'weight shift, left/right and forward/back', governedBy: 'idleBodyScale', consumer: 'face-bus pinFrame' },
  { id: 'drift', moves: 'slow head yaw and pitch wander', governedBy: 'idleBodyScale', consumer: 'face-bus pinFrame' },
  { id: 'backchannel-nod', moves: 'head pitch on a listening beat', governedBy: 'idleBodyScale', consumer: 'face-bus pinFrame' },
  { id: 'saccade', moves: 'eye yaw and pitch', governedBy: 'gazeScale', consumer: 'face-bus pinFrame' },
  { id: 'hair-sway', moves: '250 braids, the largest moving silhouette', governedBy: 'hairSwayScale', consumer: 'createHairMaterial().update(t, scale)' },
  { id: 'camera-float', moves: 'the whole world, relative to the viewer', governedBy: 'cameraFloatScale', consumer: 'the stage camera rig' },
  // The body layer (ADR-113). All governed by idleBodyScale: the presence
  // writer takes `reducedMotion` and holds every one of these at rest.
  { id: 'weight-shift', moves: 'hip travel between the legs, spine counter-tilt', governedBy: 'idleBodyScale', consumer: 'presence/humano.ts reducedMotion' },
  { id: 'torso-turn', moves: 'a few degrees of yaw through the spine', governedBy: 'idleBodyScale', consumer: 'presence/humano.ts reducedMotion' },
  { id: 'shoulder-wrist', moves: 'shoulder rise and wrist flex, per side', governedBy: 'idleBodyScale', consumer: 'presence/humano.ts reducedMotion' },
  { id: 'finger-noise', moves: 'ten finger chains, 2-5 degrees, never in phase', governedBy: 'idleBodyScale', consumer: 'presence/humano.ts reducedMotion' },
  { id: 'gaze-away', moves: 'eyes leave the lens for under a second, head follows', governedBy: 'gazeScale', consumer: 'presence/humano.ts reducedMotion' },
  { id: 'a2f-face', moves: 'brows, lids, cheeks and mouth from the audio', governedBy: 'mouthScale', consumer: 'presence/humano.ts face input — speech-driven, never scaled' },
  { id: 'viseme', moves: 'the mouth, from speech', governedBy: 'mouthScale', consumer: 'speech driver — never scaled' },
  { id: 'blink', moves: 'eyelids at the engine rate', governedBy: 'blinkScale', consumer: 'idle engine — never disabled' },
]);

/**
 * Fails if any animated surface has no governing policy field, or if a surface
 * claims a field that does not exist.
 *
 * Run in the test suite, not at runtime: its job is to break the build when
 * someone adds an animation and forgets the accessibility wiring, which is a
 * review-time problem rather than a user-time one.
 */
export function assertMotionPolicyComplete(
  surfaces: readonly AnimatedSurface[] = ANIMATED_SURFACES
): void {
  const policy = MOTION_POLICIES.reduced as unknown as Record<string, unknown>;
  const problems: string[] = [];
  for (const surface of surfaces) {
    if (!(surface.governedBy in policy)) {
      problems.push(`'${surface.id}' claims policy field '${String(surface.governedBy)}', which does not exist`);
    }
    if (!surface.consumer) {
      problems.push(`'${surface.id}' names no consumer — the wiring cannot be reviewed`);
    }
  }
  // §7 enumerates these by name. If one is missing from the registry, the
  // registry has drifted from the document that governs it.
  for (const required of ['breath', 'sway', 'drift', 'saccade', 'hair-sway', 'camera-float']) {
    if (!surfaces.some((s) => s.id === required)) {
      problems.push(`doc 22 §7 names '${required}' and the registry does not contain it`);
    }
  }
  if (problems.length) {
    throw new Error(`reduced-motion coverage is incomplete:\n  - ${problems.join('\n  - ')}`);
  }
}

/* --------------------------------------------------------- application --- */

/** The consumers, injected. Every one is optional — a 2D surface has no hair. */
export interface MotionConsumers {
  faceBus?: { setReducedMotion(reduced: boolean): void };
  hair?: { update(timeSeconds: number, motionScale?: number): void };
  cameraFloat?: { setScale(scale: number): void };
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
export function applyMotionPolicy(
  policy: MotionPolicy,
  consumers: MotionConsumers
): { hairSwayScale: number } {
  consumers.faceBus?.setReducedMotion(policy.mode === 'reduced');
  consumers.cameraFloat?.setScale(policy.cameraFloatScale);
  return { hairSwayScale: policy.hairSwayScale };
}
