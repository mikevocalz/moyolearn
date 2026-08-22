/**
 * Picking the wrong encoder is silent and produces a garbage face, so the
 * choice is made from container metadata and both failure modes throw.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §6.3
 * SOT-KEYWORDS: encoder test direct matrix rebake container mismatch arkit
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { directEncoder, encoderForContainer, matrixEncoder } from './encoder.ts';

const NAMES = ['jawOpen', 'mouthSmileLeft', 'eyesWide'];

describe('directEncoder — the rebaked path', () => {
  it('writes each weight to its own slot', () => {
    const e = directEncoder(NAMES);
    assert.equal(e.dim, 3);
    assert.deepEqual(e.encode({ jawOpen: 0.5, eyesWide: 1 }), new Float32Array([0.5, 0, 1]));
  });

  it('ignores channels the head does not carry', () => {
    const e = directEncoder(NAMES);
    assert.deepEqual(e.encode({ nope: 1, jawOpen: 0.25 }), new Float32Array([0.25, 0, 0]));
  });

  it('clears between frames — a released channel must fall to zero', () => {
    const e = directEncoder(NAMES);
    e.encode({ jawOpen: 1 });
    assert.deepEqual(e.encode({ eyesWide: 1 }), new Float32Array([0, 0, 1]));
  });
});

describe('encoderForContainer', () => {
  it('chooses direct for a rebaked container', () => {
    const e = encoderForContainer({
      expressionDim: 3,
      expressionNames: NAMES,
      bake: { arkitChannels: 3 },
    });
    assert.deepEqual(e.encode({ eyesWide: 1 }), new Float32Array([0, 0, 1]));
  });

  it('chooses the matrix for an authoring container', () => {
    const map = { names: ['jawOpen'], coeffs: [[1, 2, 0, 0, 0]] };
    const e = encoderForContainer(
      { expressionDim: 5, expressionNames: ['c0', 'c1', 'c2', 'c3', 'c4'] },
      map
    );
    assert.equal(e.dim, 5);
    assert.deepEqual(e.encode({ jawOpen: 1 }), new Float32Array([1, 2, 0, 0, 0]));
  });

  it('refuses an authoring container with no map, naming the fix', () => {
    assert.throws(
      () => encoderForContainer({ expressionDim: 383, expressionNames: [] }),
      /authoring container/
    );
  });

  it('refuses a map whose width disagrees with the head', () => {
    assert.throws(
      () =>
        encoderForContainer(
          { expressionDim: 5, expressionNames: ['a', 'b', 'c', 'd', 'e'] },
          { names: ['jawOpen'], coeffs: [[1, 2, 3]] }
        ),
      /mismatched bakes/
    );
  });
});

describe('the two encoders agree', () => {
  it('a matrix that is the identity gives what direct gives', () => {
    const identity = { names: NAMES, coeffs: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] };
    const shape = { jawOpen: 0.3, eyesWide: 0.7 };
    assert.deepEqual(matrixEncoder(identity).encode(shape), directEncoder(NAMES).encode(shape));
  });
});
