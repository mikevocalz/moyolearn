/**
 * Orbit controls without a DOM — doc 22 §4 row 16.
 *
 * READ THIS FIRST: **in-product the camera is authored, not orbited.** A child
 * cannot be allowed to drag the tutor's face off screen, and the framing is a
 * design decision (doc 23) rather than a user affordance. This module is a
 * DEV AND QA TOOL — look-dev, golden-set camera placement, bug reproduction —
 * and nothing in the product path should import it.
 *
 * `OrbitControls` from `three/addons` is unusable here: it binds
 * `pointerdown`/`wheel`/`contextmenu` on a DOM element and reads
 * `element.getBoundingClientRect()`. React Native has none of that. The
 * harness's own fix (a fork of `r3f-native-orbitcontrols`) drives the same maths
 * off React Native's Gesture Responder System via a wrapping `View`.
 *
 * So this file takes the maths and NOT the input plumbing: it exposes
 * `orbit`/`dolly`/`pan` as plain method calls taking already-resolved deltas,
 * and the app wires whichever gesture library it already uses. That keeps the
 * package free of a gesture dependency and — more usefully — makes the camera
 * scriptable, which is what the golden harness actually needs. A camera you can
 * only reach through a finger is a camera you cannot put in a fixture.
 *
 * The damping is deliberately skippable: `update()` takes a `damped` flag and
 * the golden harness passes `false`, because damping drifts subpixels between
 * runs and that is precisely the 0.4 % budget the pixel diff is policing.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §4 row 16, §10.5
 * SOT-KEYWORDS: controls orbit camera gesture react-native dev qa golden damping spherical
 */
import { Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
export interface OrbitLimits {
    minDistance: number;
    maxDistance: number;
    /** Radians from +Y. Clamped away from the poles so the up-vector never flips. */
    minPolarAngle: number;
    maxPolarAngle: number;
    minAzimuthAngle: number;
    maxAzimuthAngle: number;
}
/**
 * Head-and-shoulders framing bounds. The polar clamp keeps the camera out of
 * the "looking up the nose" and "bald spot" zones, which are the two angles a
 * groomed avatar always looks worst from.
 */
export declare const DEFAULT_ORBIT_LIMITS: OrbitLimits;
export interface OrbitControlsOptions {
    target?: Vector3;
    limits?: Partial<OrbitLimits>;
    /** Radians per unit of orbit delta. */
    rotateSpeed?: number;
    panSpeed?: number;
    dampingFactor?: number;
}
export interface OrbitControls {
    target: Vector3;
    limits: OrbitLimits;
    /** Accumulate a rotation. Deltas are in the caller's own units. */
    orbit(deltaAzimuth: number, deltaPolar: number): void;
    /** `scale > 1` moves away, `< 1` moves closer — the pinch convention. */
    dolly(scale: number): void;
    /** Pan in the camera's screen plane, in metres at the target's depth. */
    pan(deltaX: number, deltaY: number): void;
    /**
     * Applies pending motion to the camera.
     * `damped: false` snaps — REQUIRED for the golden harness, see the header.
     */
    update(damped?: boolean): void;
    /** Puts the camera back at the authored framing. */
    reset(): void;
    /** True when nothing is still easing — the harness waits on this. */
    settled(): boolean;
}
export declare function createOrbitControls(camera: PerspectiveCamera, options?: OrbitControlsOptions): OrbitControls;
