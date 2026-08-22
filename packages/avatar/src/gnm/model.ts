/**
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * TypeScript port of google/xrblocks, samples/avatar_lab/gnm/GNMModel.js.
 *
 * GNM (Generative aNthropometric Model) head forward function, mirroring
 * gnm/shape/gnm_common.py:
 *
 *   bind  = template + identity_basis^T id + expression_basis^T expr
 *   joints = template_joints + joint_identity_basis^T id
 *   world = LinearBlendSkinning(bind + pose_correctives, FK(joints, rotations))
 *
 * The model data is read from a 'GNMW' container produced by
 * tools/export_gnm_web.py. The large PCA bases are int8-quantized with one
 * float32 scale per component; coefficients fold the scale in at accumulation
 * time so dequantization is free.
 *
 * This file is dependency-free (typed arrays only) so it runs in Node for
 * verification as well as in the browser.
 */

/**
 * Moyo header block (repo law): the CPU evaluator for the GNM parametric head
 * — the only thing that turns identity + expression coefficients into
 * vertices. It lives in the package rather than a feature because every avatar
 * surface (phone stage, tablet, XR) evaluates the same head, and because it is
 * dependency-free typed-array code that must stay runnable in Node for the
 * golden-image and unit harnesses.
 *
 * Ported VERBATIM from the gnm-avatar reference renderer. Do not "improve" it
 * during the WebGPU port — doc 22 §4 row 14 is the only sanctioned change
 * (moving evaluation to a compute pass), and that replaces the caller, not
 * this algorithm.
 *
 * THIS FILE IS ITS OWN TypeScript PROJECT (`./tsconfig.json`). It is the one
 * place in the package where `noUncheckedIndexedAccess` is off, because the
 * inner loops index typed arrays at offsets that are in-bounds by construction
 * from dimensions `parseContainer` already validated, and asserting each of
 * the 108 of them would bury the maths. The `composite` declaration boundary
 * is what contains that exemption: everything else in the package — and every
 * consumer — sees `../../.types/gnm/model.d.ts`, fully strict. Reach this
 * module at `@acme/avatar/gnm`; it is deliberately absent from the barrel
 * (doc 20: Metro does not tree-shake).
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2, §4 row 14, §5
 * SOT-KEYWORDS: gnm head parametric pca identity expression skinning lbs rodrigues fk container gnmw kernel
 */

const MAGIC = 0x474e4d57; // 'GNMW'
const EPSILON = 1e-8;
// Full re-accumulation after this many incremental slider updates bounds
// float32 drift.
const MAX_INCREMENTAL_UPDATES = 2000;

const DTYPE_CTORS = {
  float32: Float32Array,
  int8: Int8Array,
  uint8: Uint8Array,
  uint16: Uint16Array,
  int32: Int32Array,
};

type Dtype = keyof typeof DTYPE_CTORS;

type TypedArray = InstanceType<(typeof DTYPE_CTORS)[Dtype]>;

export interface GNMMeta {
  model: string;
  gnmVersion: string;
  variant: string;
  numVertices: number;
  numJoints: number;
  identityDim: number;
  expressionDim: number;
  identityNames: string[];
  expressionNames: string[];
  jointNames: string[];
  componentNames: string[];
  materialNames: string[];
  regionNames: string[];
  bboxMin: number[];
  bboxMax: number[];
  hasPoseCorrectives: boolean;
}

export interface GNMSections {
  template: Float32Array;
  triangles: Uint16Array;
  quads: Uint16Array;
  template_joints: Float32Array;
  joint_parents: Int32Array;
  skinning_weights: Float32Array;
  joint_identity_basis: Float32Array;
  identity_basis: Int8Array;
  identity_scales: Float32Array;
  expression_basis: Int8Array;
  expression_scales: Float32Array;
  component_id: Uint8Array;
  material_id: Uint8Array;
  region_id: Uint8Array;
  landmark_indices: Uint16Array;
  landmark_weights: Float32Array;
}

interface SectionHeader {
  name: keyof GNMSections;
  dtype: Dtype;
  offset: number;
  byteLength: number;
}

