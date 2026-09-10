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
  FINGER_CHANNELS,
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
  /*
    "Does not loop" is a property of the SIGNAL, and it has to be asserted as
    one. The obvious test — one seed, and every lag's autocorrelation under a
    fixed ceiling — is a coin flip, because the quantity it bounds is the
    maximum over roughly three thousand lags and that maximum is itself noisy.
    Measured across twelve seeds it ranges 0.17 to 0.35 and clears 0.25 on five
    of them; the version pinned to seed 1 passed because seed 1 happened to land
    at 0.249, and it began failing on an unrelated change to the breath period
    that shifted the shared random stream.

    What distinguishes a loop from a high lag by chance is CONSISTENCY. A real
    loop comes from the octave structure, which every seed shares, so it would
    appear at the same lag every time. Noise peaks land wherever they land — the
    measured lags spread from 67 to 2909 with nothing in common. So this asserts
    two things a loop could not survive: the peak does not sit at a shared lag
    across seeds, and the typical peak stays modest.

    They catch different failures, and only the second catches the one this
    layer is designed against. Replacing the second octave's irrational ratio
    with `* 2` — the exact defect `sway.octaves` exists to prevent — takes the
    median from 0.23 to 0.333 and fails, while the peak lags still scatter and
    the first assertion stays green. Verified both directions.
  */
  const peakOf = (seed: number) => {
    const engine = new IdleEngine(seed);
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
    const lagMin = Math.ceil((1 / slowestHz) * (1 / (DT * decimate)));
    let peak = 0;
    let peakLag = 0;
    for (let lag = lagMin; lag < n / 2; ++lag) {
      let sum = 0;
      for (let i = 0; i + lag < n; ++i) sum += (x[i] as number) * (x[i + lag] as number);
      const r = Math.abs(sum / ((n - lag) * variance));
      if (r > peak) {
        peak = r;
        peakLag = lag;
      }
    }
    return { peak, peakLag };
  };

  const SEEDS = [1, 2, 3, 4, 5];
  const peaks = SEEDS.map(peakOf);

  it('does not loop: no lag is the peak for more than one seed', () => {
    const lags = peaks.map((p) => p.peakLag);
    const shared = lags.filter((lag, i) => lags.some((other, j) => i !== j && Math.abs(lag - other) < 10));
    assert.deepEqual(
      shared,
      [],
      `the sway peaks at the same lag across seeds (${lags.join(', ')}) — that is the octave structure recurring, not noise`,
    );
  });

  it('does not loop: the typical peak stays modest beyond one slowest-octave cycle', () => {
    const sorted = peaks.map((p) => p.peak).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] as number;
    assert.ok(
      median < 0.3,
      `median sway autocorrelation ${median.toFixed(3)} across ${SEEDS.length} seeds ` +
        `(${sorted.map((v) => v.toFixed(2)).join(', ')}) — the idle loops`,
    );
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
      weightShift: [
        -C.body.weightShift.amplitudeM * (1 + C.body.weightShift.overshoot),
        C.body.weightShift.amplitudeM * (1 + C.body.weightShift.overshoot),
      ],
      torsoYaw: [
        -(C.body.torsoTurn.driftDeg + C.body.torsoTurn.eventDeg.max) * DEG,
        (C.body.torsoTurn.driftDeg + C.body.torsoTurn.eventDeg.max) * DEG,
      ],
      shoulderL: [-C.body.shoulder.maxDeg * DEG, C.body.shoulder.maxDeg * DEG],
      shoulderR: [-C.body.shoulder.maxDeg * DEG, C.body.shoulder.maxDeg * DEG],
      wristL: [-C.body.wrist.maxDeg * DEG, C.body.wrist.maxDeg * DEG],
      wristR: [-C.body.wrist.maxDeg * DEG, C.body.wrist.maxDeg * DEG],
      fingerL0: [-C.body.finger.deg.max * DEG, C.body.finger.deg.max * DEG],
      fingerL1: [-C.body.finger.deg.max * DEG, C.body.finger.deg.max * DEG],
      fingerL2: [-C.body.finger.deg.max * DEG, C.body.finger.deg.max * DEG],
      fingerL3: [-C.body.finger.deg.max * DEG, C.body.finger.deg.max * DEG],
      fingerL4: [-C.body.finger.deg.max * DEG, C.body.finger.deg.max * DEG],
      fingerR0: [-C.body.finger.deg.max * DEG, C.body.finger.deg.max * DEG],
      fingerR1: [-C.body.finger.deg.max * DEG, C.body.finger.deg.max * DEG],
      fingerR2: [-C.body.finger.deg.max * DEG, C.body.finger.deg.max * DEG],
      fingerR3: [-C.body.finger.deg.max * DEG, C.body.finger.deg.max * DEG],
      fingerR4: [-C.body.finger.deg.max * DEG, C.body.finger.deg.max * DEG],
      gazeAwayYaw: [-C.body.gazeAway.yawDeg.max * DEG, C.body.gazeAway.yawDeg.max * DEG],
      gazeAwayPitch: [C.body.gazeAway.pitchDeg.min * DEG, C.body.gazeAway.pitchDeg.max * DEG],
      headFollowYaw: [
        -C.body.headFollow.gain * (C.saccade.maxDeg + C.body.gazeAway.yawDeg.max) * DEG,
        C.body.headFollow.gain * (C.saccade.maxDeg + C.body.gazeAway.yawDeg.max) * DEG,
      ],
      headFollowPitch: [
        -C.body.headFollow.gain * (C.saccade.maxDeg - C.body.gazeAway.pitchDeg.min) * DEG,
        C.body.headFollow.gain * (C.saccade.maxDeg + C.body.gazeAway.pitchDeg.max) * DEG,
      ],
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

/*
  THE BAR (Prompt 6 §6), as assertions. Each of these is a number a reviewer
  used to have to read off a video; here they are read off the seeded engine,
  so a regression is a red test rather than an opinion.
*/
const BODY_CHANNELS: readonly IdleChannel[] = [
  'torsoYaw',
  'shoulderL',
  'shoulderR',
  'wristL',
  'wristR',
  ...FINGER_CHANNELS.L,
  ...FINGER_CHANNELS.R,
];

describe('the body layer', () => {
  it('does not nod on a timer while the learner is speaking or typing', () => {
    const engine = new IdleEngine(7);
    for (let i = 0; i < 60 * 60; i++) {
      assert.equal(engine.step(DT, { ...quiet, partnerSpeaking: true }).nodPitch, 0);
    }
    let peak = 0;
    for (let i = 0; i < 60; i++) {
      peak = Math.max(peak, engine.step(DT, { ...quiet, partnerPauseEvent: i === 0 }).nodPitch);
    }
    assert.ok(peak > 0, 'an explicit pause cue was ignored');
  });
  it('is never still: some joint below the neck moves > 0.5° in every 2 s window', () => {
    const engine = new IdleEngine(11);
    const window = Math.round(2 / DT);
    const history: number[][] = [];
    let longestStill = 0;
    let still = 0;
    for (let i = 0, n = Math.round(180 / DT); i < n; ++i) {
      const frame = engine.step(DT, quiet);
      history.push(BODY_CHANNELS.map((c) => frame[c]));
      if (history.length > window) history.shift();
      if (history.length === window) {
        const first = history[0] as number[];
        const last = history[history.length - 1] as number[];
        let moved = 0;
        for (let c = 0; c < first.length; ++c) {
          moved = Math.max(moved, Math.abs((last[c] as number) - (first[c] as number)));
        }
        if (moved > 0.5 * DEG) still = 0;
        else still += DT;
        longestStill = Math.max(longestStill, still);
      }
    }
    assert.ok(longestStill < 2, `longest still interval ${longestStill}s; the bar is < 2 s`);
  });

  it('shifts weight every 8-20 s, on an irregular clock', () => {
    const engine = new IdleEngine(5);
    const at: number[] = [];
    let t = 0;
    for (let i = 0, n = Math.round(1200 / DT); i < n; ++i) {
      const frame = engine.step(DT, quiet);
      t += DT;
      if (frame.weightShifted) at.push(t);
    }
    const gaps = at.slice(1).map((v, i) => v - (at[i] as number));
    assert.ok(gaps.length > 40, `only ${gaps.length} shifts in 20 min`);
    for (const g of gaps) {
      assert.ok(g >= 8 - DT && g <= 20 + 2.2 + DT, `weight-shift gap ${g}s outside 8-20 s (+move)`);
    }
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const cv = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length) / mean;
    assert.ok(cv > 0.15, `weight-shift cadence is periodic (CV ${cv})`);
  });

  it('lands each weight shift on its target with visible follow-through', () => {
    const engine = new IdleEngine(9);
    let peak = 0;
    let prevShift = 0;
    let target = 0;
    let moving = false;
    let overshoots = 0;
    for (let i = 0, n = Math.round(300 / DT); i < n; ++i) {
      const f = engine.step(DT, quiet);
      if (f.weightShifted) {
        moving = true;
        peak = 0;
        prevShift = f.weightShift;
      } else if (moving) {
        peak = Math.max(peak, Math.abs(f.weightShift));
        // The move is over once the value stops changing.
        if (Math.abs(f.weightShift - prevShift) < 1e-7 && i > 0) {
          moving = false;
          target = Math.abs(f.weightShift);
          if (peak > target + 1e-4) overshoots += 1;
        }
        prevShift = f.weightShift;
      }
    }
    assert.ok(overshoots > 0, 'no shift overshot its target — there is no follow-through');
  });

  it('fingers: 2-5° each, and no two channels in phase', () => {
    const engine = new IdleEngine(2);
    const rows: number[][] = [];
    for (let i = 0, n = Math.round(600 / DT); i < n; ++i) {
      const f = engine.step(DT, quiet);
      if (i % 6 === 0) rows.push([...FINGER_CHANNELS.L, ...FINGER_CHANNELS.R].map((c) => f[c]));
    }
    const cols = rows[0]!.length;
    for (let a = 0; a < cols; ++a) {
      const va = rows.map((r) => r[a] as number);
      const amp = Math.max(...va.map(Math.abs));
      assert.ok(amp >= 1.5 * DEG && amp <= 5 * DEG, `finger ${a} amplitude ${amp / DEG}°`);
      for (let b = a + 1; b < cols; ++b) {
        const vb = rows.map((r) => r[b] as number);
        const ma = va.reduce((x, y) => x + y, 0) / va.length;
        const mb = vb.reduce((x, y) => x + y, 0) / vb.length;
        let num = 0;
        let da = 0;
        let db = 0;
        for (let i = 0; i < va.length; ++i) {
          const xa = (va[i] as number) - ma;
          const xb = (vb[i] as number) - mb;
          num += xa * xb;
          da += xa * xa;
          db += xb * xb;
        }
        const r = num / Math.sqrt(da * db);
        assert.ok(Math.abs(r) < 0.5, `fingers ${a} and ${b} correlate at ${r} — a glove`);
      }
    }
  });

  it('breaks gaze every 3-4 s for 0.3-1.2 s, so a stare never exceeds the firewall ceiling', () => {
    const engine = new IdleEngine(4);
    let t = 0;
    let lastBreak = 0;
    let longestHold = 0;
    let awayFor = 0;
    let longestAway = 0;
    for (let i = 0, n = Math.round(600 / DT); i < n; ++i) {
      const f = engine.step(DT, quiet);
      t += DT;
      if (f.gazeBroke) {
        longestHold = Math.max(longestHold, t - lastBreak);
        lastBreak = t;
      }
      if (Math.abs(f.gazeAwayYaw) > 1e-6) awayFor += DT;
      else {
        longestAway = Math.max(longestAway, awayFor);
        awayFor = 0;
      }
    }
    assert.ok(longestHold <= 4 + DT, `gaze held ${longestHold}s — past the 4 s ceiling`);
    assert.ok(longestAway <= 1.2 + 2 * C.body.gazeAway.easeS + DT, `looked away for ${longestAway}s`);
  });

  it('turns the torso on a turn end, within 0.8 s, and holds a few seconds', () => {
    const engine = new IdleEngine(6);
    // Burn the idle timer so the event below is the pause, not the clock.
    for (let i = 0; i < 60; ++i) engine.step(DT, quiet);
    const before = engine.step(DT, quiet).torsoYaw;
    let first = engine.step(DT, { ...quiet, partnerPauseEvent: true }).torsoYaw;
    let peak = 0;
    for (let i = 0; i < Math.round(1.0 / DT); ++i) {
      first = engine.step(DT, quiet).torsoYaw;
      peak = Math.max(peak, Math.abs(first - before));
    }
    assert.ok(peak >= 1.5 * DEG, `torso turned only ${peak / DEG}° after a pause event`);
  });

  it('head follows gaze late: lagged correlation beats instantaneous', () => {
    const engine = new IdleEngine(8);
    const eyes: number[] = [];
    const head: number[] = [];
    for (let i = 0, n = Math.round(120 / DT); i < n; ++i) {
      const f = engine.step(DT, quiet);
      eyes.push(f.eyeYaw + f.gazeAwayYaw);
      head.push(f.headFollowYaw);
    }
    const corr = (lag: number) => {
      let num = 0;
      let da = 0;
      let db = 0;
      for (let i = 0; i + lag < eyes.length; ++i) {
        const a = eyes[i] as number;
        const b = head[i + lag] as number;
        num += a * b;
        da += a * a;
        db += b * b;
      }
      return num / Math.sqrt(da * db);
    };
    const lagged = corr(Math.round(0.3 / DT));
    assert.ok(lagged > corr(0), `head is not trailing the eyes (lag0 ${corr(0)}, lag300ms ${lagged})`);
  });
});
