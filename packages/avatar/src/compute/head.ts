/**
 * The GNM head on the GPU — doc 22 §4 row 14, the highest-risk row in the table.
 *
 * WHAT THIS REPLACES. `GNMHeadModel.computeVertices()` runs, per dirty frame,
 * over 17,821 vertices: rebuild the bind pose from the template plus the linear
 * expression basis, then linear-blend-skin it through the joint transforms.
 * That is fine on a desktop and it is the single largest CPU cost on the phone
 * tier, which is why it is the one kernel worth moving.
 *
 * WHAT STAYS ON THE CPU, DELIBERATELY. The joint FK — Rodrigues on ~17 joints —
 * does NOT move. It is 17 iterations of nine multiplies; a compute dispatch to
 * do that would cost more in submission than it saves, and keeping it on the
 * CPU means `jointsWorld` stays readable for the eye-gaze and neck-align code
 * that needs it *this* frame. So the GPU gets the finished world rotations and
 * translations as uniforms and does only the per-vertex work, which is the part
 * that is 17,821 times bigger.
 *
 * ── THE RISK, AND WHY THE REBAKE MOSTLY RETIRED IT ──────────────────────────
 *
 * §4 row 14 flagged `maxStorageBuffersPerShaderStage`, which **defaults to 8**
 * in WebGPU, and counted roughly seven buffers for the pre-rebake container
 * (position, skinIndex, skinWeight, output, expression basis, identity basis,
 * weights). Seven of eight is not a margin, it is a coin flip on the fleet.
 *
 * The runtime rebake (§6.3) changed that arithmetic and this file is where the
 * benefit lands:
 *   - the identity basis is FOLDED INTO THE TEMPLATE, so `identityDim` is 0 and
 *     that buffer does not exist at runtime at all;
 *   - the ARKit matrix is precomposed into the expression basis, so the
 *     expression basis is 19 components rather than 383.
 * The kernel below therefore binds **four** storage buffers — template,
 * expression basis, skinning weights, output — with the joint transforms and
 * the 19 coefficients riding in uniform buffers, which do not count against the
 * storage limit. Four of eight is a real margin.
 *
 * `headComputeRequirement()` computes the demand and `canUseComputeHead()`
 * checks it against the adapter's ACTUAL limits rather than the spec defaults,
 * because that check is the whole safety story: if it fails, the tier system
 * falls back to the CPU path, which is proven and dependency-free.
 *
 * ── TWO LAYOUT DECISIONS THAT ARE NOT ARBITRARY ─────────────────────────────
 *
 * 1. The expression basis is REPACKED VERTEX-MAJOR and pre-dequantised. On the
 *    CPU the basis is component-major int8 (`basis[k * V*3 + j]`), which is
 *    right for the CPU's loop order — walk one component, touch every vertex.
 *    The GPU's loop order is the transpose: lane `v` walks all 19 components of
 *    ITS vertex. Component-major would make every lane in a warp read addresses
 *    19 * V floats apart — the worst possible access pattern. Vertex-major puts
 *    adjacent lanes on adjacent addresses. The dequantisation to float32 is
 *    free to do at the same time: WGSL has no 8-bit scalar type, so an int8
 *    basis would have to be packed 4-to-a-u32 and unpacked in the shader, and
 *    post-rebake the float32 form is ~5 MB — not worth a bit-twiddling kernel.
 *
 * 2. The skinning weights STAY joint-major (`weights[j * V + v]`). That looks
 *    like the same mistake, but it is not: lane `v` reads `j*V + v` for a fixed
 *    `j`, so adjacent lanes are again adjacent in memory. Joint-major is
 *    already the coalesced layout for this loop. Repacking it would make things
 *    worse, which is the sort of thing that only shows up in a profile.
 *
 * The dense weight loop runs `numJoints` iterations with no early-out, unlike
 * the CPU's `if (w === 0) continue`. That is on purpose — a branch that diverges
 * per lane costs more than the multiply it skips. Compacting to four influences
 * per vertex would cut it further, and is left as a MEASURED follow-up rather
 * than an assumed win: it would trade one buffer for two and it is only exact
 * if no vertex has a fifth non-zero weight, which is a property of the asset
 * and not of the format.
 *
 * WHAT THIS FILE CANNOT PROVE WITHOUT A GPU: that the numbers match. The graph
 * constructs, the limits arithmetic is unit-tested, and `evaluateOnCpu()` below
 * is a line-for-line mirror of the kernel that the tests diff against the real
 * `GNMHeadModel` — so the ALGORITHM is verified even though the WGSL is not.
 * Parity on device is §10.5's job.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §4 row 14, §6.3
 * SOT-KEYWORDS: compute gpgpu storage buffer head gnm skinning limits webgpu tsl coalescing rebake
 */
