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
import { Spherical, Vector3 } from 'three';
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
export const DEFAULT_ORBIT_LIMITS: OrbitLimits = Object.freeze({
  minDistance: 0.25,
  maxDistance: 2.5,
  minPolarAngle: 0.55,
  maxPolarAngle: 2.1,
  minAzimuthAngle: -Math.PI * 0.75,
  maxAzimuthAngle: Math.PI * 0.75,
});

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

const clamp = (value: number, low: number, high: number) =>
  value < low ? low : value > high ? high : value;

export function createOrbitControls(
  camera: PerspectiveCamera,
  options: OrbitControlsOptions = {}
): OrbitControls {
  const limits: OrbitLimits = { ...DEFAULT_ORBIT_LIMITS, ...options.limits };
  const rotateSpeed = options.rotateSpeed ?? 1;
  const panSpeed = options.panSpeed ?? 1;
  const dampingFactor = options.dampingFactor ?? 0.12;

  const target = options.target?.clone() ?? new Vector3(0, 1.5, 0);
  const home = target.clone();
  const homePosition = camera.position.clone();

  const spherical = new Spherical();
  const offset = new Vector3().copy(camera.position).sub(target);
  spherical.setFromVector3(offset);

  // Pending deltas, drained by update(). Accumulating rather than applying
  // immediately means several gestures in one frame compose correctly.
  let pendingTheta = 0;
  let pendingPhi = 0;
  let pendingScale = 1;
  const pendingPan = new Vector3();

  const panX = new Vector3();
  const panY = new Vector3();

  return {
    target,
    limits,

    orbit(deltaAzimuth, deltaPolar) {
      pendingTheta -= deltaAzimuth * rotateSpeed;
      pendingPhi -= deltaPolar * rotateSpeed;
    },

    dolly(scale) {
      // Guard against a zero or negative scale from a bad pinch: it would put
      // the radius at 0 or behind the target and the view would invert.
      pendingScale *= scale > 0 ? scale : 1;
    },

    pan(deltaX, deltaY) {
      panX.setFromMatrixColumn(camera.matrix, 0);
      panY.setFromMatrixColumn(camera.matrix, 1);
      pendingPan.addScaledVector(panX, -deltaX * panSpeed);
      pendingPan.addScaledVector(panY, deltaY * panSpeed);
    },

    update(damped = true) {
      const factor = damped ? dampingFactor : 1;

      spherical.theta += pendingTheta * factor;
      spherical.phi += pendingPhi * factor;
      spherical.radius *= 1 + (pendingScale - 1) * factor;
      target.addScaledVector(pendingPan, factor);

      spherical.theta = clamp(spherical.theta, limits.minAzimuthAngle, limits.maxAzimuthAngle);
      spherical.phi = clamp(spherical.phi, limits.minPolarAngle, limits.maxPolarAngle);
      spherical.radius = clamp(spherical.radius, limits.minDistance, limits.maxDistance);
      spherical.makeSafe();

      offset.setFromSpherical(spherical);
      camera.position.copy(target).add(offset);
      camera.lookAt(target);
      camera.updateMatrixWorld();

      if (damped) {
        pendingTheta *= 1 - factor;
        pendingPhi *= 1 - factor;
        pendingScale = 1 + (pendingScale - 1) * (1 - factor);
        pendingPan.multiplyScalar(1 - factor);
        // Snap the tail to zero rather than easing forever: an epsilon-sized
        // residual is what makes `settled()` never return true, and the golden
        // harness would then hang instead of failing.
        if (Math.abs(pendingTheta) < 1e-6) pendingTheta = 0;
        if (Math.abs(pendingPhi) < 1e-6) pendingPhi = 0;
        if (Math.abs(pendingScale - 1) < 1e-6) pendingScale = 1;
        if (pendingPan.lengthSq() < 1e-12) pendingPan.set(0, 0, 0);
      } else {
        pendingTheta = 0;
        pendingPhi = 0;
        pendingScale = 1;
        pendingPan.set(0, 0, 0);
      }
    },

    reset() {
      target.copy(home);
      camera.position.copy(homePosition);
      spherical.setFromVector3(offset.copy(homePosition).sub(home));
      pendingTheta = 0;
      pendingPhi = 0;
      pendingScale = 1;
      pendingPan.set(0, 0, 0);
      camera.lookAt(target);
      camera.updateMatrixWorld();
    },

    settled() {
      return (
        pendingTheta === 0 &&
        pendingPhi === 0 &&
        pendingScale === 1 &&
        pendingPan.lengthSq() === 0
      );
    },
  };
}
