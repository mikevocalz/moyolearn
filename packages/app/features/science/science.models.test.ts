// Regression coverage for offline science; no fragile textbook-answer snapshots.
// SOT-KEYWORDS: science testing conservation punnett kinematics daylight
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  approximateDaylightHours,
  isWaterMolecule,
  motionAtTime,
  offspringProbabilities,
  photosynthesisReady,
  reactionCounts,
} from './science.models.ts';

test('atom conservation is symmetric and cannot be faked by only matching H', () => {
  assert.equal(reactionCounts('water', [1, 1, 1]).balanced, false);
  assert.equal(reactionCounts('water', [2, 1, 2]).balanced, true);
  assert.deepEqual(reactionCounts('water', [2, 1, 2]).reactants, { H: 4, O: 2 });
  assert.deepEqual(reactionCounts('water', [2, 1, 2]).products, { H: 4, O: 2 });
  assert.equal(reactionCounts('ammonia', [1, 3, 2]).balanced, true);
  assert.throws(() => reactionCounts('water', [0, 1, 1]), RangeError);
  assert.throws(() => reactionCounts('water', [1.5, 1, 1]), RangeError);
});

test('molecular model checks exact ratios', () => {
  assert.equal(isWaterMolecule(2, 1), true);
  assert.equal(isWaterMolecule(1, 2), false);
});

test('Mendelian genotype distribution is normalized and handles homozygous parents', () => {
  assert.deepEqual(offspringProbabilities('Aa', 'Aa'), { AA: 0.25, Aa: 0.5, aa: 0.25 });
  assert.deepEqual(offspringProbabilities('AA', 'aa'), { AA: 0, Aa: 1, aa: 0 });
  assert.deepEqual(offspringProbabilities('aa', 'aa'), { AA: 0, Aa: 0, aa: 1 });
});

test('photosynthesis checklist requires three ingredients', () => {
  assert.equal(photosynthesisReady(true, true, true), true);
  assert.equal(photosynthesisReady(false, true, true), false);
  assert.equal(photosynthesisReady(true, false, true), false);
  assert.equal(photosynthesisReady(true, true, false), false);
});

test('1D kinematics uses constant acceleration and preserves zero time', () => {
  assert.deepEqual(motionAtTime(2, 3, 4), { meters: 32, metersPerSecond: 14 });
  assert.deepEqual(motionAtTime(2, 3, 0), { meters: 0, metersPerSecond: 2 });
  assert.throws(() => motionAtTime(1, 2, -1), RangeError);
});

test('solstice daylight is bounded and reverses between hemispheres', () => {
  assert.ok(Math.abs(approximateDaylightHours(0, 'june') - 12) < 0.01);
  assert.ok(approximateDaylightHours(40, 'june') > 14);
  assert.ok(approximateDaylightHours(40, 'december') < 10);
  assert.ok(Math.abs(approximateDaylightHours(-40, 'june') - approximateDaylightHours(40, 'december')) < 0.01);
  assert.equal(approximateDaylightHours(80, 'june'), 24);
  assert.equal(approximateDaylightHours(80, 'december'), 0);
  assert.throws(() => approximateDaylightHours(120, 'june'), RangeError);
});