interface ContainerHeader {
  meta: GNMMeta;
  sections: SectionHeader[];
}

interface Blend {
  coeffA: Float32Array;
  coeffB: Float32Array;
  sumA: Float32Array;
  sumB: Float32Array;
}

/** Parses a GNMW container buffer into {meta, sections}. */
export function parseContainer(buffer: ArrayBuffer): {
  meta: GNMMeta;
  sections: GNMSections;
} {
  const view = new DataView(buffer);
  const magic =
    (view.getUint8(0) << 24) |
    (view.getUint8(1) << 16) |
    (view.getUint8(2) << 8) |
    view.getUint8(3);
  if (magic !== MAGIC) {
    throw new Error('Not a GNMW container.');
  }
  const version = view.getUint32(4, true);
  if (version !== 1) {
    throw new Error(`Unsupported GNMW version ${version}.`);
  }
  const headerLength = view.getUint32(8, true);
  const headerText = new TextDecoder().decode(
    new Uint8Array(buffer, 12, headerLength)
  );
  const header: ContainerHeader = JSON.parse(headerText);
  const base = 12 + headerLength;
  const sections: Partial<Record<keyof GNMSections, TypedArray>> = {};
  for (const section of header.sections) {
    const Ctor = DTYPE_CTORS[section.dtype];
    sections[section.name] = new Ctor(
      buffer,
      base + section.offset,
      section.byteLength / Ctor.BYTES_PER_ELEMENT
    );
  }
  return { meta: header.meta, sections: sections as unknown as GNMSections };
}

/** Fetches a URL into an ArrayBuffer, reporting streaming progress. */
export async function fetchWithProgress(
  url: string,
  onProgress?: (fraction: number) => void
): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const total = Number(response.headers.get('Content-Length')) || 0;
  if (!response.body || !total) {
    return await response.arrayBuffer();
  }
  const reader = response.body.getReader();
  const data = new Uint8Array(total);
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (received + value.length > total) {
      // Content-Length lied (e.g. proxy); fall back to chunk list.
      const chunks = [data.subarray(0, received), value];
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        chunks.push(next.value);
      }
      const length = chunks.reduce((n, c) => n + c.length, 0);
      const out = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
      }
      return out.buffer as ArrayBuffer;
    }
    data.set(value, received);
    received += value.length;
    if (onProgress) onProgress(received / total);
  }
  return (
    data.buffer.byteLength === received
      ? data.buffer
      : data.slice(0, received).buffer
  ) as ArrayBuffer;
}

/** Rodrigues' formula matching gnm_common.axis_angle_to_rotation_matrix. */
export function axisAngleToMatrix(
  x: number,
  y: number,
  z: number,
  out: Float32Array,
  offset = 0
) {
  const normSquared = x * x + y * y + z * z;
  const angle = Math.sqrt(Math.max(normSquared, EPSILON));
  const ax = x / angle;
  const ay = y / angle;
  const az = z / angle;
  const s = Math.sin(angle);
  const c = Math.cos(angle);
  const t = 1 - c;
  out[offset + 0] = c + t * ax * ax;
  out[offset + 1] = t * ax * ay - s * az;
  out[offset + 2] = t * ax * az + s * ay;
  out[offset + 3] = t * ax * ay + s * az;
  out[offset + 4] = c + t * ay * ay;
  out[offset + 5] = t * ay * az - s * ax;
  out[offset + 6] = t * ax * az - s * ay;
  out[offset + 7] = t * ay * az + s * ax;
  out[offset + 8] = c + t * az * az;
}

export class GNMHeadModel {
  meta: GNMMeta;
  numVertices: number;
  numJoints: number;
  identityDim: number;
  expressionDim: number;

  template: Float32Array;
  triangles: Uint16Array;
  quads: Uint16Array;
  templateJoints: Float32Array;
  jointParents: Int32Array;
  skinningWeights: Float32Array;
  jointIdentityBasis: Float32Array;
  identityBasis: Int8Array;
  identityScales: Float32Array;
  expressionBasis: Int8Array;
  expressionScales: Float32Array;
  componentId: Uint8Array;
  materialId: Uint8Array;
  regionId: Uint8Array;
  landmarkIndices: Uint16Array;
  landmarkWeights: Float32Array;

