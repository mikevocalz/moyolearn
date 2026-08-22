/**
 * The deterministic idle layer: breath, postural sway, gaze drift, saccades,
 * a blink hazard model, backchannel nods, and pre-speech anticipation. Pure
 * `step(dt, inputs)` over one seeded `mulberry32` — that purity is what makes
 * the whole avatar golden-image testable, so it is load-bearing, not stylistic.
 *
 * Reduced motion (doc 22 §7) is applied by the CALLER holding the engine still,
 * never by mutating these constants — a still avatar must be provably still.
 *
 * Ported verbatim from the gnm-avatar reference renderer (`src/idle/engine.ts`).
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2, §7
 * SOT-KEYWORDS: idle engine deterministic seeded mulberry32 blink saccade breath sway backchannel
 */

/**
 * Deterministic idle/listening engine (§10, §13). Pure step(dt, inputs) →
 * channel outputs; one seeded PRNG, no wall-clock, constructible headless.
 * Rotations are radians, positions meters. Same seed → bit-identical outputs.
 */
import { idleConfig, type Range } from './config.ts';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEG = Math.PI / 180;
const smooth = (f: number) => f * f * (3 - 2 * f);
const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

export interface IdleInputs {
  speechActive: boolean;
  speechGap: boolean;
  processing: boolean;
  partnerSpeaking: boolean;
  partnerPauseEvent: boolean;
  partnerF0Falling: boolean;
  /** Seconds until scheduled TTS onset; Infinity when none scheduled. */
  timeUntilOnset: number;
}

export const IDLE_CHANNELS = [
  'breathY',
  'breathPitch',
  'swayX',
  'swayY',
  'driftYaw',
  'driftPitch',
  'nodPitch',
  'eyeYaw',
  'eyePitch',
  'eyeBlinkLeft',
  'eyeBlinkRight',
  'eyesWide',
] as const;
export type IdleChannel = (typeof IDLE_CHANNELS)[number];

export type IdleFrame = { [K in IdleChannel]: number } & {
  blinkStarted: boolean;
  saccadeStarted: boolean;
  anticipated: boolean;
  gains: { breath: number; sway: number; drift: number };
};

/** Band-limited value noise with jittered cell spans (never loops). */
class ValueNoise {
  private t = 0;
  private span: number;
  private v0: number;
  private v1: number;
  // Explicit fields, not constructor parameter properties: this package is
  // typechecked with `erasableSyntaxOnly` because `node --test` runs the
  // TypeScript directly through Node's type stripping, which cannot emit the
  // assignments a parameter property implies.
  private hz: number;
  private rand: () => number;

  constructor(hz: number, rand: () => number) {
    this.hz = hz;
    this.rand = rand;
    this.v0 = rand() * 2 - 1;
    this.v1 = rand() * 2 - 1;
    this.span = this.draw();
  }

  private draw() {
    return (0.75 + 0.5 * this.rand()) / this.hz;
  }

  step(dt: number): number {
    this.t += dt;
    while (this.t >= this.span) {
      this.t -= this.span;
      this.v0 = this.v1;
      this.v1 = this.rand() * 2 - 1;
      this.span = this.draw();
    }
    return this.v0 + (this.v1 - this.v0) * smooth(this.t / this.span);
  }
}

export class IdleEngine {
  readonly seed: number;
  private rand: () => number;

  private breathPhase = 0;
  private breathPeriod: number;
  private breathBoost = 1;

  // Tuples, not arrays: there are exactly two sway axes per octave and
  // exactly two drift axes (yaw, pitch). Typing the arity makes the pair
  // destructuring below total instead of a possibly-undefined index read.
  private swayNoise: [ValueNoise, ValueNoise][];
  private driftNoise: [ValueNoise, ValueNoise];

  private blinkState: 0 | 1 | 2 = 0; // idle | closing | opening
  private blinkT = 0;
  private blinkRefractory = 0;
  private forcedBlinkIn = Infinity;
  private sinceSaccade = Infinity;

  private localYaw = 0;
  private localPitch = 0;
  private sacVy = 0;
  private sacVp = 0;
  private saccadeLeft = 0;
  private saccadeIn: number;
  private centerYaw = 0;
  private centerPitch = 0;

  private nodT = Infinity;
  private nodAmp = 0;
  private nodRefractory = 0;
  private partnerSpeakT = 0;
  private wasPartnerSpeaking = false;
  private nodTimerAt: number;

  private anticipationArmed = false;
  private anticipationFired = false;
  private anticipationLead = 0;
  private lastTimeUntilOnset = Infinity;
  private wideT = Infinity;

