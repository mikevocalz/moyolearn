/**
 * The speech driver against a fake clock — which is the whole reason the audio
 * device sits behind an interface. Every property here is one that can only be
 * caught by controlling time: that the onset is scheduled a fixed lead out
 * rather than played on arrival, that the mouth eases shut instead of snapping,
 * and that the gesture track interpolates between 30fps frames rather than
 * stepping.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2, §4 row 15, §8
 * SOT-KEYWORDS: speech driver test fake clock onset lead release gesture interpolation
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ONSET_LEAD_MS, createSpeechDriver, evenTrack, type AudioBackend } from './driver.ts';
import type { GestureTrack, Track } from './track.ts';
import { closeTo } from '../testing/close-to.ts';

/** A backend whose clock only moves when a test moves it. */
function fakeBackend(durationSeconds = 2) {
  let t = 100; // a non-zero start, so "played at 0" bugs cannot hide
  const played: number[] = [];
  let stops = 0;
  const backend: AudioBackend = {
    now: () => t,
    async decode() {
      return { handle: {}, durationSeconds };
    },
    play(_u, when) {
      played.push(when);
    },
    stop() {
      stops += 1;
    },
  };
  return {
    backend,
    played,
    get stops() {
      return stops;
    },
    advance: (seconds: number) => {
      t += seconds;
    },
    at: () => t,
  };
}

const TRACK: Track = [
  [0, { jawOpen: 0 }],
  [1, { jawOpen: 1 }],
  [2, { jawOpen: 0 }],
];

describe('onset scheduling', () => {
  it('decodes first, then schedules the onset a fixed lead out', async () => {
    const f = fakeBackend();
    let wall = 5_000;
    const driver = createSpeechDriver(f.backend, () => wall);

    await driver.speak({ audio: new ArrayBuffer(8), track: TRACK, gesture: null, text: 'hi' });

    // Playback starts in the FUTURE on the audio clock, by exactly the lead.
    assert.equal(f.played.length, 1);
    closeTo(f.played[0] as number, f.at() + ONSET_LEAD_MS / 1000, 6);
    // And the wall-clock onset the idle engine anticipates against agrees.
    assert.equal(driver.scheduledOnsetAt, wall + ONSET_LEAD_MS);
  });

  it('reports no speech before the onset arrives', async () => {
    const f = fakeBackend();
    const driver = createSpeechDriver(f.backend, () => 0);
    await driver.speak({ audio: new ArrayBuffer(8), track: TRACK, gesture: null, text: 'hi' });

    const before = driver.sampleSpeech(0);
    assert.equal(before.active, false, 'the mouth must not move during the lead');
    assert.equal(driver.now(), 0);

    f.advance(ONSET_LEAD_MS / 1000 + 0.5);
    const during = driver.sampleSpeech(0);
    assert.equal(during.active, true);
    closeTo(driver.now(), 0.5, 6);
  });
});

describe('the release tail', () => {
  it('eases the last shape to zero instead of snapping the mouth shut', async () => {
    // Duration 2s so t=1 is genuinely mid-utterance: at exactly t == duration
    // the driver already considers playback finished, which is correct and is
    // why the peak sample has to sit strictly inside the window.
    const f = fakeBackend(2);
    let wall = 0;
    const driver = createSpeechDriver(f.backend, () => wall);
    await driver.speak({ audio: new ArrayBuffer(8), track: TRACK, gesture: null, text: 'hi' });

    // Mid-utterance, at the track's peak.
    f.advance(ONSET_LEAD_MS / 1000 + 1);
    const peak = driver.sampleSpeech(wall);
    assert.ok((peak.shape.jawOpen ?? 0) > 0, 'expected an open jaw at the track peak');

    // Past the end: the release begins, and decays monotonically to nothing.
    f.advance(1.5);
    wall = 1_000;
    const first = driver.sampleSpeech(wall);
    assert.equal(first.active, false);
    const startWeight = first.shape.jawOpen ?? 0;
    assert.ok(startWeight > 0, 'the release must start from the last shape');

    let previous = startWeight;
    for (let step = 1; step <= 8; ++step) {
      wall = 1_000 + step * 20;
      const w = driver.sampleSpeech(wall).shape.jawOpen ?? 0;
      assert.ok(w <= previous, `release went back up at +${step * 20}ms`);
      previous = w;
    }

    wall = 10_000; // well past releaseMs
    assert.deepEqual(driver.sampleSpeech(wall).shape, {}, 'the release must reach silence');
  });
});

describe('co-speech gesture', () => {
  const gesture: GestureTrack = {
    fps: 30,
    joints: ['spine1'],
    frames: [
      [0, 0, 0],
      [1, 2, 3],
    ],
  };

  it('is null while not playing', async () => {
    const f = fakeBackend();
    const driver = createSpeechDriver(f.backend, () => 0);
    assert.equal(driver.sampleGesture(), null);
    await driver.speak({ audio: new ArrayBuffer(8), track: TRACK, gesture, text: 'hi' });
    assert.equal(driver.sampleGesture(), null, 'still silent during the onset lead');
  });

  it('interpolates between frames rather than stepping', async () => {
    const f = fakeBackend();
    const driver = createSpeechDriver(f.backend, () => 0);
    await driver.speak({ audio: new ArrayBuffer(8), track: TRACK, gesture, text: 'hi' });

    // Half a frame at 30fps = 1/60s past the onset.
    f.advance(ONSET_LEAD_MS / 1000 + 1 / 60);
    const half = driver.sampleGesture();
    assert.ok(half);
    assert.equal(half.joints[0], 'spine1');
    closeTo(half.pose[0] as number, 0.5, 5);
    closeTo(half.pose[1] as number, 1.0, 5);
    closeTo(half.pose[2] as number, 1.5, 5);
  });

  it('clamps at the last frame instead of running off the end', async () => {
    const f = fakeBackend(10);
    const driver = createSpeechDriver(f.backend, () => 0);
    await driver.speak({ audio: new ArrayBuffer(8), track: TRACK, gesture, text: 'hi' });
    f.advance(ONSET_LEAD_MS / 1000 + 5);
    const late = driver.sampleGesture();
    assert.ok(late);
    closeTo(late.pose[0] as number, 1, 6);
    closeTo(late.pose[2] as number, 3, 6);
  });
});

describe('evenTrack — the no-alignment fallback', () => {
  it('spans the utterance and opens wider on vowels', () => {
    const track = evenTrack('ab', 2);
    assert.equal(track[0]?.[0], 0);
    assert.equal(track[track.length - 1]?.[0], 2, 'the track must reach the end of the audio');
    const weights = track.slice(1, -1).map((k) => k[1].jawOpen);
    assert.deepEqual(weights, [0.5, 0.2], 'a vowel opens wider than a consonant');
  });

  it('is used automatically when the utterance carries no track', async () => {
    const f = fakeBackend(2);
    const driver = createSpeechDriver(f.backend, () => 0);
    await driver.speak({ audio: new ArrayBuffer(8), track: null, gesture: null, text: 'aaa' });
    f.advance(ONSET_LEAD_MS / 1000 + 1);
    const sample = driver.sampleSpeech(0);
    assert.equal(sample.active, true);
    assert.ok((sample.shape.jawOpen ?? 0) > 0, 'the face must still talk without alignment');
  });
});
