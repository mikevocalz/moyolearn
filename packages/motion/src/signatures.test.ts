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
    gain: { scaleX: 1.03 },
    settle: { scaleX: 1 / 1.03 },
    level: { opacity: 1 },
    position: { opacity: 1 },
  });
});

test('movement bar: the needle overshoots, then words follow the bar', () => {
  const compiled = compileMotion(movementBar);
  const at = (label: string) => {
    const state = evaluateMotion(compiled, compiled.labels[label] ?? Number.NaN);
    const scale = (target: string) => Number(state[target]?.scaleX);
    return { width: scale('gain') * scale('settle'), level: state.level?.opacity, position: state.position?.opacity };
  };
  assert.ok(at('overshoot').width > 1, 'the needle runs past the after edge');
  assert.equal(at('overshoot').position, 0);
  assert.ok(Math.abs(at('rest').width - 1) < 1e-9, 'it comes to rest exactly on the after edge');
  assert.equal(at('rest').position, 0, 'position waits until the bar is at rest');
  assert.equal(evaluateMotion(compiled, 0).level?.opacity, 0, 'the level line does not give the result away');
});
