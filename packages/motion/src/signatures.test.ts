// Storyboard rules for the shipped signatures that the generic gate cannot
// know: the frame each one finishes on under reduced motion, and the order of
// its beats.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileMotion, evaluateMotion } from 'kinetrell/core';
import { REDUCED_MOTION_BEHAVIOR, movementBar } from './index.ts';

test('movement bar: reduced motion lands on the settled frame', () => {
  const compiled = compileMotion(movementBar);
  // 'finish' sends a forward timeline to its duration (kinetrell
  // src/native/lifecycle.ts); that module imports nothing, but its entry point
  // pulls in react-native, so the rule is restated here rather than imported.
  assert.equal(REDUCED_MOTION_BEHAVIOR, 'finish');
  const destination = compiled.durationMs;
  assert.equal(destination, compiled.labels.settled);
  assert.deepEqual(evaluateMotion(compiled, destination), {
    gain: { scaleX: 1 },
    position: { opacity: 1, y: 0 },
  });
});

test('movement bar: position does not move until the gain has filled', () => {
  const compiled = compileMotion(movementBar);
  const gain = compiled.tracks.find((t) => t.target === 'gain')!;
  const position = compiled.tracks.find((t) => t.target === 'position')!;
  assert.ok(position.atMs >= gain.endMs);
  assert.deepEqual(evaluateMotion(compiled, gain.endMs).position, { opacity: 0, y: 6 });
});
