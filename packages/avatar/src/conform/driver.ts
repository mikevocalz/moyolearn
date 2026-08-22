/**
 * The conform driver: the per-frame numeric half of the head/body seam.
 *
 * Reproduces three's linear blend skinning on the CPU for 386 baked anchors
 * (each skinned twice — once at the surface, once at a 1 cm normal probe),
 * resolves 2,092 barycentric attachments from body world into live head-group
 * local, and feathers the streamed GNM positions and normals onto the result.
 * This runs on every dirty frame, over typed arrays, and is the reason the neck
 * does not staircase when the head turns.
 *
 * THIS FILE IS ITS OWN TypeScript PROJECT (`./tsconfig.json`), for the same
 * reason `src/gnm/model.ts` is and under the same admission rule — see
 * ../../README.md. It was SPLIT OUT of `skirt-conform.ts` rather than exempting
 * that whole file: the parser and the rig validation kept only 3 index errors
 * between them and are worth checking strictly, while the driver had 82 and is
 * pure arithmetic over dimensions the parser already validated. Exempting the
 * file would have taken the parser's byte-length and weight-sum checks — the
 * ones most likely to catch a real bug — out of the flag's reach.
 *
 * Ported verbatim from the gnm-avatar reference renderer.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2
 * SOT-KEYWORDS: skirt conform driver seam lbs anchors barycentric pins feather normals kernel
 */

import * as THREE from 'three';
import type { SkirtConformData } from './types.ts';

const NORMAL_PROBE_M = 0.01;

export interface SkirtConformDriver {
  /** Skins all canonical anchors and pins the streamed GNM positions. */
  pinPositions: (positions: Float32Array) => void;
  /** Blends freshly computed GNM normals toward the live body normals. */
  blendNormals: (normals: Float32Array) => void;
  /** Live world-space target access for deterministic seam validation. */
  getTargetWorld: (pin: number, out: THREE.Vector3) => THREE.Vector3;
  getTargetNormalWorld: (pin: number, out: THREE.Vector3) => THREE.Vector3;
}

/**
 * Reproduces Three's LBS for copied full-body vertices, then resolves each
 * barycentric surface attachment through body world into live head-group local.
 */
