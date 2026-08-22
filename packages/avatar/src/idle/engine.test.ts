/**
 * The idle engine is the reason the whole avatar is testable: it is pure
 * `step(dt, inputs)` over one seeded PRNG, so behaviour that is otherwise
 * judged by eye — blink rate, whether the sway loops, whether anticipation
 * lands before the word — becomes a statistical assertion.
 *
 * Ported from the gnm-avatar reference suite; assertions converted from vitest
 * to `node --test` + `node:assert/strict`. The thresholds are unchanged.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2, §8
 * SOT-KEYWORDS: idle engine test blink statistics sway autocorrelation determinism anticipation envelope
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { idleConfig as C } from './config.ts';
import {
  IDLE_CHANNELS,
  IdleEngine,
  type IdleChannel,
  type IdleInputs,
} from './engine.ts';

const DT = 1 / 60;
const DEG = Math.PI / 180;

const quiet: IdleInputs = {
  speechActive: false,
  speechGap: false,
  processing: false,
  partnerSpeaking: false,
  partnerPauseEvent: false,
  partnerF0Falling: false,
  timeUntilOnset: Infinity,
};

describe('blink statistics', () => {
  it('lands 14-21/min with non-uniform inter-arrivals (CV > 0.3)', () => {
    const engine = new IdleEngine(1);
    const seconds = 12000;
    const times: number[] = [];
    let t = 0;
    for (let i = 0, n = Math.round(seconds / DT); i < n; ++i) {
      const frame = engine.step(DT, quiet);
      t += DT;
      if (frame.blinkStarted) times.push(t);
    }
    const perMinute = times.length / (t / 60);
    assert.ok(perMinute >= 14, `blink rate ${perMinute}/min below 14`);
    assert.ok(perMinute <= 21, `blink rate ${perMinute}/min above 21`);

    const intervals = times.slice(1).map((v, i) => v - (times[i] as number));
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance =
      intervals.reduce((a, b) => a + (b - mean) * (b - mean), 0) /
      intervals.length;
    const cv = Math.sqrt(variance) / mean;
    assert.ok(cv > 0.3, `inter-arrival CV ${cv} is too uniform`);
  });
});

describe('postural sway', () => {
  it('does not loop: autocorrelation < 0.25 beyond one slowest-octave cycle', () => {
    const engine = new IdleEngine(1);
    const seconds = 600;
    const decimate = 6; // 60Hz run sampled at 10Hz
    const samples: number[] = [];
    for (let i = 0, n = Math.round(seconds / DT); i < n; ++i) {
      const frame = engine.step(DT, quiet);
      if (i % decimate === 0) samples.push(frame.swayX);
    }
    const n = samples.length;
    const mean = samples.reduce((a, b) => a + b, 0) / n;
    const x = samples.map((v) => v - mean);
    const variance = x.reduce((a, b) => a + b * b, 0) / n;
    const slowestHz = Math.min(...C.sway.octaves.map((o) => o.hz));
    const sampleHz = 1 / (DT * decimate);
    const lagMin = Math.ceil((1 / slowestHz) * sampleHz);
    for (let lag = lagMin; lag < n / 2; ++lag) {
      let sum = 0;
      for (let i = 0; i + lag < n; ++i) sum += (x[i] as number) * (x[i + lag] as number);
      const r = sum / ((n - lag) * variance);
      assert.ok(Math.abs(r) < 0.25, `sway autocorrelation ${r} at lag ${lag} — the idle loops`);
    }
  });
});

describe('channel envelopes', () => {
  it('stays within config bounds over a 10-minute mixed-input run', () => {
    const engine = new IdleEngine(3);
    const bounds: Record<IdleChannel, [number, number]> = {
      breathY: [
        -C.breath.bobM * C.breath.anticipationBoost,
        C.breath.bobM * C.breath.anticipationBoost,
      ],
      breathPitch: [-C.breath.pitchDeg * DEG, C.breath.pitchDeg * DEG],
      swayX: [-C.sway.amplitudeM, C.sway.amplitudeM],
      swayY: [-C.sway.amplitudeM, C.sway.amplitudeM],
      driftYaw: [-C.drift.maxDeg * DEG, C.drift.maxDeg * DEG],
      driftPitch: [-C.drift.maxDeg * DEG, C.drift.maxDeg * DEG],
      nodPitch: [-1e-9, C.nod.pitchDeg.max * DEG],
      eyeYaw: [-C.saccade.maxDeg * DEG, C.saccade.maxDeg * DEG],
      eyePitch: [-C.saccade.maxDeg * DEG, C.saccade.maxDeg * DEG],
      eyeBlinkLeft: [0, 1],
      eyeBlinkRight: [0, 1],
      eyesWide: [0, 1],
    };
    let t = 0;
    for (let i = 0, n = Math.round(600 / DT); i < n; ++i) {
      const phase = t % 60;
      const frame = engine.step(DT, {
        speechActive: phase > 40,
        speechGap: phase > 40 && Math.floor(phase) % 5 === 0,
        processing: phase > 35 && phase <= 40,
        partnerSpeaking: phase < 20,
        partnerPauseEvent: Math.abs(phase - 20) < DT,
        partnerF0Falling: Math.abs(phase - 10) < DT,
        timeUntilOnset: phase > 35 && phase <= 40 ? 40 - phase : Infinity,
      });
      t += DT;
      for (const channel of IDLE_CHANNELS) {
        const v = frame[channel];
        const [lo, hi] = bounds[channel];
        if (v < lo - 1e-9 || v > hi + 1e-9) {
          throw new Error(`${channel}=${v} out of [${lo}, ${hi}] at t=${t}`);
        }
      }
    }
    assert.ok(t > 599, 'the run must cover the full ten minutes');
  });
});

describe('determinism', () => {
  const run = (seed: number, steps: number) => {
    const engine = new IdleEngine(seed);
    const out = new Float32Array(steps * IDLE_CHANNELS.length);
    for (let i = 0; i < steps; ++i) {
      const t = i * DT;
      const frame = engine.step(DT, {
        ...quiet,
        speechActive: t % 20 > 12,
        partnerSpeaking: t % 20 < 6,
        timeUntilOnset: t % 20 > 10 && t % 20 <= 12 ? 12 - (t % 20) : Infinity,
      });
      for (let c = 0; c < IDLE_CHANNELS.length; ++c) {
        out[i * IDLE_CHANNELS.length + c] = frame[IDLE_CHANNELS[c] as IdleChannel];
      }
    }
    return out;
  };

  it('same seed is bit-identical over 10k steps; different seed differs', () => {
    const a = run(1, 10000);
    const b = run(1, 10000);
    assert.equal(a.length, b.length);
    for (let i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) throw new Error(`diverged at ${i}`);
    }
    const c = run(2, 10000);
    let differs = false;
    for (let i = 0; i < a.length; ++i) {
      if (a[i] !== c[i]) {
        differs = true;
        break;
      }
    }
    assert.ok(differs, 'a different seed must produce a different run');
  });
});

describe('vegetative layer during speech', () => {
  it('never drops to zero amplitude while speechActive', () => {
    const engine = new IdleEngine(1);
    let maxBreath = 0;
    let maxSway = 0;
    for (let i = 0, n = Math.round(60 / DT); i < n; ++i) {
      const frame = engine.step(DT, { ...quiet, speechActive: true });
      assert.ok(frame.gains.breath > 0, 'breath must never fully gate off');
      assert.ok(frame.gains.sway > 0, 'sway must never fully gate off');
      assert.ok(frame.gains.drift > 0, 'drift must never fully gate off');
      maxBreath = Math.max(maxBreath, Math.abs(frame.breathY));
      maxSway = Math.max(maxSway, Math.abs(frame.swayX));
    }
    assert.ok(maxBreath > 0);
    assert.ok(maxSway > 0);
  });
});

describe('anticipation timing', () => {
  it('fires in [onset-0.4, onset-0.25] for an onset 0.5s out', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const engine = new IdleEngine(seed);
      const onset = 0.5;
      let fired = -1;
      let t = 0;
      for (let i = 0, n = Math.round(1 / DT); i < n; ++i) {
        const frame = engine.step(DT, {
          ...quiet,
          timeUntilOnset: t < onset ? onset - t : Infinity,
        });
        t += DT;
        if (frame.anticipated && fired < 0) fired = t;
      }
      assert.ok(fired > 0, `anticipation never fired for seed ${seed}`);
      assert.ok(fired >= onset - 0.4, `anticipation at ${fired} is too early`);
      assert.ok(fired <= onset - 0.25 + DT, `anticipation at ${fired} is too late`);
    }
  });
});
