/**
 * Moyo header block: loads the SMPL-X body and asserts its rig against the
 * shipped manifest. The manifest IS the contract — bone order equals glTF
 * skin.joints order equals three.js Skeleton.bones order — and every baked
 * artifact downstream (the conform, the neck align) was baked against that
 * exact order. So this file is paranoid on purpose: a name-by-name bone check
 * and a skin-weight sum check at load, because both failures render as a
 * plausible-looking body rather than as an error.
 *
 * `frustumCulled = false` is load-bearing, not tidying: three culls a
 * SkinnedMesh against its BIND-pose bounding box, so a posed body vanishes at
 * the edge of frame. The RN WebGPU examples hit this and do the same thing.
 *
 * Ported from the gnm-avatar reference renderer; the only change is that the
 * asset URLs are required parameters rather than same-origin defaults.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2, §4 row 17
 * SOT-KEYWORDS: smplx body gltf skinned mesh manifest bones skeleton rig contract frustum
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// SMPL-X body, exported by tools/export_body.py from the official MPI Blender
// add-on rig. The manifest is the contract: bone order = glTF skin.joints
// order = three.js Skeleton.bones order.
//
// Axis convention (verified against the actual rig, not docs): every bone in
// the add-on's armature shares one rest orientation whose local frame equals
// the SMPL-X model frame after the exporter's Y-up conversion. So SMPL-X
// axis-angle ("Rodrigues") pose params apply directly as each bone's local
// basis rotation: local = rest * poseQuat — exactly how the add-on itself
// applies theta in Blender.

export interface BodyManifest {
  space: string;
  source: string;
  units: string;
  bones: string[];
  parents: Record<string, string | null>;
  heads: Record<string, [number, number, number]>;
}

export interface Body {
  root: THREE.Group;
  mesh: THREE.SkinnedMesh;
  manifest: BodyManifest;
  /** axisAngle: Float32Array of manifest.bones.length * 3, manifest order. */
  setPose: (axisAngle: Float32Array) => void;
}

function assertBoneNames(bones: THREE.Bone[], manifest: BodyManifest): void {
  const diffs: string[] = [];
  if (bones.length !== manifest.bones.length) {
    diffs.push(`bone count: skeleton ${bones.length} vs manifest ${manifest.bones.length}`);
  }
  const n = Math.max(bones.length, manifest.bones.length);
  for (let i = 0; i < n; i++) {
    const actual = bones[i]?.name ?? '<missing>';
    const expected = manifest.bones[i] ?? '<missing>';
    if (actual !== expected) diffs.push(`[${i}] skeleton "${actual}" vs manifest "${expected}"`);
  }
  if (diffs.length > 0) {
    throw new Error(`skeleton/manifest mismatch:\n${diffs.join('\n')}`);
  }
}

function assertSkinWeights(geometry: THREE.BufferGeometry): void {
  const weights = geometry.getAttribute('skinWeight');
  const joints = geometry.getAttribute('skinIndex');
  if (!weights || !joints) throw new Error('missing skinWeight/skinIndex attributes');
  for (let i = 0; i < weights.count; i++) {
    const sum = weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i);
    if (Math.abs(sum - 1) > 1e-3) {
      throw new Error(`vertex ${i}: skin weight sum ${sum} not within 1e-3 of 1`);
    }
  }
}

/**
 * URLs are REQUIRED, deliberately. The reference defaulted them to `/body/...`,
 * a same-origin web assumption. Here every avatar artifact comes from the CDN
 * through the capability manager (doc 22 §3), so the caller resolves them and
 * this module never guesses.
 */
export async function loadBody(
  glbUrl: string,
  manifestUrl: string
): Promise<Body> {
  const [gltf, manifest] = await Promise.all([
    new GLTFLoader().loadAsync(glbUrl),
    fetch(manifestUrl).then((response) => {
      if (!response.ok) throw new Error(`manifest fetch failed: ${response.status}`);
      return response.json() as Promise<BodyManifest>;
    }),
  ]);

  if (manifest.space !== 'gltf-y-up') {
    throw new Error(`manifest space "${manifest.space}" !== "gltf-y-up"`);
  }

  let found: THREE.SkinnedMesh | null = null;
  gltf.scene.traverse((object) => {
    if (!found && (object as THREE.SkinnedMesh).isSkinnedMesh) {
      found = object as THREE.SkinnedMesh;
    }
  });
  if (!found) throw new Error('no SkinnedMesh in glb');
  const mesh = found as THREE.SkinnedMesh;
  mesh.frustumCulled = false;

  const bones = mesh.skeleton.bones;
  assertBoneNames(bones, manifest);
  assertSkinWeights(mesh.geometry);

  const rest = bones.map((bone) => bone.quaternion.clone());
  const axis = new THREE.Vector3();
  const pose = new THREE.Quaternion();

  const setPose = (axisAngle: Float32Array): void => {
    if (axisAngle.length !== bones.length * 3) {
      throw new Error(`pose length ${axisAngle.length} !== ${bones.length * 3}`);
    }
    // Zipped over the two lockstep arrays: `rest` is built from `bones`, so
    // pairing them here is what makes the per-bone reads total. The length of
    // `axisAngle` was already checked against `bones.length * 3` above, so the
    // triple read is in range by that check, not by assumption.
    for (const [i, bone] of bones.entries()) {
      const restQuat = rest[i];
      if (!restQuat) continue;
      axis.set(
        axisAngle[3 * i] as number,
        axisAngle[3 * i + 1] as number,
        axisAngle[3 * i + 2] as number
      );
      const angle = axis.length();
      if (angle < 1e-6) pose.identity();
      else pose.setFromAxisAngle(axis.multiplyScalar(1 / angle), angle);
      bone.quaternion.copy(restQuat).multiply(pose);
    }
  };

  return { root: gltf.scene, mesh, manifest, setPose };
}
