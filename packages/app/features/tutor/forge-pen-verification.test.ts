import assert from 'node:assert/strict';
import test from 'node:test';
import { canVerifyMuseFrame } from './forge-pen-verification.ts';

test('native Muse verification accepts tracked finite pose with actual zero pressure', () => {
  assert.equal(canVerifyMuseFrame({ tracked: true, position: [0, 1, -2], pressure: 0 }), true);
  assert.equal(canVerifyMuseFrame({ tracked: true, position: [0, 1, -2], pressure: 1 }), true);
});

test('tracking loss, malformed pose and missing pressure cannot promote connection readiness', () => {
  for (const frame of [
    { tracked: false, position: [0, 1, 2], pressure: 0.5 },
    { tracked: true, position: null, pressure: 0.5 },
    { tracked: true, position: [0, 1], pressure: 0.5 },
    { tracked: true, position: [0, NaN, 2], pressure: 0.5 },
    { tracked: true, position: [0, 1, 2], pressure: NaN },
    { tracked: true, position: [0, 1, 2], pressure: -1 },
    { tracked: true, position: [0, 1, 2], pressure: 2 },
  ]) assert.equal(canVerifyMuseFrame(frame), false);
});