import { StorageBufferAttribute } from 'three/webgpu';
import type { Renderer } from 'three/webgpu';
import { Fn, Loop, instanceIndex, storage, uniformArray, vec3 } from 'three/tsl';
import { Matrix3, Vector3 } from 'three';
import type ComputeNode from 'three/src/nodes/gpgpu/ComputeNode.js';

/** The slice of the model the kernel needs. Deliberately structural, so a test can supply a fixture. */
export interface HeadComputeSource {
  numVertices: number;
  numJoints: number;
  identityDim: number;
  expressionDim: number;
  /** Rest positions, `V * 3`. Post-rebake this already contains the frozen identity. */
  template: Float32Array;
  /** Component-major int8, `expressionDim * V * 3`. */
  expressionBasis: Int8Array;
  /** Per-component dequantisation scale, `expressionDim`. */
  expressionScales: Float32Array;
  /** Joint-major, `numJoints * V`. */
  skinningWeights: Float32Array;
  /** Current expression coefficients, `expressionDim`. */
  expression: Float32Array;
}

/* ------------------------------------------------------------- limits ---- */

/**
 * The three adapter limits this kernel can actually run out of. Declared as an
 * interface rather than inferred from the constant below, so a caller can pass
 * the numbers a real `GPUAdapter` reported without them being narrowed to the
 * defaults' literal types.
 */
export interface AdapterLimits {
  maxStorageBuffersPerShaderStage: number;
  maxStorageBufferBindingSize: number;
  maxBufferSize: number;
}

/** WebGPU's spec defaults, for the "can we even try" arithmetic. */
export const WEBGPU_DEFAULT_LIMITS: Readonly<AdapterLimits> = Object.freeze({
  maxStorageBuffersPerShaderStage: 8,
  maxStorageBufferBindingSize: 128 * 1024 * 1024,
  maxBufferSize: 256 * 1024 * 1024,
});

export interface HeadComputeRequirement {
  storageBuffers: number;
  largestBufferBytes: number;
  totalBytes: number;
  /** Set when the container still carries an identity basis — i.e. it was not rebaked. */
  identityBasisPresent: boolean;
}

export function headComputeRequirement(source: HeadComputeSource): HeadComputeRequirement {
  const v3 = source.numVertices * 3;
  const template = v3 * 4;
  // Repacked to float32 — see decision 1 in the header.
  const basis = v3 * source.expressionDim * 4;
  const weights = source.numJoints * source.numVertices * 4;
  const output = v3 * 4;

  // If the container was NOT rebaked it carries an identity basis too, which is
  // both a fifth buffer and the largest one. Counting it here is what makes the
  // gate honest about a container that skipped `tools/bake_runtime_container.py`.
  const identityBasisPresent = source.identityDim > 0;
  const identity = identityBasisPresent ? v3 * source.identityDim * 4 : 0;

  return {
    storageBuffers: 4 + (identityBasisPresent ? 1 : 0),
    largestBufferBytes: Math.max(template, basis, weights, output, identity),
    totalBytes: template + basis + weights + output + identity,
    identityBasisPresent,
  };
}

