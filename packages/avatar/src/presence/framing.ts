/**
 * The shot: how far back the camera stands to hold all of her.
 *
 * Fitted rather than authored, because the stage inherited the web scene's hero
 * camera (her face at arm's length) and it cropped her at the collarbone.
 * SOT: packages/app/features/tutor/tutor-avatar-3d.native.tsx
 * SOT-KEYWORDS: camera framing fit height aspect invariant full body natalie pane
 */
import * as THREE from 'three';

/** Fraction of the view height her tightest feature fills. */
export const TARGET_FILL = 1;

/**
 * Frames the full height of `body` and points `camera` at it.
 *
 * Height only, ignoring `aspect`: her pane changes width when a neighbouring
 * one opens, never height, so a height fit is a fit that does not resize her.
 * (A contain fit also budgets for arms that are not on screen — `Box3` measures
 * a skinned mesh at its BIND pose, an A-pose with the hands out at x ±0.52,
 * while the scene poses her arms down at ±0.16.)
 */
export function frameBody(camera: THREE.PerspectiveCamera, body: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(body);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const vFov = (camera.fov * Math.PI) / 180;
  // Solved at the near face, where her toes are: they are the front of the box
  // as well as the bottom of it, and project past the edge without this.
  const distance = size.y / 2 / (Math.tan(vFov / 2) * TARGET_FILL) + size.z / 2;

  camera.position.set(center.x, center.y, center.z + distance);
  // Derived, so a reframe cannot leave a stale plane behind — the authored
  // `far` was 10, fine at 1.15m and a body cut in half at any real distance.
  camera.near = Math.max(0.01, distance / 100);
  camera.far = distance * 10;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}
