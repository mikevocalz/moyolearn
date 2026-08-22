/**
 * The viseme sampler and the ARKit→GNM matrix are the two pieces of the speech
 * path that must behave identically on every platform, so they are the two
 * pieces that stayed shared when the browser audio half was split off.
 *
 * Ported from the gnm-avatar reference suite (`src/speech.test.ts`);
 * assertions converted from vitest to `node --test` + `node:assert/strict`.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2, §4 row 15, §8
 * SOT-KEYWORDS: speech track test sampler smoothstep arkit mapper coefficients
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ArkitMapper, sampleTrack, type Track } from './track.ts';
import { closeTo } from '../testing/close-to.ts';

describe('sampleTrack', () => {
  const track: Track = [
    [0, { a: 0 }],
    [1, { a: 1 }],
  ];

  it('interpolates with smoothstep between keyframes', () => {
    closeTo(sampleTrack(track, 0.5, 0).shape.a as number, 0.5, 6);
    const f = 0.25 * 0.25 * (3 - 2 * 0.25);
    closeTo(sampleTrack(track, 0.25, 0).shape.a as number, f, 6);
  });

  it('is monotone over the segment', () => {
    let prev = -Infinity;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const v = sampleTrack(track, t, 0).shape.a as number;
      assert.ok(v >= prev, `sampler went backwards at t=${t}`);
      prev = v;
    }
  });

  it('clamps outside the keyframe range', () => {
    assert.equal(sampleTrack(track, -0.5, 0).shape.a, 0);
    assert.equal(sampleTrack(track, 2, 0).shape.a, 1);
    assert.equal(sampleTrack(track, 2, 1).shape.a, 1);
  });

  it('carries the keyframe cursor forward and back', () => {
    const long: Track = [
      [0, { a: 0 }],
      [1, { a: 1 }],
      [2, { a: 0 }],
    ];
    const forward = sampleTrack(long, 1.5, 0);
    assert.equal(forward.idx, 1, 'the cursor must advance past a passed keyframe');
    const backward = sampleTrack(long, 0.5, forward.idx);
    assert.equal(backward.idx, 0, 'a seek backwards must rewind the cursor');
  });
});

describe('ArkitMapper', () => {
  const mapper = new ArkitMapper({
    names: ['jawOpen', 'mouthSmileLeft'],
    coeffs: [
      [1, 2, 0],
      [0, -1, 3],
    ],
  });

  it('mixes weighted coefficient vectors exactly', () => {
    assert.deepEqual(
      mapper.map({ jawOpen: 0.5, mouthSmileLeft: 2 }),
      new Float32Array([0.5, 1 - 2, 6])
    );
    assert.deepEqual(mapper.map({ jawOpen: 1 }), new Float32Array([1, 2, 0]));
    assert.deepEqual(mapper.map({ unknown: 1 }), new Float32Array([0, 0, 0]));
  });

  it('takes output length from the map coeff length, not a constant', () => {
    assert.equal(mapper.dim, 3);
    assert.equal(mapper.map({}).length, 3);
    const wide = new ArkitMapper({ names: ['x'], coeffs: [[1, 1, 1, 1, 1]] });
    assert.equal(wide.map({ x: 1 }).length, 5);
  });
});