  identity: Float32Array;
  expression: Float32Array;
  rotations: Float32Array;
  translation: Float32Array;
  jointsWorld: Float32Array;
  dirty: boolean;

  private _lockedJoints = new Set<number>();
  private _idSum: Float32Array;
  private _exprSum: Float32Array;
  private _incrementalUpdates: number;
  private _idBlend: Blend | null;
  private _exprBlend: Blend | null;
  private _bind: Float32Array;
  private _jointsBind: Float32Array;
  private _rotWorld: Float32Array;
  private _skinTrans: Float32Array;

  constructor(meta: GNMMeta, sections: GNMSections) {
    this.meta = meta;
    this.numVertices = meta.numVertices;
    this.numJoints = meta.numJoints;
    this.identityDim = meta.identityDim;
    this.expressionDim = meta.expressionDim;

    this.template = sections.template;
    this.triangles = sections.triangles;
    this.quads = sections.quads;
    this.templateJoints = sections.template_joints;
    this.jointParents = sections.joint_parents;
    this.skinningWeights = sections.skinning_weights;
    this.jointIdentityBasis = sections.joint_identity_basis;
    this.identityBasis = sections.identity_basis;
    this.identityScales = sections.identity_scales;
    this.expressionBasis = sections.expression_basis;
    this.expressionScales = sections.expression_scales;
    this.componentId = sections.component_id;
    this.materialId = sections.material_id;
    this.regionId = sections.region_id;
    this.landmarkIndices = sections.landmark_indices;
    this.landmarkWeights = sections.landmark_weights;

    const v3 = this.numVertices * 3;
    // Parameters.
    this.identity = new Float32Array(this.identityDim);
    this.expression = new Float32Array(this.expressionDim);
    this.rotations = new Float32Array(this.numJoints * 3);
    this.translation = new Float32Array(3);

    // Cached linear-basis sums (bind-pose displacements).
    this._idSum = new Float32Array(v3);
    this._exprSum = new Float32Array(v3);
    this._incrementalUpdates = 0;

    // Blend states (null when inactive).
    this._idBlend = null;
    this._exprBlend = null;

    // Scratch buffers for the pose pipeline.
    this._bind = new Float32Array(v3);
    this._jointsBind = new Float32Array(this.numJoints * 3);
    this._rotWorld = new Float32Array(this.numJoints * 9);
    this._skinTrans = new Float32Array(this.numJoints * 3);
    this.jointsWorld = new Float32Array(this.numJoints * 3);

    this.dirty = true;
  }

  static async load(
    url: string,
    onProgress?: (fraction: number) => void
  ): Promise<GNMHeadModel> {
    const buffer = await fetchWithProgress(url, onProgress);
    const { meta, sections } = parseContainer(buffer);
    return new GNMHeadModel(meta, sections);
  }

  // ---------------------------------------------------------------- params --

  /** Adds `factor` times basis component `index` into `sum`. */
  private _addComponent(
    sum: Float32Array,
    basis: Int8Array,
    index: number,
    factor: number
  ) {
    if (factor === 0) return;
    const offset = index * sum.length;
    for (let j = 0, n = sum.length; j < n; ++j) {
      sum[j] += basis[offset + j] * factor;
    }
  }

  private _accumulate(
    sum: Float32Array,
    basis: Int8Array,
    scales: Float32Array,
    coefficients: Float32Array
  ) {
    sum.fill(0);
    for (let i = 0; i < coefficients.length; ++i) {
      const c = coefficients[i];
      if (c !== 0) this._addComponent(sum, basis, i, c * scales[i]);
    }
  }

  private _maybeReaccumulate() {
    if (++this._incrementalUpdates < MAX_INCREMENTAL_UPDATES) return;
    this._incrementalUpdates = 0;
    this._accumulate(
      this._idSum,
      this.identityBasis,
      this.identityScales,
      this.identity
    );
    this._accumulate(
      this._exprSum,
      this.expressionBasis,
      this.expressionScales,
      this.expression
    );
  }

