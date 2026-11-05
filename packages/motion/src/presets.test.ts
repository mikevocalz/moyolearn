// Holds each preset to the band web-designer-pro motion.md §1 sets for it, so a
// token edit that leaves its band fails here rather than on someone's phone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { motion } from '@acme/theme';
import { presets, spring, startOf, tokenMs, track } from './presets.ts';

test('presets read their numbers from the theme tokens', () => {
  assert.equal(presets.feedback.durationMs, tokenMs(motion.duration.base));
  assert.equal(presets.transition.durationMs, tokenMs(motion.duration.slow));
  assert.equal(presets.exit.durationMs, tokenMs(motion.duration.fast));
  assert.equal(presets.cinematic.durationMs, tokenMs(motion.duration.slower));
  assert.equal(spring.settle.stiffness, motion.spring.settle.stiffness);
});

test('feedback is 120-200 ms and transitions are 250-400 ms', () => {
  for (const name of ['feedback', 'exit'] as const) {
    assert.ok(presets[name].durationMs >= 120 && presets[name].durationMs <= 200, name);
  }
  for (const name of ['transition', 'entrance'] as const) {
    assert.ok(presets[name].durationMs >= 250 && presets[name].durationMs <= 400, name);
  }
});

test('entrances decelerate with cubic.out and nothing moves on linear', () => {
  assert.equal(presets.entrance.ease, 'cubic.out');
  for (const [name, preset] of Object.entries(presets)) {
    assert.notEqual(preset.ease, 'linear', name);
  }
});

test('tokenMs rejects anything that is not whole milliseconds', () => {
  assert.equal(tokenMs('120ms'), 120);
  assert.throws(() => tokenMs('0.12s'));
  assert.throws(() => tokenMs('120'));
});

test('startOf sequences presets and pulls a track earlier by an overlap fraction', () => {
  assert.equal(startOf(), 0);
  assert.equal(startOf({ after: ['entrance'] }), presets.entrance.durationMs);
  assert.equal(
    startOf({ after: ['entrance', 'feedback'], overlap: 0.5 }),
    presets.entrance.durationMs + presets.feedback.durationMs / 2,
  );
  assert.equal(startOf({ after: ['feedback'], overlap: 4 }), 0);
});

test('track() carries the preset timing and curve, never a caller number', () => {
  const built = track('transition', { target: 'card', to: { opacity: 1 }, after: ['entrance'] });
  assert.deepEqual(built, {
    target: 'card',
    to: { opacity: 1 },
    atMs: presets.entrance.durationMs,
    durationMs: presets.transition.durationMs,
    ease: presets.transition.ease,
  });
});