export function createSkirtConformDriver(
  data: SkirtConformData,
  bodyRoot: THREE.Object3D,
  mesh: THREE.SkinnedMesh,
  headGroup: THREE.Object3D
): SkirtConformDriver {
  const boneCount = mesh.skeleton.bones.length;
  for (let influence = 0; influence < data.anchorJoint.length; influence += 1) {
    if (data.anchorJoint[influence] >= boneCount) {
      throw new Error(
        `skirt-conform joint ${data.anchorJoint[influence]} >= ${boneCount}`
      );
    }
  }

  const anchorWorld = new Float32Array(data.anchorCount * 3);
  const anchorNormalWorld = new Float32Array(data.anchorCount * 3);
  const targetWorld = new Float32Array(data.pinCount * 3);
  const targetNormalWorld = new Float32Array(data.pinCount * 3);
  const targetLocal = new Float32Array(data.pinCount * 3);
  const targetNormalLocal = new Float32Array(data.pinCount * 3);
  const headInverse = new THREE.Matrix4();
  const postSkin = new THREE.Matrix4();

  const transformPoint = (
    matrix: ArrayLike<number>,
    x: number,
    y: number,
    z: number
  ): [number, number, number] => {
    const denominator =
      matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
    const w = denominator === 0 ? 1 : 1 / denominator;
    return [
      (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) * w,
      (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) * w,
      (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) * w,
    ];
  };

  const skinAnchorPoint = (
    anchor: number,
    normalScale: number
  ): [number, number, number] => {
    const po = anchor * 3;
    let x = data.anchorPosition[po];
    let y = data.anchorPosition[po + 1];
    let z = data.anchorPosition[po + 2];
    if (normalScale !== 0) {
      x += data.anchorNormal[po] * normalScale;
      y += data.anchorNormal[po + 1] * normalScale;
      z += data.anchorNormal[po + 2] * normalScale;
    }
    const bindPoint = transformPoint(mesh.bindMatrix.elements, x, y, z);
    let sx = 0;
    let sy = 0;
    let sz = 0;
    const boneMatrices = mesh.skeleton.boneMatrices;
    if (!boneMatrices) {
      throw new Error('skirt-conform: skeleton bone matrices are not computed');
    }
    for (let influence = 0; influence < 4; influence += 1) {
      const io = anchor * 4 + influence;
      const weight = data.anchorWeight[io];
      if (weight === 0) continue;
      const matrixOffset = data.anchorJoint[io] * 16;
      const px =
        boneMatrices[matrixOffset] * bindPoint[0] +
        boneMatrices[matrixOffset + 4] * bindPoint[1] +
        boneMatrices[matrixOffset + 8] * bindPoint[2] +
        boneMatrices[matrixOffset + 12];
      const py =
        boneMatrices[matrixOffset + 1] * bindPoint[0] +
        boneMatrices[matrixOffset + 5] * bindPoint[1] +
        boneMatrices[matrixOffset + 9] * bindPoint[2] +
        boneMatrices[matrixOffset + 13];
      const pz =
        boneMatrices[matrixOffset + 2] * bindPoint[0] +
        boneMatrices[matrixOffset + 6] * bindPoint[1] +
        boneMatrices[matrixOffset + 10] * bindPoint[2] +
        boneMatrices[matrixOffset + 14];
      sx += px * weight;
      sy += py * weight;
      sz += pz * weight;
    }
    return transformPoint(postSkin.elements, sx, sy, sz);
  };

  const updateTargets = (): void => {
    // Bone matrices must be current before CPU skinning; otherwise the seam
    // trails the rendered body by one frame during gestures.
    bodyRoot.updateMatrixWorld(true);
    mesh.skeleton.update();
    headGroup.updateWorldMatrix(true, false);
    headInverse.copy(headGroup.matrixWorld).invert();
    postSkin.multiplyMatrices(mesh.matrixWorld, mesh.bindMatrixInverse);

    for (let anchor = 0; anchor < data.anchorCount; anchor += 1) {
      const base = skinAnchorPoint(anchor, 0);
      const tip = skinAnchorPoint(anchor, NORMAL_PROBE_M);
      const o = anchor * 3;
      anchorWorld[o] = base[0];
      anchorWorld[o + 1] = base[1];
      anchorWorld[o + 2] = base[2];
      const nx = tip[0] - base[0];
      const ny = tip[1] - base[1];
      const nz = tip[2] - base[2];
      const length = Math.hypot(nx, ny, nz) || 1;
      anchorNormalWorld[o] = nx / length;
      anchorNormalWorld[o + 1] = ny / length;
      anchorNormalWorld[o + 2] = nz / length;
    }

    const inverse = headInverse.elements;
    for (let pin = 0; pin < data.pinCount; pin += 1) {
      let qx = 0;
      let qy = 0;
      let qz = 0;
      let nx = 0;
      let ny = 0;
      let nz = 0;
      for (let corner = 0; corner < 3; corner += 1) {
        const recordOffset = pin * 3 + corner;
        const anchor = data.pinAnchor[recordOffset];
        const ao = anchor * 3;
        const bary = data.barycentric[recordOffset];
        qx += anchorWorld[ao] * bary;
        qy += anchorWorld[ao + 1] * bary;
        qz += anchorWorld[ao + 2] * bary;
        nx += anchorNormalWorld[ao] * bary;
        ny += anchorNormalWorld[ao + 1] * bary;
        nz += anchorNormalWorld[ao + 2] * bary;
      }
      let length = Math.hypot(nx, ny, nz) || 1;
      nx /= length;
      ny /= length;
      nz /= length;
      const surfaceOffset = data.normalOffset[pin];
      qx += nx * surfaceOffset;
      qy += ny * surfaceOffset;
      qz += nz * surfaceOffset;
      const po = pin * 3;
      targetWorld[po] = qx;
      targetWorld[po + 1] = qy;
      targetWorld[po + 2] = qz;
      targetNormalWorld[po] = nx;
      targetNormalWorld[po + 1] = ny;
      targetNormalWorld[po + 2] = nz;
      const local = transformPoint(inverse, qx, qy, qz);
      targetLocal[po] = local[0];
      targetLocal[po + 1] = local[1];
      targetLocal[po + 2] = local[2];
      const lnx = inverse[0] * nx + inverse[4] * ny + inverse[8] * nz;
      const lny = inverse[1] * nx + inverse[5] * ny + inverse[9] * nz;
      const lnz = inverse[2] * nx + inverse[6] * ny + inverse[10] * nz;
      length = Math.hypot(lnx, lny, lnz) || 1;
      targetNormalLocal[po] = lnx / length;
      targetNormalLocal[po + 1] = lny / length;
      targetNormalLocal[po + 2] = lnz / length;
    }
  };

  return {
    pinPositions: (positions: Float32Array): void => {
      updateTargets();
      for (let pin = 0; pin < data.pinCount; pin += 1) {
        const vertexOffset = data.vertexIndex[pin] * 3;
        if (vertexOffset + 2 >= positions.length) {
          throw new Error(
            `skirt-conform vertex ${data.vertexIndex[pin]} is outside GNM positions`
          );
        }
        const po = pin * 3;
        const feather = data.feather[pin];
        positions[vertexOffset] +=
          (targetLocal[po] - positions[vertexOffset]) * feather;
        positions[vertexOffset + 1] +=
          (targetLocal[po + 1] - positions[vertexOffset + 1]) * feather;
        positions[vertexOffset + 2] +=
          (targetLocal[po + 2] - positions[vertexOffset + 2]) * feather;
      }
    },
    blendNormals: (normals: Float32Array): void => {
      for (let pin = 0; pin < data.pinCount; pin += 1) {
        const vertexOffset = data.vertexIndex[pin] * 3;
        if (vertexOffset + 2 >= normals.length) {
          throw new Error(
            `skirt-conform vertex ${data.vertexIndex[pin]} is outside GNM normals`
          );
        }
        const po = pin * 3;
        const feather = data.feather[pin];
        let nx =
          normals[vertexOffset] * (1 - feather) +
          targetNormalLocal[po] * feather;
        let ny =
          normals[vertexOffset + 1] * (1 - feather) +
          targetNormalLocal[po + 1] * feather;
        let nz =
          normals[vertexOffset + 2] * (1 - feather) +
          targetNormalLocal[po + 2] * feather;
        const length = Math.hypot(nx, ny, nz) || 1;
        nx /= length;
        ny /= length;
        nz /= length;
        normals[vertexOffset] = nx;
        normals[vertexOffset + 1] = ny;
        normals[vertexOffset + 2] = nz;
      }
    },
    getTargetWorld: (pin: number, out: THREE.Vector3): THREE.Vector3 => {
      if (pin < 0 || pin >= data.pinCount) throw new Error(`pin ${pin} is invalid`);
      return out.fromArray(targetWorld, pin * 3);
    },
    getTargetNormalWorld: (pin: number, out: THREE.Vector3): THREE.Vector3 => {
      if (pin < 0 || pin >= data.pinCount) throw new Error(`pin ${pin} is invalid`);
      return out.fromArray(targetNormalWorld, pin * 3);
    },
  };
}
