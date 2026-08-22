/**
 * Emotion-bus contract: presets stay inside the mapped channel vocabulary and
 * inside [0,1], transitions are eased hard enough that a face never pops, and
 * intensity scales the whole preset rather than one channel.
 *
 * Ported from the gnm-avatar reference suite; assertions converted from vitest
 * to `node --test` + `node:assert/strict`, which is this repo's runner.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2, §7, §8
 * SOT-KEYWORDS: emotion test presets channels transition ease intensity beat
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EMOTION_PRESETS, EmotionState } from './emotion.ts';
import { closeTo } from './testing/close-to.ts';

const CHANNELS = new Set([
  'jawOpen', 'mouthFunnel', 'mouthPucker', 'mouthSmileLeft', 'mouthSmileRight',
  'mouthClose', 'mouthShrugUpper', 'mouthLowerDownLeft', 'mouthLowerDownRight',
  'eyeBlinkLeft', 'eyeBlinkRight', 'browDownLeft', 'browDownRight',
  'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight', 'eyesWide',
  'eyeSquintLeft', 'eyeSquintRight',
]);

describe('emotion bus', () => {
  it('presets use only mapped channels, weights in [0,1]', () => {
    for (const preset of Object.values(EMOTION_PRESETS)) {
      for (const [name, value] of Object.entries(preset)) {
        assert.ok(CHANNELS.has(name), `${name} is not a mapped face channel`);
        assert.ok(value > 0, `${name} weight ${value} must be > 0`);
        assert.ok(value <= 1, `${name} weight ${value} must be <= 1`);
      }
    }
  });

  it('transitions are eased and derivative-bounded (no pops)', () => {
    const state = new EmotionState();
    state.set('surprise');
    let prev = 0;
    let maxDelta = 0;
    for (let i = 0; i < 60; ++i) {
      const w = state.step(1 / 60).browInnerUp ?? 0;
      maxDelta = Math.max(maxDelta, Math.abs(w - prev));
      prev = w;
    }
    closeTo(prev, 0.7, 2);
    assert.ok(maxDelta < 0.06, `max per-frame delta ${maxDelta} exceeds a 400ms ease`);
    state.set('neutral');
    for (let i = 0; i < 60; ++i) prev = state.step(1 / 60).browInnerUp ?? 0;
    assert.equal(prev, 0);
  });

  it('intensity scales the whole preset', () => {
    const state = new EmotionState();
    state.set('anger', 0.5);
    for (let i = 0; i < 60; ++i) state.step(1 / 60);
    closeTo(state.step(1 / 60).browDownLeft as number, 0.35, 2);
  });
});