  setIdentityParam(index: number, value: number) {
    const delta = value - this.identity[index];
    if (delta === 0) return;
    this.identity[index] = value;
    this._addComponent(
      this._idSum,
      this.identityBasis,
      index,
      delta * this.identityScales[index]
    );
    this._maybeReaccumulate();
    this.dirty = true;
  }

  setExpressionParam(index: number, value: number) {
    const delta = value - this.expression[index];
    if (delta === 0) return;
    this.expression[index] = value;
    this._addComponent(
      this._exprSum,
      this.expressionBasis,
      index,
      delta * this.expressionScales[index]
    );
    this._maybeReaccumulate();
    this.dirty = true;
  }

  setIdentityVector(values: ArrayLike<number>) {
    this.identity.set(values);
    this._accumulate(
      this._idSum,
      this.identityBasis,
      this.identityScales,
      this.identity
    );
    this._idBlend = null;
    this.dirty = true;
  }

  setExpressionVector(values: ArrayLike<number>) {
    this.expression.set(values);
    this._accumulate(
      this._exprSum,
      this.expressionBasis,
      this.expressionScales,
      this.expression
    );
    this._exprBlend = null;
    this.dirty = true;
  }

  resetIdentity() {
    this.setIdentityVector(new Float32Array(this.identityDim));
  }

  resetExpression() {
    this.setExpressionVector(new Float32Array(this.expressionDim));
  }

  /**
   * Marks joints whose rotation is owned by another layer (§8: the BODY owns
   * neck/head — GNM's own neck/head joints stay at identity forever). Dev
   * writes to a locked joint throw.
   */
  lockJoints(indices: Iterable<number>) {
    for (const index of indices) this._lockedJoints.add(index);
  }

  setJointRotation(jointIndex: number, x: number, y: number, z: number) {
    if (
      process.env.NODE_ENV !== 'production' &&
      this._lockedJoints.has(jointIndex)
    ) {
      throw new Error(
        `GNM joint ${jointIndex} (${this.meta.jointNames[jointIndex]}) is ` +
          'body-owned (§8) — its rotation must stay identity'
      );
    }
    const o = jointIndex * 3;
    this.rotations[o] = x;
    this.rotations[o + 1] = y;
    this.rotations[o + 2] = z;
    this.dirty = true;
  }

  setTranslation(x: number, y: number, z: number) {
    this.translation[0] = x;
    this.translation[1] = y;
    this.translation[2] = z;
    this.dirty = true;
  }

  resetPose() {
    this.rotations.fill(0);
    this.translation.fill(0);
    this.dirty = true;
  }

  // ---------------------------------------------------------------- blends --
  // Blending exploits linearity: sum(lerp(a, b, t)) == lerp(sumA, sumB, t),
  // so a full-vector crossfade costs one lerp over V*3 floats per frame
  // instead of a (dim × V × 3) re-accumulation.

  private _beginBlend(
    kind: '_idBlend' | '_exprBlend',
    target: ArrayLike<number>,
    basis: Int8Array,
    scales: Float32Array,
    current: Float32Array,
    currentSum: Float32Array
  ) {
    const targetArray = Float32Array.from(target);
    const sumB = new Float32Array(currentSum.length);
    this._accumulate(sumB, basis, scales, targetArray);
    this[kind] = {
      coeffA: Float32Array.from(current),
      coeffB: targetArray,
      sumA: Float32Array.from(currentSum),
      sumB,
    };
  }

  beginIdentityBlend(target: ArrayLike<number>) {
    this._beginBlend(
      '_idBlend',
      target,
      this.identityBasis,
      this.identityScales,
      this.identity,
      this._idSum
    );
  }

  beginExpressionBlend(target: ArrayLike<number>) {
    this._beginBlend(
      '_exprBlend',
      target,
      this.expressionBasis,
      this.expressionScales,
      this.expression,
      this._exprSum
    );
  }