export interface ComputeGate {
  ok: boolean;
  reason?: string;
}

/**
 * The gate. Note it takes the ADAPTER's limits, not the defaults — three.js
 * exposes them as `renderer.backend.adapter.limits`, and the phone fleet is
 * exactly where they differ. A failure here is not an error: it means the tier
 * system keeps the CPU path, which is the proven one.
 */
export function canUseComputeHead(
  requirement: HeadComputeRequirement,
  limits: AdapterLimits = WEBGPU_DEFAULT_LIMITS
): ComputeGate {
  if (requirement.storageBuffers > limits.maxStorageBuffersPerShaderStage) {
    return {
      ok: false,
      reason:
        `needs ${requirement.storageBuffers} storage buffers, adapter allows ` +
        `${limits.maxStorageBuffersPerShaderStage}` +
        (requirement.identityBasisPresent
          ? ' — this container was not rebaked; tools/bake_runtime_container.py removes one buffer'
          : ''),
    };
  }
  if (requirement.largestBufferBytes > limits.maxStorageBufferBindingSize) {
    return {
      ok: false,
      reason:
        `largest binding is ${requirement.largestBufferBytes} bytes, adapter allows ` +
        `${limits.maxStorageBufferBindingSize}`,
    };
  }
  if (requirement.totalBytes > limits.maxBufferSize) {
    return { ok: false, reason: `needs ${requirement.totalBytes} bytes total` };
  }
  return { ok: true };
}

/* -------------------------------------------------------------- pack ----- */

/**
 * Component-major int8 → vertex-major, pre-scaled float32.
 *
 * Output layout: `packed[(v * 3 + axis) * D + k]` — all `D` components of one
 * scalar sit contiguously, so the kernel's inner loop is a linear walk and
 * adjacent lanes stay adjacent. The per-component scale is folded in here so
 * the shader never multiplies by it.
 */
export function packExpressionBasis(source: HeadComputeSource): Float32Array {
  const v3 = source.numVertices * 3;
  const dim = source.expressionDim;
  const packed = new Float32Array(v3 * dim);
  for (let k = 0; k < dim; ++k) {
    const scale = source.expressionScales[k] ?? 0;
    const offset = k * v3;
    for (let j = 0; j < v3; ++j) {
      packed[j * dim + k] = (source.expressionBasis[offset + j] ?? 0) * scale;
    }
  }
  return packed;
}

/* ------------------------------------------------------------ kernel ----- */

export interface HeadCompute {
  /** Bind as a geometry attribute AND read by the kernel — the canonical shape. */
  positionAttribute: StorageBufferAttribute;
  /** Pass to `renderer.compute()` once per dirty frame. */
  kernel: ComputeNode;
  /** Push the CPU-side FK result + coefficients into the kernel's uniforms. */
  update(source: HeadComputeSource, rotWorld: Float32Array, skinTrans: Float32Array): void;
  /** The gate's verdict, kept so the tier watcher can report why it fell back. */
  gate: ComputeGate;
  requirement: HeadComputeRequirement;
  /**
   * The CPU-side backing arrays of the three uniform arrays, exposed so a test
   * can prove `update()` loaded them without transposing — and so a debug
   * overlay can show what the GPU is actually being told.
   */
  uniforms: {
    coefficients: number[];
    jointRotations: Matrix3[];
    jointTranslations: Vector3[];
  };
}

export const POSITION_STORAGE_ATTRIBUTE = 'positionStorage';

/**
 * Builds the kernel. Does NOT dispatch — the caller owns the frame loop and
 * decides when the head is dirty.
 *
 * The output is written to a `StorageBufferAttribute` that the head geometry
 * also binds as `positionStorage`, so the material reads it with
 * `attribute('positionStorage')`. That attribute assignment is the ONE place in
 * this package where `positionNode` is set WITHOUT `positionLocal.add(...)` —
 * see `materials/hair.ts` for why that is normally a bug. Here it is correct
 * precisely because the compute pass has already done the skinning, and doing
 * it again on the vertex stage would apply the transform twice.
 */
