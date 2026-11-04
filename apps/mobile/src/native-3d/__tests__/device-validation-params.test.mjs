import test from 'node:test';
import assert from 'node:assert/strict';
import { parseValidationProbeRequest, videoSurfaceLayout } from '../device-validation-params.ts';

test('no params gives the R1.2 single video with both Round 2 switches off', () => {
  assert.deepEqual(parseValidationProbeRequest(undefined), {
    workload: 'video', count: 1, nativeBoard: false, nativeRive: false,
  });
});

test('reads workload, count and the two switches', () => {
  const params = new URLSearchParams('workload=multi&count=4&nativeBoard=1&nativeRive=true');
  assert.deepEqual(parseValidationProbeRequest(params), {
    workload: 'multi', count: 4, nativeBoard: true, nativeRive: true,
  });
});

test('unknown values fall back to the defaults', () => {
  const params = new URLSearchParams('workload=movie&count=3&nativeBoard=yes');
  assert.deepEqual(parseValidationProbeRequest(params), {
    workload: 'video', count: 1, nativeBoard: false, nativeRive: false,
  });
});

test('layouts keep 16:9 and place 1, 2 and 4 surfaces symmetrically', () => {
  const one = videoSurfaceLayout(1, 1.6, 2, 1.5);
  assert.equal(one.length, 1);
  assert.deepEqual(one[0].position, [0, 1.5, -2]);
  assert.equal(one[0].height, 0.9);

  const two = videoSurfaceLayout(2, 1, 2, 1.5);
  assert.equal(two.length, 2);
  assert.equal(two[0].position[0], -two[1].position[0]);

  const four = videoSurfaceLayout(4, 1, 2, 1.5);
  assert.equal(four.length, 4);
  const xs = four.map((cell) => cell.position[0]);
  const ys = four.map((cell) => cell.position[1]);
  assert.equal(xs.reduce((a, b) => a + b, 0), 0);
  assert.ok(Math.abs(ys.reduce((a, b) => a + b, 0) / 4 - 1.5) < 1e-9);
});