  private _applyBlend(
    blend: Blend,
    coefficients: Float32Array,
    sum: Float32Array,
    t: number
  ) {
    const s = 1 - t;
    const { coeffA, coeffB, sumA, sumB } = blend;
    for (let i = 0; i < coefficients.length; ++i) {
      coefficients[i] = coeffA[i] * s + coeffB[i] * t;
    }
    for (let j = 0, n = sum.length; j < n; ++j) {
      sum[j] = sumA[j] * s + sumB[j] * t;
    }
    this.dirty = true;
  }

  setIdentityBlend(t: number) {
    if (this._idBlend) {
      this._applyBlend(this._idBlend, this.identity, this._idSum, t);
    }
  }

  setExpressionBlend(t: number) {
    if (this._exprBlend) {
      this._applyBlend(this._exprBlend, this.expression, this._exprSum, t);
    }
  }

  // --------------------------------------------------------------- forward --

  private _computeJointsBind() {
    const out = this._jointsBind;
    out.set(this.templateJoints);
    const basis = this.jointIdentityBasis;
    const stride = this.numJoints * 3;
    for (let i = 0; i < this.identityDim; ++i) {
      const c = this.identity[i];
      if (c === 0) continue;
      const offset = i * stride;
      for (let k = 0; k < stride; ++k) {
        out[k] += basis[offset + k] * c;
      }
    }
  }

  /**
   * Forward kinematics matching gnm_common.joint_transforms_world, followed
   * by the skinning-transform construction from linear_blend_skinning:
   * per joint, rotation R_world and translation t_world − R_world·j_bind.
   */
  private _computeJointTransforms() {
    const J = this.numJoints;
    const joints = this._jointsBind;
    const parents = this.jointParents;
    const rotWorld = this._rotWorld;
    const localRot = new Float32Array(9);
    const worldTrans = this.jointsWorld;

    for (let j = 0; j < J; ++j) {
      axisAngleToMatrix(
        this.rotations[j * 3],
        this.rotations[j * 3 + 1],
        this.rotations[j * 3 + 2],
        localRot,
        0
      );
      let lx, ly, lz;
      if (j === 0) {
        lx = joints[0] + this.translation[0];
        ly = joints[1] + this.translation[1];
        lz = joints[2] + this.translation[2];
        rotWorld.set(localRot, 0);
        worldTrans[0] = lx;
        worldTrans[1] = ly;
        worldTrans[2] = lz;
      } else {
        const p = parents[j];
        lx = joints[j * 3] - joints[p * 3];
        ly = joints[j * 3 + 1] - joints[p * 3 + 1];
        lz = joints[j * 3 + 2] - joints[p * 3 + 2];
        const po = p * 9;
        const jo = j * 9;
        // rotWorld[j] = rotWorld[p] * localRot
        for (let r = 0; r < 3; ++r) {
          for (let c = 0; c < 3; ++c) {
            rotWorld[jo + r * 3 + c] =
              rotWorld[po + r * 3] * localRot[c] +
              rotWorld[po + r * 3 + 1] * localRot[3 + c] +
              rotWorld[po + r * 3 + 2] * localRot[6 + c];
          }
        }
        // worldTrans[j] = rotWorld[p] * local + worldTrans[p]
        worldTrans[j * 3] =
          rotWorld[po] * lx +
          rotWorld[po + 1] * ly +
          rotWorld[po + 2] * lz +
          worldTrans[p * 3];
        worldTrans[j * 3 + 1] =
          rotWorld[po + 3] * lx +
          rotWorld[po + 4] * ly +
          rotWorld[po + 5] * lz +
          worldTrans[p * 3 + 1];
        worldTrans[j * 3 + 2] =
          rotWorld[po + 6] * lx +
          rotWorld[po + 7] * ly +
          rotWorld[po + 8] * lz +
          worldTrans[p * 3 + 2];
      }
    }

    // Skinning translation: t_world − R_world · j_bind.
    const skinTrans = this._skinTrans;
    for (let j = 0; j < J; ++j) {
      const jo = j * 9;
      const bx = joints[j * 3];
      const by = joints[j * 3 + 1];
      const bz = joints[j * 3 + 2];
      skinTrans[j * 3] =
        worldTrans[j * 3] -
        (rotWorld[jo] * bx + rotWorld[jo + 1] * by + rotWorld[jo + 2] * bz);
      skinTrans[j * 3 + 1] =
        worldTrans[j * 3 + 1] -
        (rotWorld[jo + 3] * bx + rotWorld[jo + 4] * by + rotWorld[jo + 5] * bz);
      skinTrans[j * 3 + 2] =
        worldTrans[j * 3 + 2] -
        (rotWorld[jo + 6] * bx + rotWorld[jo + 7] * by + rotWorld[jo + 8] * bz);
    }
  }

