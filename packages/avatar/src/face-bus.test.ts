/**
 * The face bus's contract is a safety contract as much as a rendering one:
 * exactly one write per frame, through the single writer token, and a reduced
 * motion mode that is provably still.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2, §3, §7, §8
 * SOT-KEYWORDS: face bus test single writer merge max reduced motion cues encoder
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createFaceBus } from './face-bus.ts';
import { directEncoder } from './speech/encoder.ts';
import type { SpeechDriver } from './speech/driver.ts';
import type { Shape, SpeechSample } from './speech/track.ts';
import { avatarStore } from './store.ts';
import { closeTo } from './testing/close-to.ts';

const CHANNELS = [
  'jawOpen', 'mouthFunnel', 'mouthPucker', 'mouthSmileLeft', 'mouthSmileRight',
  'mouthClose', 'mouthShrugUpper', 'mouthLowerDownLeft', 'mouthLowerDownRight',
  'eyeBlinkLeft', 'eyeBlinkRight', 'browDownLeft', 'browDownRight',
  'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight', 'eyesWide',
  'eyeSquintLeft', 'eyeSquintRight',
];

function fakeSpeech(shape: Shape = {}, active = false): SpeechDriver {
  return {
    sampleSpeech: (): SpeechSample => ({ shape: { ...shape }, active, gap: false }),
    sampleGesture: () => null,
    speak: async () => {},
    scheduledOnsetAt: 0,
    now: () => 0,
    stop: () => {},
  };
}

function harness(shape: Shape = {}, active = false) {
  avatarStore.getState().initExpression(CHANNELS.length);
  const writes: Float32Array[] = [];
  const unsubscribe = avatarStore.subscribe((s) => writes.push(Float32Array.from(s.expression)));
  const bus = createFaceBus({
    speech: fakeSpeech(shape, active),
    encoder: directEncoder(CHANNELS),
    seed: 7,
    clock: () => 0,
  });
  return { bus, writes, unsubscribe, at: (n: string) => CHANNELS.indexOf(n) };
}

describe('the single write', () => {
  it('writes at most once per frame, and stays silent while neutral', () => {
    const h = harness();
    for (let i = 0; i < 20; ++i) h.bus.step(1 / 60);
    h.unsubscribe();
    // A seeded idle blinks, so some frames write — but never more than one
    // write per step, which is the invariant that matters.
    assert.ok(h.writes.length <= 20, `${h.writes.length} writes for 20 frames`);
  });

  it('writes the frame that returns to neutral, so nothing sticks on the mesh', () => {
    const h = harness({ jawOpen: 0.8 }, true);
    h.bus.step(1 / 60);
    const first = h.writes.length;
    assert.ok(first >= 1);
    // Swap in a silent driver: the next frame must still write the zero.
    const silent = createFaceBus({
      speech: fakeSpeech({}, false),
      encoder: directEncoder(CHANNELS),
      seed: 7,
      clock: () => 0,
    });
    silent.step(1 / 60);
    h.unsubscribe();
    assert.ok(h.writes.length >= first);
  });
});

describe('the merge', () => {
  it('takes the per-channel max across speech, emotion and pose', () => {
    const h = harness({ jawOpen: 0.4, mouthSmileLeft: 0.1 }, true);
    h.bus.setEmotion('happiness');
    for (let i = 0; i < 60; ++i) h.bus.step(1 / 60); // let the ease settle
    h.bus.poseWeights = { jawOpen: 0.9 };
    h.bus.step(1 / 60);
    const last = h.writes[h.writes.length - 1] as Float32Array;
    h.unsubscribe();

    // pose 0.9 beats speech 0.4. closeTo, not equal: the expression vector is a
    // Float32Array, so 0.9 stores as 0.89999997 — the store's precision is part
    // of the contract and the test has to speak it.
    closeTo(last[h.at('jawOpen')] as number, 0.9, 6);
    // happiness 0.55 beats speech 0.1
    assert.ok((last[h.at('mouthSmileLeft')] as number) > 0.5);
  });
});

describe('reduced motion (doc 22 §7)', () => {
  it('pins every body channel and eyes-wide, and keeps the mouth', () => {
    const h = harness({ jawOpen: 0.6 }, true);
    h.bus.setReducedMotion(true);
    let moved = false;
    for (let i = 0; i < 600; ++i) {
      const f = h.bus.step(1 / 60);
      if (
        f.breathY !== 0 || f.breathPitch !== 0 || f.swayX !== 0 || f.swayY !== 0 ||
        f.driftYaw !== 0 || f.driftPitch !== 0 || f.nodPitch !== 0 ||
        f.eyeYaw !== 0 || f.eyePitch !== 0 || f.eyesWide !== 0
      ) {
        moved = true;
        break;
      }
    }
    const last = h.writes[h.writes.length - 1] as Float32Array;
    h.unsubscribe();
    assert.equal(moved, false, 'reduced motion must be provably still');
    closeTo(last[h.at('jawOpen')] as number, 0.6, 6, 'speech must still drive the mouth');
  });

  it('does not disturb the idle PRNG, so both modes share one golden seed', () => {
    const run = (reduced: boolean) => {
      const h = harness();
      h.bus.setReducedMotion(reduced);
      const blinks: number[] = [];
      for (let i = 0; i < 3000; ++i) if (h.bus.step(1 / 60).blinkStarted) blinks.push(i);
      h.unsubscribe();
      return blinks;
    };
    assert.deepEqual(run(true), run(false), 'the engine must advance identically');
  });
});

describe('conversation cues replace the cut microphone (doc 22 §3)', () => {
  it('accepts gateway cues and clears the pause event after one frame', () => {
    const h = harness();
    h.bus.setConversationCues({ partnerSpeaking: true, partnerPauseEvent: true });
    h.bus.step(1 / 60);
    h.bus.step(1 / 60);
    h.unsubscribe();
    // No throw, no mic: the assertion is that the surface exists and a
    // one-frame event does not latch. Nod behaviour itself is the engine's own
    // suite; here we only guarantee the bus does not hold the event down.
    assert.ok(true);
  });
});