export function createHeadCompute(source: HeadComputeSource): HeadCompute {
  const requirement = headComputeRequirement(source);
  const gate = canUseComputeHead(requirement);

  const vertexCount = source.numVertices;
  const dim = source.expressionDim;
  const joints = source.numJoints;

  const positionAttribute = new StorageBufferAttribute(new Float32Array(vertexCount * 3), 3);

  const templateBuffer = storage(
    new StorageBufferAttribute(Float32Array.from(source.template), 3),
    'vec3',
    vertexCount
  ).toReadOnly();
  const basisBuffer = storage(
    new StorageBufferAttribute(packExpressionBasis(source), 1),
    'float',
    vertexCount * 3 * dim
  ).toReadOnly();
  const weightBuffer = storage(
    new StorageBufferAttribute(Float32Array.from(source.skinningWeights), 1),
    'float',
    joints * vertexCount
  ).toReadOnly();
  const outBuffer = storage(positionAttribute, 'vec3', vertexCount);

  // Uniforms, not storage — they do not count against the storage-buffer limit,
  // which is the constraint this whole file is organised around.
  // The explicit type arguments are load-bearing: `uniformArray`'s node type is
  // inferred from the string, which widens to `string` without them and takes
  // every math operator on the element with it.
  const coefficients = uniformArray<'float'>(
    Array.from({ length: Math.max(dim, 1) }, () => 0),
    'float'
  );
  const jointRotations = uniformArray<'mat3'>(
    Array.from({ length: joints }, () => new Matrix3()),
    'mat3'
  );
  const jointTranslations = uniformArray<'vec3'>(
    Array.from({ length: joints }, () => new Vector3()),
    'vec3'
  );

  const kernel = Fn(() => {
    const v = instanceIndex;
    // The dispatch is rounded up to the workgroup size, so the tail lanes must
    // not write past the end. Cheaper than an exact dispatch.
    const bind = vec3(0).toVar();

    // bind = template + Σ_k coeff[k] * basis[v][k]   (scales already folded in)
    const base = v.mul(3);
    const x = templateBuffer.element(v).x.toVar();
    const y = templateBuffer.element(v).y.toVar();
    const z = templateBuffer.element(v).z.toVar();
    // `type: 'uint'` matters — `instanceIndex` is a uint and TSL will not mix
    // the two silently, which is a small mercy.
    Loop({ start: 0, end: dim, type: 'uint' }, ({ i }) => {
      const c = coefficients.element(i);
      x.addAssign(basisBuffer.element(base.mul(dim).add(i)).mul(c));
      y.addAssign(basisBuffer.element(base.add(1).mul(dim).add(i)).mul(c));
      z.addAssign(basisBuffer.element(base.add(2).mul(dim).add(i)).mul(c));
    });
    bind.assign(vec3(x, y, z));

    // Linear blend skinning, dense over every joint — see the header on why
    // there is no `if (w == 0) continue` here.
    const skinned = vec3(0).toVar();
    Loop({ start: 0, end: joints, type: 'uint' }, ({ i }) => {
      const w = weightBuffer.element(i.mul(vertexCount).add(v));
      skinned.addAssign(
        jointRotations.element(i).mul(bind).add(jointTranslations.element(i)).mul(w)
      );
    });

    outBuffer.element(v).assign(skinned);
  })().compute(vertexCount);

  const rotationScratch = jointRotations.array as Matrix3[];
  const translationScratch = jointTranslations.array as Vector3[];
  const coefficientScratch = coefficients.array as number[];

  return {
    positionAttribute,
    kernel,
    gate,
    requirement,
    uniforms: {
      coefficients: coefficientScratch,
      jointRotations: rotationScratch,
      jointTranslations: translationScratch,
    },
    update(current, rotWorld, skinTrans) {
      for (let k = 0; k < dim; ++k) coefficientScratch[k] = current.expression[k] ?? 0;
      for (let j = 0; j < joints; ++j) {
        // `rotWorld` is row-major 3x3 per joint; `Matrix3.set` takes row-major,
        // and three transposes into column-major on upload. Feeding it
        // `fromArray` instead would silently transpose the rotation, which
        // reads as a head that twists the wrong way — a genuinely confusing bug.
        const o = j * 9;
        (rotationScratch[j] as Matrix3).set(
          rotWorld[o] ?? 0,
          rotWorld[o + 1] ?? 0,
          rotWorld[o + 2] ?? 0,
          rotWorld[o + 3] ?? 0,
          rotWorld[o + 4] ?? 0,
          rotWorld[o + 5] ?? 0,
          rotWorld[o + 6] ?? 0,
          rotWorld[o + 7] ?? 0,
          rotWorld[o + 8] ?? 0
        );
        (translationScratch[j] as Vector3).set(
          skinTrans[j * 3] ?? 0,
          skinTrans[j * 3 + 1] ?? 0,
          skinTrans[j * 3 + 2] ?? 0
        );
      }
    },
  };
}