  /**
   * Runs the full forward pass and writes world-space vertices into `out`
   * (Float32Array of length numVertices*3). Also refreshes `jointsWorld`.
   */
  /**
   * Runs the joint FK and hands back the world rotations (row-major 3x3 per
   * joint) and the skinning translations.
   *
   * These are LIVE VIEWS of the model's internal buffers, not copies — read
   * them, do not keep them. They exist as public API because the GPU path
   * (`src/compute/head.ts`, doc 22 §4 row 14) deliberately leaves FK on the CPU
   * and uploads this result as uniforms; without an accessor the compute path
   * would have to duplicate Rodrigues, and two copies of a transform chain is
   * how a head ends up twisting the wrong way on one code path only.
   */
  prepareSkinTransforms(): { rotWorld: Float32Array; skinTrans: Float32Array } {
    this._computeJointsBind();
    this._computeJointTransforms();
    return { rotWorld: this._rotWorld, skinTrans: this._skinTrans };
  }

  computeVertices(out: Float32Array) {
    const V = this.numVertices;
    const bind = this._bind;
    const template = this.template;
    const idSum = this._idSum;
    const exprSum = this._exprSum;
    for (let j = 0, n = V * 3; j < n; ++j) {
      bind[j] = template[j] + idSum[j] + exprSum[j];
    }

    this._computeJointsBind();
    this._computeJointTransforms();

    const weights = this.skinningWeights;
    const rotWorld = this._rotWorld;
    const skinTrans = this._skinTrans;
    const J = this.numJoints;
    for (let v = 0; v < V; ++v) {
      const px = bind[v * 3];
      const py = bind[v * 3 + 1];
      const pz = bind[v * 3 + 2];
      let ox = 0;
      let oy = 0;
      let oz = 0;
      for (let j = 0; j < J; ++j) {
        const w = weights[j * V + v];
        if (w === 0) continue;
        const jo = j * 9;
        ox +=
          w *
          (rotWorld[jo] * px +
            rotWorld[jo + 1] * py +
            rotWorld[jo + 2] * pz +
            skinTrans[j * 3]);
        oy +=
          w *
          (rotWorld[jo + 3] * px +
            rotWorld[jo + 4] * py +
            rotWorld[jo + 5] * pz +
            skinTrans[j * 3 + 1]);
        oz +=
          w *
          (rotWorld[jo + 6] * px +
            rotWorld[jo + 7] * py +
            rotWorld[jo + 8] * pz +
            skinTrans[j * 3 + 2]);
      }
      out[v * 3] = ox;
      out[v * 3 + 1] = oy;
      out[v * 3 + 2] = oz;
    }
    this.dirty = false;
  }

  /** Barycentric landmark extraction (68 × 3 vertices/weights). */
  computeLandmarks(vertices: Float32Array, out: Float32Array) {
    const indices = this.landmarkIndices;
    const weights = this.landmarkWeights;
    const count = indices.length / 3;
    for (let l = 0; l < count; ++l) {
      let x = 0;
      let y = 0;
      let z = 0;
      for (let k = 0; k < 3; ++k) {
        const vi = indices[l * 3 + k] * 3;
        const w = weights[l * 3 + k];
        x += vertices[vi] * w;
        y += vertices[vi + 1] * w;
        z += vertices[vi + 2] * w;
      }
      out[l * 3] = x;
      out[l * 3 + 1] = y;
      out[l * 3 + 2] = z;
    }
    return count;
  }

  /** World-space rotation frame (row-major 3x3) of a joint after FK. */
  getJointWorldRotation(jointIndex: number) {
    return this._rotWorld.subarray(jointIndex * 9, jointIndex * 9 + 9);
  }
}
