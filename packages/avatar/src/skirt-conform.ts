/**
 * Moyo header block: the head/body seam driver. The GNM head is a separate mesh
 * from the SMPL-X body, and where they meet the head's lower boundary must be
 * pulled onto the live, skinned body surface every frame or the neck shows a
 * staircase. This reproduces three's linear blend skinning on the CPU for 386
 * baked anchors, resolves 2,092 barycentric pins into head-group-local space,
 * and feathers both positions and normals across the join.
 *
 * Ported verbatim from the gnm-avatar reference renderer, with ONE change:
 * `crypto.subtle` does not exist in Hermes, so the rig-provenance hashes go
 * through `./crypto/sha256.ts`. That also makes `validateSkirtConformRig`
 * synchronous, which it always wanted to be.
 *
 * Those hashes are not ceremony. The conform data is valid only for the exact
 * bone order and inverse-bind matrices it was baked against, and the capability
 * manager caches the conform and the body glb independently — so a mismatched
 * pair is a reachable state that renders as a subtly wrong neck rather than as
 * an error.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2
 * SOT-KEYWORDS: skirt conform parse validate scf4 binary provenance hash anchors pins
 */

import * as THREE from 'three';
// crypto.subtle does not exist in Hermes; ./crypto/sha256.ts is the port.
import { sha256Hex } from './crypto/sha256.ts';
// Types live in the conform project so its composite rootDir stays intact.
import type { SkirtConformData, SkirtConformMeta } from './conform/types.ts';