  private frame: IdleFrame = {
    breathY: 0,
    breathPitch: 0,
    swayX: 0,
    swayY: 0,
    driftYaw: 0,
    driftPitch: 0,
    nodPitch: 0,
    eyeYaw: 0,
    eyePitch: 0,
    eyeBlinkLeft: 0,
    eyeBlinkRight: 0,
    eyesWide: 0,
    blinkStarted: false,
    saccadeStarted: false,
    anticipated: false,
    gains: { breath: 1, sway: 1, drift: 1 },
  };

  constructor(seed: number = idleConfig.seed) {
    this.seed = seed;
    this.rand = mulberry32(seed);
    // Fixed construction order keeps the PRNG stream stable across runs.
    this.swayNoise = idleConfig.sway.octaves.map(
      (o): [ValueNoise, ValueNoise] => [
        new ValueNoise(o.hz, this.rand),
        new ValueNoise(o.hz, this.rand),
      ]
    );
    this.driftNoise = [
      new ValueNoise(idleConfig.drift.hz, this.rand),
      new ValueNoise(idleConfig.drift.hz, this.rand),
    ];
    this.breathPeriod = 1 / this.range(idleConfig.breath.rateHz);
    this.saccadeIn = this.range(idleConfig.saccade.intervalS);
    this.nodTimerAt = this.range(idleConfig.nod.speechTimerS);
  }

  private range(r: Range) {
    return r.min + (r.max - r.min) * this.rand();
  }

  step(dt: number, inputs: IdleInputs): IdleFrame {
    const C = idleConfig;
    const F = this.frame;
    F.blinkStarted = false;
    F.saccadeStarted = false;
    F.anticipated = false;

    // -- anticipation: fire at onset − U(leadS) --
    const tuo = inputs.timeUntilOnset;
    if (Number.isFinite(tuo)) {
      if (!this.anticipationArmed || tuo > this.lastTimeUntilOnset + 0.2) {
        this.anticipationArmed = true;
        this.anticipationFired = false;
        this.anticipationLead = this.range(C.anticipation.leadS);
      }
      if (!this.anticipationFired && tuo <= this.anticipationLead) {
        this.anticipationFired = true;
        F.anticipated = true;
        this.wideT = 0;
        this.breathPhase = 0; // breath intake
        this.breathBoost = C.breath.anticipationBoost;
      }
    } else {
      this.anticipationArmed = false;
      this.anticipationFired = false;
    }
    this.lastTimeUntilOnset = tuo;

    // -- breathing: never stops; asymmetric inhale/exhale --
    this.breathPhase += dt / this.breathPeriod;
    if (this.breathPhase >= 1) {
      this.breathPhase %= 1;
      this.breathPeriod = 1 / this.range(C.breath.rateHz);
      this.breathBoost = 1;
    }
    const inF = C.breath.inhaleFraction;
    const p = this.breathPhase;
    const lung =
      p < inF ? smooth(p / inF) : 1 - smooth((p - inF) / (1 - inF));
    F.breathY = (lung - 0.5) * C.breath.bobM * this.breathBoost;
    F.breathPitch = (lung - 0.5) * C.breath.pitchDeg * DEG;

    // -- postural sway: two incommensurate noise octaves --
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < this.swayNoise.length; ++i) {
      // Hoisted rather than indexed inline: the two arrays are built together
      // from C.sway.octaves, so a length mismatch is a construction bug and
      // should surface here, not as a silent NaN in the sway signal.
      const octave = C.sway.octaves[i];
      const pair = this.swayNoise[i];
      if (!octave || !pair) continue;
      const [noiseX, noiseY] = pair;
      sx += octave.weight * noiseX.step(dt);
      sy += octave.weight * noiseY.step(dt);
    }
    F.swayX = sx * C.sway.amplitudeM;
    F.swayY = sy * C.sway.amplitudeM;

    // -- micro head drift --
    const driftGain = inputs.speechActive ? C.drift.speechGain : 1;
    const [driftYawNoise, driftPitchNoise] = this.driftNoise;
    F.driftYaw = driftYawNoise.step(dt) * C.drift.maxDeg * DEG * driftGain;
    F.driftPitch =
      driftPitchNoise.step(dt) * C.drift.maxDeg * DEG * driftGain;

    // -- gaze center: avert while processing, return on anticipation/speech --
    const averted =
      inputs.processing && !this.anticipationFired && !inputs.speechActive;
    const k = 1 - Math.exp(-dt / C.gaze.easeTauS);
    this.centerYaw += ((averted ? C.gaze.aversionYawDeg : 0) - this.centerYaw) * k;
    this.centerPitch +=
      ((averted ? C.gaze.aversionPitchDeg : 0) - this.centerPitch) * k;

