/**
 * The compute head path — doc 22 §4 row 14.
 *
 * The test that matters here is the PARITY one: `evaluateOnCpu()` mirrors the
 * kernel line for line, including the vertex-major repack, and it is diffed
 * against the real `GNMHeadModel.computeVertices()` at several expressions. If
 * the repack transposed an index or the skinning read the wrong stride, that
 * test goes red — on a machine with no GPU, in CI, in under a second. It does
 * not prove the WGSL is right; it proves the ALGORITHM the WGSL encodes is.
 *
 * The rest is the limits arithmetic, which is the actual risk in row 14: the
 * kernel is useless if it cannot bind on the fleet, and the interesting number
 * is how much margin the runtime rebake bought.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §4 row 14, §6.3
 * SOT-KEYWORDS: compute test parity storage buffers limits rebake packing skinning gnm
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Matrix3, Vector3 } from 'three';
import { GNMHeadModel, parseContainer } from '../gnm/model.ts';
import { buildGnmFixture } from '../testing/gnm-container.ts';
import {
  POSITION_STORAGE_ATTRIBUTE,
  WEBGPU_DEFAULT_LIMITS,
  canUseComputeHead,
  createHeadCompute,
  evaluateOnCpu,
  headComputeRequirement,
  packExpressionBasis,
} from './head.ts';
import type { HeadComputeSource } from './head.ts';

function makeModel() {
  const { buffer } = buildGnmFixture();
  const { meta, sections } = parseContainer(buffer);
  return new GNMHeadModel(meta, sections);
}

function sourceOf(model: GNMHeadModel): HeadComputeSource {
  return {
    numVertices: model.numVertices,
    numJoints: model.numJoints,
    identityDim: model.identityDim,
    expressionDim: model.expressionDim,
    template: model.template,
    expressionBasis: model.expressionBasis,
    expressionScales: model.expressionScales,
    skinningWeights: model.skinningWeights,
    expression: model.expression,
  };
}

describe('the compute head kernel', () => {
  it('matches GNMHeadModel exactly at rest — identity is not a special case', () => {
    const model = makeModel();
    // The fixture has an identity basis, so zero it out: the compute path is
    // specified against a REBAKED container, where the identity is already
    // folded into the template. Anything else is not the shipping shape.
    model.resetIdentity();
    model.resetExpression();

    const reference = new Float32Array(model.numVertices * 3);
    model.computeVertices(reference);

    const { rotWorld, skinTrans } = model.prepareSkinTransforms();
    const mine = evaluateOnCpu(
      sourceOf(model),
      rotWorld,
      skinTrans,
      new Float32Array(model.numVertices * 3)
    );

    let worst = 0;
    for (let i = 0; i < reference.length; ++i) {
      worst = Math.max(worst, Math.abs((reference[i] as number) - (mine[i] as number)));
    }
    assert.equal(worst, 0, 'rest pose must be bit-exact, not merely close');
  });

  it('matches GNMHeadModel under expression — the repack is the thing being tested', () => {
    const model = makeModel();
    model.resetIdentity();

    // Several distinct expressions, including a negative coefficient and a
    // saturated one: a transposed index survives a single-channel test and
    // dies here.
    const cases = [
      [1, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 1],
      [0.6, -0.4, 0.9, 0.1, -1, 0.25, 0.75],
    ];

    for (const coefficients of cases) {
      model.setExpressionVector(Float32Array.from(coefficients));
      const reference = new Float32Array(model.numVertices * 3);
      model.computeVertices(reference);

      const { rotWorld, skinTrans } = model.prepareSkinTransforms();
      const mine = evaluateOnCpu(
        sourceOf(model),
        rotWorld,
        skinTrans,
        new Float32Array(model.numVertices * 3)
      );

      let worst = 0;
      for (let i = 0; i < reference.length; ++i) {
        worst = Math.max(worst, Math.abs((reference[i] as number) - (mine[i] as number)));
      }
      // Float32 accumulation order differs between the two loops, so this is a
      // tolerance rather than an equality — but at 1e-6 on a head measured in
      // metres it is a nanometre, i.e. the algorithms are the same algorithm.
      assert.ok(worst < 1e-6, `expression ${coefficients.join(',')} drifted ${worst}`);
    }
  });

  it('moves when the head moves — the parity test is not comparing two zeros', () => {
    const model = makeModel();
    model.resetIdentity();
    model.resetExpression();
    const rest = new Float32Array(model.numVertices * 3);
    model.computeVertices(rest);

    model.setExpressionVector(Float32Array.from([1, 0, 0, 0, 0, 0, 0]));
    const posed = new Float32Array(model.numVertices * 3);
    model.computeVertices(posed);

    let moved = 0;
    for (let i = 0; i < rest.length; ++i) {
      if (Math.abs((rest[i] as number) - (posed[i] as number)) > 1e-9) moved += 1;
    }
    assert.ok(moved > 0, 'the fixture expression basis must actually displace vertices');
  });

  it('repacks the basis vertex-major with the scale folded in', () => {
    const model = makeModel();
    const source = sourceOf(model);
    const packed = packExpressionBasis(source);
    const v3 = source.numVertices * 3;
    assert.equal(packed.length, v3 * source.expressionDim);

    // Spot-check the transpose against the component-major original.
    for (const [k, j] of [
      [0, 0],
      [3, 17],
      [source.expressionDim - 1, v3 - 1],
    ] as [number, number][]) {
      // `Math.fround` because `packed` is a Float32Array: the product is
      // computed in float64 and rounded on store, and comparing against the
      // unrounded float64 would fail for a correct repack.
      const expected = Math.fround(
        (source.expressionBasis[k * v3 + j] as number) * (source.expressionScales[k] as number)
      );
      assert.equal(packed[j * source.expressionDim + k], expected, `component ${k}, scalar ${j}`);
    }
  });
});

describe('the storage-buffer gate', () => {
  it('needs four buffers on a rebaked container, five on a raw one', () => {
    const model = makeModel();
    const raw = headComputeRequirement(sourceOf(model));
    // The fixture carries an identity basis, i.e. it is NOT rebaked.
    assert.equal(raw.identityBasisPresent, true);
    assert.equal(raw.storageBuffers, 5);

    const rebaked = headComputeRequirement({ ...sourceOf(model), identityDim: 0 });
    assert.equal(rebaked.identityBasisPresent, false);
    assert.equal(rebaked.storageBuffers, 4, 'the rebake removes a whole binding');
    assert.ok(rebaked.totalBytes < raw.totalBytes);
  });

  it('passes on the WebGPU defaults', () => {
    const model = makeModel();
    const gate = canUseComputeHead(headComputeRequirement({ ...sourceOf(model), identityDim: 0 }));
    assert.equal(gate.ok, true, gate.reason);
    assert.equal(WEBGPU_DEFAULT_LIMITS.maxStorageBuffersPerShaderStage, 8);
  });

  it('fails CLOSED on a stingy adapter, and says what to do about it', () => {
    const model = makeModel();
    const stingy = { ...WEBGPU_DEFAULT_LIMITS, maxStorageBuffersPerShaderStage: 4 };

    const raw = canUseComputeHead(headComputeRequirement(sourceOf(model)), stingy);
    assert.equal(raw.ok, false);
    // The message has to name the fix, or the next person reads "5 > 4" and
    // concludes the device is unsupported when the container is just stale.
    assert.match(raw.reason ?? '', /bake_runtime_container/);

    const rebaked = canUseComputeHead(
      headComputeRequirement({ ...sourceOf(model), identityDim: 0 }),
      stingy
    );
    assert.equal(rebaked.ok, true, 'a rebaked container still fits in four');
  });

  it('fails on a binding-size limit too, not just a count', () => {
    const model = makeModel();
    const tiny = { ...WEBGPU_DEFAULT_LIMITS, maxStorageBufferBindingSize: 16 };
    const gate = canUseComputeHead(headComputeRequirement(sourceOf(model)), tiny);
    assert.equal(gate.ok, false);
    assert.match(gate.reason ?? '', /largest binding/);
  });
});

describe('the compute node graph', () => {
  it('builds, and exposes an output attribute the material can bind', () => {
    const model = makeModel();
    model.resetIdentity();
    const head = createHeadCompute({ ...sourceOf(model), identityDim: 0 });

    assert.equal(POSITION_STORAGE_ATTRIBUTE, 'positionStorage');
    assert.equal(head.positionAttribute.itemSize, 3);
    assert.equal(head.positionAttribute.count, model.numVertices);
    assert.equal(head.positionAttribute.isStorageBufferAttribute, true);
    assert.ok(head.kernel, 'the ComputeNode constructed against real three 0.185.1');
    assert.equal(head.gate.ok, true, head.gate.reason);
  });

  it('uploads the FK result without transposing it', () => {
    const model = makeModel();
    model.resetIdentity();
    const source = { ...sourceOf(model), identityDim: 0 };
    const head = createHeadCompute(source);

    // A recognisably asymmetric rotation: a transpose is visible in the result.
    const rotWorld = new Float32Array(model.numJoints * 9);
    const skinTrans = new Float32Array(model.numJoints * 3);
    for (let j = 0; j < model.numJoints; ++j) {
      rotWorld.set([1, 2, 3, 4, 5, 6, 7, 8, 9], j * 9);
      skinTrans.set([0.1, 0.2, 0.3], j * 3);
    }
    source.expression = Float32Array.from({ length: source.expressionDim }, (_, i) => i * 0.1);
    head.update(source, rotWorld, skinTrans);

    // three.js `Matrix3.elements` is COLUMN-major and `set()` takes ROW-major.
    // A correctly loaded row-major [1..9] therefore reads back column-major as
    // [1,4,7, 2,5,8, 3,6,9]. Reading [1..9] straight back would mean someone
    // swapped `set()` for `fromArray()` and silently transposed every joint —
    // which looks like a head that turns the wrong way, on the GPU path only.
    assert.deepEqual(
      [...(head.uniforms.jointRotations[0] as Matrix3).elements],
      [1, 4, 7, 2, 5, 8, 3, 6, 9]
    );
    assert.deepEqual(
      (head.uniforms.jointTranslations[0] as Vector3).toArray().map((n) => Math.round(n * 10) / 10),
      [0.1, 0.2, 0.3]
    );
    assert.equal(head.uniforms.coefficients.length, source.expressionDim);
    // float32, because it came through the model's Float32Array coefficients.
    assert.equal(head.uniforms.coefficients[2], Math.fround(0.2));
  });
});