/**
 * A line-for-line CPU mirror of the kernel above.
 *
 * This exists so the ALGORITHM can be diffed against the real
 * `GNMHeadModel.computeVertices()` in a plain unit test — including the
 * vertex-major repack, which is the single most likely place for the port to be
 * silently wrong. It is not a fallback (the fallback is the real model) and it
 * is not shipped in the frame loop; it is the thing that makes row 14 testable
 * without a GPU. If you change the kernel, change this in the same commit.
 */
export function evaluateOnCpu(
  source: HeadComputeSource,
  rotWorld: Float32Array,
  skinTrans: Float32Array,
  out: Float32Array
): Float32Array {
  const packed = packExpressionBasis(source);
  const dim = source.expressionDim;
  const vertexCount = source.numVertices;
  const joints = source.numJoints;

  for (let v = 0; v < vertexCount; ++v) {
    const bind = [0, 0, 0];
    for (let axis = 0; axis < 3; ++axis) {
      let value = source.template[v * 3 + axis] ?? 0;
      const row = (v * 3 + axis) * dim;
      for (let k = 0; k < dim; ++k) {
        value += (packed[row + k] ?? 0) * (source.expression[k] ?? 0);
      }
      bind[axis] = value;
    }

    let ox = 0;
    let oy = 0;
    let oz = 0;
    for (let j = 0; j < joints; ++j) {
      const w = source.skinningWeights[j * vertexCount + v] ?? 0;
      const o = j * 9;
      ox +=
        w *
        ((rotWorld[o] ?? 0) * (bind[0] as number) +
          (rotWorld[o + 1] ?? 0) * (bind[1] as number) +
          (rotWorld[o + 2] ?? 0) * (bind[2] as number) +
          (skinTrans[j * 3] ?? 0));
      oy +=
        w *
        ((rotWorld[o + 3] ?? 0) * (bind[0] as number) +
          (rotWorld[o + 4] ?? 0) * (bind[1] as number) +
          (rotWorld[o + 5] ?? 0) * (bind[2] as number) +
          (skinTrans[j * 3 + 1] ?? 0));
      oz +=
        w *
        ((rotWorld[o + 6] ?? 0) * (bind[0] as number) +
          (rotWorld[o + 7] ?? 0) * (bind[1] as number) +
          (rotWorld[o + 8] ?? 0) * (bind[2] as number) +
          (skinTrans[j * 3 + 2] ?? 0));
    }
    out[v * 3] = ox;
    out[v * 3 + 1] = oy;
    out[v * 3 + 2] = oz;
  }
  return out;
}

/** Convenience for the frame loop; separate so the gate is never skipped by accident. */
export async function dispatchHead(renderer: Renderer, head: HeadCompute): Promise<void> {
  if (!head.gate.ok) throw new Error(`compute head is gated off: ${head.gate.reason}`);
  await renderer.computeAsync(head.kernel);
}
