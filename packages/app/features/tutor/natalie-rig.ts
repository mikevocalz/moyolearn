/**
 * The lens and the light, shared by both of Natalie's 3D stages.
 *
 * Extracted verbatim from `tutor-avatar-3d.native.tsx` when the web stage
 * landed, and extracted rather than copied for one reason: the two surfaces
 * differ in how they get a canvas, not in how she is lit. A rig that drifted
 * between them would mean the same body reads as two different characters
 * depending on which device a child opened, and the drift would be invisible
 * in review — nobody diffs two lighting functions in two files.
 *
 * Deliberately NOT `createStage()` from `@acme/avatar/body` yet — that rig is
 * RectAreaLight + GTAO + bloom on `RenderPipeline`, verified so far only in
 * headless Chromium on WebGL2 (doc 22 §4 rows 8-12). Moving to it is a look
 * change with its own golden capture, not a thing to fold into first light.
 *
 * SOT: ./tutor-avatar-3d.native.tsx · ./tutor-avatar-3d.web.tsx
 *      docs/decisions/adr-111-native-3d-runtime.md
 * SOT-KEYWORDS: natalie rig lighting camera fov shared stage 3d
 */
import * as THREE from 'three/webgpu';

/** The lens. The DISTANCE is fitted — see `frameBody` in `@acme/avatar/body`. */
export const CAMERA_FOV = 38;

/**
 * Warm key, cool fill, a low warm bounce so the jaw underside stays alive, and
 * ambient that never becomes the key.
 */
export function addRig(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xfff8f2, 0x4a3b36, 1.0));
  scene.add(new THREE.AmbientLight(0xfff6ed, 0.6));
  const key = new THREE.DirectionalLight(0xfff0e0, 1.2);
  key.position.set(1.2, 2.5, 1.8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xe0f0ff, 0.5);
  fill.position.set(-1.2, 1.2, 1.5);
  scene.add(fill);
  const bounce = new THREE.DirectionalLight(0xffe8d6, 0.4);
  bounce.position.set(0, -1.0, 1.0);
  scene.add(bounce);
}