const HEADER_BYTES = 24;
const ANCHOR_BYTES = 48;
const PIN_BYTES = 36;

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} is not finite`);
  return value;
}

/** Parses the versioned skirt-conform binary and rejects stale v3 assets. */
export function parseSkirtConform(buffer: ArrayBuffer): SkirtConformData {
  if (buffer.byteLength < HEADER_BYTES) {
    throw new Error('skirt-conform header is truncated');
  }
  const view = new DataView(buffer);
  const magic = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3)
  );
  const version = view.getUint32(4, true);
  if (magic !== 'SCF4' || version !== 4) {
    throw new Error(`unsupported skirt-conform format ${magic}/${version}`);
  }
  const anchorCount = view.getUint32(8, true);
  const pinCount = view.getUint32(12, true);
  const anchorBytes = view.getUint32(16, true);
  const pinBytes = view.getUint32(20, true);
  if (anchorCount === 0 || pinCount === 0) {
    throw new Error('skirt-conform contains no anchors or pins');
  }
  if (anchorBytes !== ANCHOR_BYTES || pinBytes !== PIN_BYTES) {
    throw new Error(
      `skirt-conform record size ${anchorBytes}/${pinBytes} !== ` +
        `${ANCHOR_BYTES}/${PIN_BYTES}`
    );
  }
  const expectedBytes =
    HEADER_BYTES + anchorCount * ANCHOR_BYTES + pinCount * PIN_BYTES;
  if (buffer.byteLength !== expectedBytes) {
    throw new Error(
      `skirt-conform byte length ${buffer.byteLength} !== ${expectedBytes}`
    );
  }

  const sourceVertex = new Uint32Array(anchorCount);
  const anchorPosition = new Float32Array(anchorCount * 3);
  const anchorNormal = new Float32Array(anchorCount * 3);
  const anchorJoint = new Uint8Array(anchorCount * 4);
  const anchorWeight = new Float32Array(anchorCount * 4);
  let offset = HEADER_BYTES;
  for (let anchor = 0; anchor < anchorCount; anchor += 1) {
    sourceVertex[anchor] = view.getUint32(offset, true);
    for (let component = 0; component < 3; component += 1) {
      anchorPosition[anchor * 3 + component] = finite(
        view.getFloat32(offset + 4 + component * 4, true),
        `anchor ${anchor} position`
      );
      anchorNormal[anchor * 3 + component] = finite(
        view.getFloat32(offset + 16 + component * 4, true),
        `anchor ${anchor} normal`
      );
    }
    let weightSum = 0;
    for (let influence = 0; influence < 4; influence += 1) {
      anchorJoint[anchor * 4 + influence] = view.getUint8(
        offset + 28 + influence
      );
      const weight = finite(
        view.getFloat32(offset + 32 + influence * 4, true),
        `anchor ${anchor} weight`
      );
      if (weight < 0) throw new Error(`anchor ${anchor} has a negative weight`);
      anchorWeight[anchor * 4 + influence] = weight;
      weightSum += weight;
    }
    // Read back what was just written three lines up, so the length check
    // measures the stored float32 rather than the float64 that produced it.
    const nx = anchorNormal[anchor * 3] as number;
    const ny = anchorNormal[anchor * 3 + 1] as number;
    const nz = anchorNormal[anchor * 3 + 2] as number;
    const normalLength = Math.hypot(nx, ny, nz);
    if (Math.abs(weightSum - 1) > 1e-3) {
      throw new Error(`anchor ${anchor} weight sum ${weightSum} !== 1`);
    }
    if (Math.abs(normalLength - 1) > 1e-3) {
      throw new Error(`anchor ${anchor} normal length ${normalLength} !== 1`);
    }
    offset += ANCHOR_BYTES;
  }

  const vertexIndex = new Uint32Array(pinCount);
  const feather = new Float32Array(pinCount);
  const pinAnchor = new Uint32Array(pinCount * 3);
  const barycentric = new Float32Array(pinCount * 3);
  const normalOffset = new Float32Array(pinCount);
  for (let pin = 0; pin < pinCount; pin += 1) {
    vertexIndex[pin] = view.getUint32(offset, true);
    feather[pin] = finite(
      view.getFloat32(offset + 4, true),
      `pin ${pin} feather`
    );
    const featherValue = feather[pin] as number;
    if (featherValue < 0 || featherValue > 1.001) {
      throw new Error(`pin ${pin} feather ${featherValue} is outside [0, 1]`);
    }
    let barySum = 0;
    for (let corner = 0; corner < 3; corner += 1) {
      const anchor = view.getUint32(offset + 8 + corner * 4, true);
      if (anchor >= anchorCount) {
        throw new Error(`pin ${pin} references missing anchor ${anchor}`);
      }
      pinAnchor[pin * 3 + corner] = anchor;
      const bary = finite(
        view.getFloat32(offset + 20 + corner * 4, true),
        `pin ${pin} barycentric`
      );
      if (bary < -1e-4 || bary > 1.0001) {
        throw new Error(`pin ${pin} has invalid barycentric ${bary}`);
      }
      barycentric[pin * 3 + corner] = bary;
      barySum += bary;
    }
    if (Math.abs(barySum - 1) > 1e-3) {
      throw new Error(`pin ${pin} barycentric sum ${barySum} !== 1`);
    }
    normalOffset[pin] = finite(
      view.getFloat32(offset + 32, true),
      `pin ${pin} normal offset`
    );
    offset += PIN_BYTES;
  }

  return {
    anchorCount,
    pinCount,
    sourceVertex,
    anchorPosition,
    anchorNormal,
    anchorJoint,
    anchorWeight,
    vertexIndex,
    feather,
    pinAnchor,
    barycentric,
    normalOffset,
  };
}

/** Ensures the copied full-body anchors match the loaded headless rig. */
export function validateSkirtConformRig(
  meta: SkirtConformMeta,
  mesh: THREE.SkinnedMesh,
  orderedBoneNames: readonly string[]
): void {
  if (meta.formatVersion !== 4) {
    throw new Error(`skirt-conform metadata version ${meta.formatVersion} !== 4`);
  }
  const boneHash = sha256Hex(
    new TextEncoder().encode(orderedBoneNames.join('\0'))
  );
  if (boneHash !== meta.boneNamesSha256) {
    throw new Error('skirt-conform bone-name hash does not match the body rig');
  }
  const inverseBytes = new Uint8Array(mesh.skeleton.boneInverses.length * 64);
  const inverseView = new DataView(inverseBytes.buffer);
  let byteOffset = 0;
  for (const inverse of mesh.skeleton.boneInverses) {
    for (const value of inverse.elements) {
      inverseView.setFloat32(byteOffset, value, true);
      byteOffset += 4;
    }
  }
  const inverseHash = sha256Hex(inverseBytes);
  if (inverseHash !== meta.inverseBindSha256) {
    throw new Error('skirt-conform inverse-bind hash does not match the body rig');
  }
}