    // -- saccades: ballistic, eye joints only, conjugate --
    if (this.saccadeLeft > 0) {
      const d = Math.min(dt, this.saccadeLeft);
      this.localYaw += this.sacVy * d;
      this.localPitch += this.sacVp * d;
      this.saccadeLeft -= d;
    } else {
      this.saccadeIn -= dt;
      if (this.saccadeIn <= 0) {
        const box = inputs.speechActive
          ? C.saccade.speechBoxDeg
          : C.saccade.fixationBoxDeg;
        const ty = (this.rand() * 2 - 1) * box;
        const tp = (this.rand() * 2 - 1) * box;
        this.sacVy = (ty - this.localYaw) / C.saccade.durationS;
        this.sacVp = (tp - this.localPitch) / C.saccade.durationS;
        this.saccadeLeft = C.saccade.durationS;
        this.saccadeIn = this.range(C.saccade.intervalS);
        this.sinceSaccade = 0;
        F.saccadeStarted = true;
      }
    }
    this.sinceSaccade += dt;
    const maxE = C.saccade.maxDeg;
    F.eyeYaw = clamp(this.centerYaw + this.localYaw, -maxE, maxE) * DEG;
    F.eyePitch = clamp(this.centerPitch + this.localPitch, -maxE, maxE) * DEG;

    // -- blink: hazard model, clustered at speech gaps + after gaze shifts --
    this.blinkRefractory -= dt;
    this.forcedBlinkIn -= dt;
    let blink = 0;
    if (this.blinkState === 1) {
      this.blinkT += dt;
      if (this.blinkT >= C.blink.closeS) {
        this.blinkState = 2;
        this.blinkT = 0;
        blink = 1;
      } else {
        blink = smooth(this.blinkT / C.blink.closeS);
      }
    } else if (this.blinkState === 2) {
      this.blinkT += dt;
      if (this.blinkT >= C.blink.openS) {
        this.blinkState = 0;
        this.blinkRefractory = C.blink.refractoryS;
        if (this.rand() < C.blink.doubleP) {
          this.forcedBlinkIn = C.blink.doubleDelayS;
        }
      } else {
        blink = 1 - smooth(this.blinkT / C.blink.openS);
      }
    } else {
      let fire = false;
      if (this.forcedBlinkIn <= 0) {
        fire = true;
        this.forcedBlinkIn = Infinity;
      } else if (this.blinkRefractory <= 0) {
        let hazard = C.blink.baseHazard;
        if (inputs.speechGap) hazard *= C.blink.gapBoost;
        if (this.sinceSaccade < C.blink.postSaccadeWindowS) {
          hazard *= C.blink.postSaccadeBoost;
        }
        if (this.rand() < hazard * dt) fire = true;
      }
      if (fire) {
        this.blinkState = 1;
        this.blinkT = 0;
        F.blinkStarted = true;
      }
    }
    F.eyeBlinkLeft = blink;
    F.eyeBlinkRight = blink;

    // -- backchannel nods --
    this.nodRefractory -= dt;
    let timerFired = false;
    if (inputs.partnerSpeaking) {
      if (!this.wasPartnerSpeaking) {
        this.partnerSpeakT = 0;
        this.nodTimerAt = this.range(C.nod.speechTimerS);
      }
      this.partnerSpeakT += dt;
      if (this.partnerSpeakT >= this.nodTimerAt) {
        timerFired = true;
        this.nodTimerAt = this.partnerSpeakT + this.range(C.nod.speechTimerS);
      }
    }
    this.wasPartnerSpeaking = inputs.partnerSpeaking;
    const nodTotal = C.nod.nodS * C.nod.count;
    if (
      (inputs.partnerPauseEvent || inputs.partnerF0Falling || timerFired) &&
      this.nodRefractory <= 0 &&
      !(this.nodT < nodTotal)
    ) {
      this.nodT = 0;
      this.nodAmp = this.range(C.nod.pitchDeg) * DEG;
      this.nodRefractory = C.nod.refractoryS + nodTotal;
    }
    if (this.nodT < nodTotal) {
      F.nodPitch =
        this.nodAmp * Math.sin(Math.PI * ((this.nodT % C.nod.nodS) / C.nod.nodS));
      this.nodT += dt;
    } else {
      F.nodPitch = 0;
    }

    // -- anticipation eyesWide envelope --
    if (this.wideT < C.anticipation.decayS) {
      const a = C.anticipation.attackS;
      const t = this.wideT;
      F.eyesWide =
        C.anticipation.eyesWide *
        (t < a ? t / a : 1 - (t - a) / (C.anticipation.decayS - a));
      this.wideT += dt;
    } else {
      F.eyesWide = 0;
    }

    F.gains.breath = this.breathBoost;
    F.gains.sway = 1;
    F.gains.drift = driftGain;
    return F;
  }
}
