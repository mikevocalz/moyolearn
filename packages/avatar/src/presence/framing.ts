/**
 * The shot: how far back the camera has to stand to hold all of her.
 *
 * WHY THIS IS A FUNCTION AND NOT THREE NUMBERS. The native stage carried the
 * web scene's authored camera — `(0, 1.45, 1.15)` looking at `(0, 1.5, 0)`,
 * her face at arm's length. That is the right hero shot for a marketing page
 * and the wrong one for a tutor pane: it crops her at the collarbone, so an
 * alcove a learner is meant to see her STAND in showed a floating head. The
 * body was never the problem — its own bounds are x ±0.62, y 0..1.65, and the
 * skin carries every joint down to the toes.
 *
 * A fitted shot is one rule for three viewports that are all real: the tall
 * column of the pane composition, the short wide band of the single-spine
 * card, and whatever the surface becomes mid-fold. Hand-tuned numbers for each
 * of those drift apart the first time one of them changes.
 *
 * CONTAIN, NOT COVER, and that is a decision rather than a default: in a tall
 * narrow pane containing leaves air above and below her, where filling the
 * width would take her hands off at the wrist. Air is the cheaper mistake.
 *
 * No renderer and no scene graph beyond the object's own bounds, so it is
 * tested in Node beside the presence writer that shares its body.
 * SOT: packages/app/features/tutor/tutor-avatar-3d.native.tsx
 * SOT-KEYWORDS: camera framing fit bounding box contain aspect full body natalie pane
 */
import * as THREE from 'three';

/**
 * Air around her, as a multiple of the fitted distance. Not 1 — a body flush
 * against all four edges reads as a mistake even when it is exactly right.
 */
export const FRAMING_MARGIN = 1.06;

/**
 * Moves `camera` back along +Z from the centre of `body`'s bounds until the
 * whole of it is in frame at the camera's CURRENT `aspect`, and points it
 * there. Near and far are derived from the same distance so neither can be
 * left behind by a change to the other — the stage's old `far` of 10 was fine
 * at 1.15m and would have clipped a body in half the day the fit asked for
 * more.
 *
 * Call it again on any surface resize: `aspect` is an input, not a constant.
 */
export function frameBody(camera: THREE.PerspectiveCamera, body: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(body);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  // three's `fov` is VERTICAL; the horizontal one falls out of the aspect, and
  // in a portrait pane it is the tighter of the two. Fitting only the height
  // there is exactly what would clip her arms.
  const vFov = (camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const distance =
    Math.max(size.y / 2 / Math.tan(vFov / 2), size.x / 2 / Math.tan(hFov / 2)) * FRAMING_MARGIN +
    // Half the depth, because the fit above is for the plane through the
    // centre and her nose is in front of it.
    size.z / 2;

  camera.position.set(center.x, center.y, center.z + distance);
  camera.near = Math.max(0.01, distance / 100);
  camera.far = distance * 10;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}
