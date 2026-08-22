/**
 * Head-evaluator contract tests.
 *
 * The reference renderer asserted against the shipped 34.9 MB container. That
 * asset never enters this repo (doc 22 §3), so the default path builds a
 * synthetic GNMW at small dimensions and checks the parser + forward function
 * against their declared contract. The real container is still covered — set
 * MOYO_GNM_HEAD_BIN to a locally cached copy and the integration case runs.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2, §3, §8
 * SOT-KEYWORDS: gnm model test parser fixture compute-vertices skinning joints integration
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { GNMHeadModel, parseContainer } from './model.ts';
import { buildGnmFixture } from '../testing/gnm-container.ts';

describe('GNMW container', () => {
  it('parses a synthesised container into the declared dimensions', () => {
    const { buffer, dims } = buildGnmFixture();
    const { meta, sections } = parseContainer(buffer);

    assert.equal(meta.numVertices, dims.numVertices);
    assert.equal(meta.numJoints, dims.numJoints);
    assert.equal(meta.identityDim, dims.identityDim);
    assert.equal(meta.expressionDim, dims.expressionDim);
    assert.equal(sections.template.length, dims.numVertices * 3);
    assert.equal(
      sections.skinning_weights.length,
      dims.numVertices * dims.numJoints
    );
    assert.equal(
      sections.expression_basis.length,
      dims.expressionDim * dims.numVertices * 3
    );
  });

  it('rejects a buffer that is not a GNMW container', () => {
    const bogus = new ArrayBuffer(64);
    assert.throws(() => parseContainer(bogus), /Not a GNMW container/);
  });

  it('rejects an unsupported container version', () => {
    const { buffer } = buildGnmFixture();
    new DataView(buffer).setUint32(4, 99, true);
    assert.throws(() => parseContainer(buffer), /Unsupported GNMW version 99/);
  });
});

describe('head forward function', () => {
  it('evaluates the template shape to finite, non-zero vertices', () => {
    const { buffer, dims } = buildGnmFixture();
    const { meta, sections } = parseContainer(buffer);
    const model = new GNMHeadModel(meta, sections);

    assert.equal(model.identity.length, meta.identityDim);
    assert.equal(model.expression.length, meta.expressionDim);
    assert.equal(model.template.length, meta.numVertices * 3);
    assert.equal(model.dirty, true);

    const vertices = new Float32Array(dims.numVertices * 3);
    model.computeVertices(vertices);

    assert.ok(vertices.every(Number.isFinite), 'vertices must all be finite');
    assert.ok(
      vertices.some((v) => v !== 0),
      'the template must not evaluate to the origin'
    );
    assert.equal(model.dirty, false);
  });

  it('at rest pose, skinning is the identity: skinned == bind template', () => {
    // The sharpest property the fixture can assert. Every joint at identity
    // rotation means LBS must reproduce the bind shape exactly, so any error in
    // the weight layout (the array is JOINT-major), the FK walk, or the
    // skinning-translation construction shows up here as a non-zero delta
    // rather than as a subtly wrong face nobody can diff by eye.
    const { buffer, dims } = buildGnmFixture();
    const { meta, sections } = parseContainer(buffer);
    const model = new GNMHeadModel(meta, sections);

    const out = new Float32Array(dims.numVertices * 3);
    model.computeVertices(out);
    for (let i = 0; i < out.length; ++i) {
      assert.equal(out[i], sections.template[i], `vertex component ${i} drifted at rest`);
    }
  });

  it('an expression coefficient moves vertices and re-dirties the model', () => {
    const { buffer, dims } = buildGnmFixture();
    const { meta, sections } = parseContainer(buffer);
    const model = new GNMHeadModel(meta, sections);

    const rest = new Float32Array(dims.numVertices * 3);
    model.computeVertices(rest);

    model.setExpressionParam(0, 1);
    assert.equal(model.dirty, true, 'writing a coefficient must dirty the model');

    const posed = new Float32Array(dims.numVertices * 3);
    model.computeVertices(posed);
    assert.ok(posed.every(Number.isFinite));

    let moved = false;
    for (let i = 0; i < rest.length; ++i) {
      if (rest[i] !== posed[i]) {
        moved = true;
        break;
      }
    }
    assert.ok(moved, 'a non-zero expression coefficient must change the shape');
  });

  it('is deterministic: the same coefficients give bit-identical vertices', () => {
    const build = () => {
      const { buffer, dims } = buildGnmFixture();
      const { meta, sections } = parseContainer(buffer);
      const model = new GNMHeadModel(meta, sections);
      model.setExpressionParam(1, 0.75);
      model.setIdentityParam(2, -0.5);
      const out = new Float32Array(dims.numVertices * 3);
      model.computeVertices(out);
      return out;
    };
    const a = build();
    const b = build();
    for (let i = 0; i < a.length; ++i) {
      assert.equal(a[i], b[i], `diverged at vertex component ${i}`);
    }
  });
});

describe('locked joints are body-owned (doc 22 §2 — the single neck writer)', () => {
  it('setJointRotation throws for locked joints, eye joints stay writable', () => {
    const { buffer } = buildGnmFixture({
      numVertices: 24,
      numJoints: 5,
      identityDim: 5,
      expressionDim: 7,
      numTriangles: 8,
    });
    const { meta, sections } = parseContainer(buffer);
    const model = new GNMHeadModel(meta, sections);

    const neck = meta.jointNames.indexOf('neck');
    const head = meta.jointNames.indexOf('head');
    const leftEye = meta.jointNames.indexOf('left_eye');
    assert.ok(neck >= 0);
    assert.ok(head >= 0);
    assert.ok(leftEye >= 0);

    model.lockJoints([neck, head]);
    assert.throws(() => model.setJointRotation(neck, 0.1, 0, 0), /body-owned/);
    assert.throws(() => model.setJointRotation(head, 0.1, 0, 0), /body-owned/);
    assert.doesNotThrow(() => model.setJointRotation(leftEye, 0.1, 0, 0));

    // The locked joints were never written — still identity.
    assert.equal(model.rotations[neck * 3], 0);
    assert.equal(model.rotations[head * 3], 0);
  });
});

// The shipped container is a CDN asset, never a repo asset. Point this at a
// local cache to run the real-data case:
//   MOYO_GNM_HEAD_BIN=~/.cache/moyo/gnm_head_web.bin pnpm --filter @acme/avatar test
const headBinPath = process.env.MOYO_GNM_HEAD_BIN;

describe('the shipped GNM head container', { skip: !headBinPath }, () => {
  it('parses and evaluates at full scale', () => {
    const file = readFileSync(headBinPath as string);
    const buffer = file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength
    ) as ArrayBuffer;
    const { meta, sections } = parseContainer(buffer);
    const model = new GNMHeadModel(meta, sections);

    assert.equal(model.identity.length, meta.identityDim);
    assert.equal(model.expression.length, meta.expressionDim);
    assert.equal(model.template.length, meta.numVertices * 3);

    const vertices = new Float32Array(meta.numVertices * 3);
    model.computeVertices(vertices);
    assert.ok(vertices.every(Number.isFinite));
    assert.ok(vertices.some((v) => v !== 0));
    assert.equal(model.dirty, false);
  });
});
