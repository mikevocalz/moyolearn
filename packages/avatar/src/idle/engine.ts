/**
 * The deterministic idle layer: breath, postural sway, gaze drift, saccades,
 * a blink hazard model, backchannel nods, and pre-speech anticipation. Pure
 * `step(dt, inputs)` over one seeded `mulberry32` — that purity is what makes
 * the whole avatar golden-image testable, so it is load-bearing, not stylistic.
 *
 * Reduced motion (doc 22 §7) is applied by the CALLER holding the engine still,
 * never by mutating these constants — a still avatar must be provably still.
 *
 * Ported verbatim from the gnm-avatar reference renderer (`src/idle/engine.ts`),
 * then extended below the neck (ADR-113): weight shifts, torso turns,
 * shoulders, wrists, a per-hand relaxation scalar, gaze breaks and head-follow. Every
 * new channel draws from the SAME seeded stream, in a fixed construction order,
 * so the golden harness keeps its "same seed → bit-identical" contract.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2, §7 · docs/decisions/adr-113-body-motion-layer.md
 * SOT-KEYWORDS: idle engine deterministic seeded mulberry32 blink saccade breath sway backchannel weight shift fingers torso gaze away head follow
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
  /**
   * The utterance's amplitude envelope, 0..1 — the energy of HER OWN synthetic
   * voice, never the child's audio (life-layer: every motion has a cause, and
   * this cause is hers). Continuous where `speechActive` is binary: the torso
   * and shoulder ambient amplitudes ride it, never above their config
   * ceilings. Omitted, the modulation is fully disengaged and every channel
   * is bit-identical to the pre-energy engine (torsoEnergyCorrelation
   * finding, 8e62c1b).
   */
  speechEnergy?: number;
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
  // ---- the body layer (ADR-113). Radians unless named otherwise. ----
  /** Lateral hip travel, metres. Positive = weight on the character's left. */
  'weightShift',
  'torsoYaw',
  'shoulderL',
  'shoulderR',
  'wristL',
  'wristR',
  'handRelaxL',
  'handRelaxR',
  /** A momentary look away from the lens, added on top of the saccade. */
  'gazeAwayYaw',
  'gazeAwayPitch',
  /** The head trailing the eyes. */
  'headFollowYaw',
  'headFollowPitch',
] as const;
export type IdleChannel = (typeof IDLE_CHANNELS)[number];

export type IdleFrame = { [K in IdleChannel]: number } & {
  blinkStarted: boolean;
  /**
   * True on the frame a breath cycle begins. Mirrors `blinkStarted`, and it
   * exists because the channel was otherwise unmeasurable: the interval between
   * zero-crossings of `breathY` spans parts of two consecutive cycles, so it
   * averages their periods and reads back less variation than was generated
   * (15% drawn, 12.3% measured that way). A cycle boundary is the only place
   * the real period is observable.
   */
  breathStarted: boolean;
  saccadeStarted: boolean;
  anticipated: boolean;
  /** A weight transfer began this frame. */
  weightShifted: boolean;
  /** Gaze left the lens this frame. */
  gazeBroke: boolean;
  gains: { breath: number; sway: number; drift: number };
};

/** Finger channels in hand order: thumb, index, middle, ring, pinky. */
/**
 * One channel per HAND. There is no per-finger channel and there must not be:
 * ten independent noises read as fidgeting (PR #31) and a hand's digits are not
 * independently controlled anyway. The writer turns this scalar into ten angles
 * through a fixed gradient.
 */
export const HAND_CHANNELS = {
  L: 'handRelaxL',
  R: 'handRelaxR',
} as const satisfies Record<'L' | 'R', IdleChannel>;

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
  /** This session's resting rate. Fixed; only the individual cycles vary. */
  private breathMeanPeriod: number;
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

  // ---- body layer state ----
  private shiftFrom = 0;
  private shiftTo = 0;
  private shiftT = Infinity;
  private shiftMoveS = 1;
  private shiftIn: number;
  private torsoNoise: ValueNoise;
  private turnIn: number;
  private turnAmp = 0;
  private turnT = Infinity;
  private turnHoldS = 0;
  private shoulderNoise: [ValueNoise, ValueNoise];
  /** The energy octaves: [torso, shoulderL, shoulderR]. Own stream (below). */
  private energyFastNoise: [ValueNoise, ValueNoise, ValueNoise];
  /** Eased `speechEnergy` (config tauS) — steps in the envelope never pop. */
  private energyEased = 0;
  /** Eased 0/1 for "the input is wired" — so wiring it mid-run cannot pop either. */
  private energyEngage = 0;
  private wristNoise: [ValueNoise, ValueNoise];
  // Two octaves per hand: [L-slow, L-fast, R-slow, R-fast].
  private handNoise: [ValueNoise, ValueNoise, ValueNoise, ValueNoise];
  /** Where each hand is settling FROM, TO, and how far through it is. */
  private handFrom: [number, number] = [0, 0];
  private handTo: [number, number];
  private handT: [number, number] = [1, 1];
  private handMoveS: [number, number] = [1, 1];
  private awayIn: number;
  private awayT = Infinity;
  private awayHoldS = 0;
  private awayYaw = 0;
  private awayPitch = 0;
  private followYaw = 0;
  private followPitch = 0;
  /**
   * The body layer draws from its OWN stream, derived from the seed. A shared
   * stream would interleave its draws with the head's during `step`, and a
   * seed that produced a given face before ADR-113 would produce a different
   * one after it — every head golden would need re-approval for adding a body.
   */
  private bodyRand: () => number;

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
    weightShift: 0,
    torsoYaw: 0,
    shoulderL: 0,
    shoulderR: 0,
    wristL: 0,
    wristR: 0,
    handRelaxL: 0,
    handRelaxR: 0,
    gazeAwayYaw: 0,
    gazeAwayPitch: 0,
    headFollowYaw: 0,
    headFollowPitch: 0,
    blinkStarted: false,
    breathStarted: false,
    saccadeStarted: false,
    anticipated: false,
    weightShifted: false,
    gazeBroke: false,
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
    this.breathMeanPeriod = 1 / this.range(idleConfig.breath.rateHz);
    /*
      The first cycle runs at the mean, unjittered, and that is deliberate: it
      consumes no extra draw. Every ValueNoise shares this seeded stream and
      pulls from it lazily during `step`, so one additional draw here shifts
      every other channel's phase for the whole run — it moved the sway
      autocorrelation from just under its 0.25 ceiling to just over, in a change
      that had nothing to do with sway. Per-cycle jitter replaces the old
      per-cycle rate draw one for one, so the stream stays where it was.
    */
    this.breathPeriod = this.breathMeanPeriod;
    this.saccadeIn = this.range(idleConfig.saccade.intervalS);
    // Preserve the seeded face stream across removal of the periodic nod.
    this.range(idleConfig.nod.speechTimerS);

    const B = idleConfig.body;
    this.bodyRand = mulberry32((seed ^ 0xb0d7) >>> 0);
    this.shiftIn = this.sampleShiftInterval();
    this.torsoNoise = new ValueNoise(B.torsoTurn.hz, this.bodyRand);
    this.turnIn = this.bodyRange(B.torsoTurn.eventIntervalS);
    this.shoulderNoise = [
      new ValueNoise(B.shoulder.hz, this.bodyRand),
      new ValueNoise(B.shoulder.hz, this.bodyRand),
    ];
    /*
      torsoEnergyCorrelation (8e62c1b): the fast octaves the speech-energy
      modulation mixes in. Their OWN derived stream, consuming nothing from
      `rand` or `bodyRand`: constructing them on either existing stream would
      shift every later draw and re-roll every golden — the same isolation
      argument that created `bodyRand`. They are stepped every frame whether
      or not `speechEnergy` is wired, so time advances identically either way.
    */
    const energyRand = mulberry32((seed ^ 0xe4e6) >>> 0);
    this.energyFastNoise = [
      new ValueNoise(B.speechEnergy.fastHz, energyRand),
      new ValueNoise(B.speechEnergy.fastHz, energyRand),
      new ValueNoise(B.speechEnergy.fastHz, energyRand),
    ];
    this.wristNoise = [
      new ValueNoise(B.wrist.hz, this.bodyRand),
      new ValueNoise(B.wrist.hz, this.bodyRand),
    ];
    // Two hands, two rates. They differ so the pair never settles into unison,
    // which is the same reason the sway octaves sit at an irrational ratio.
    /*
      TWO octaves per hand, at the sway's irrational ratio. One slow noise can
      sit near a flat cell for ten straight seconds — measured: 0.004 of travel
      in a 10 s window, which is a frozen hand wearing a moving channel's name.
      A second octave at e times the rate cannot flatline with the first.
    */
    this.handNoise = [
      new ValueNoise(this.bodyRange(B.hand.hz), this.bodyRand),
      new ValueNoise(this.bodyRange(B.hand.hz) * Math.E, this.bodyRand),
      new ValueNoise(this.bodyRange(B.hand.hz), this.bodyRand),
      new ValueNoise(this.bodyRange(B.hand.hz) * Math.E, this.bodyRand),
    ];
    this.handTo = [this.bodyRange(B.hand.settle), this.bodyRange(B.hand.settle)];
    this.handFrom = [this.handTo[0] as number, this.handTo[1] as number];
    this.awayIn = this.bodyRange(B.gazeAway.intervalS);
  }

  /**
   * The next inter-shift gap, drawn to match the measured distribution's
   * shape rather than a uniform band. Half the draws land between p10 and the
   * median, half between the median and p90 — a two-piece approximation of a
   * skewed distribution that a uniform range cannot represent: uniform over
   * the same span would put the TYPICAL gap near 11 s where people measure 5.9.
   */
  private sampleShiftInterval(): number {
    return this.samplePercentiles(idleConfig.body.weightShift.intervalPercentilesS);
  }

  /** Two-piece draw matching a skewed measured distribution's p10/p50/p90. */
  private samplePercentiles(p: { p10: number; p50: number; p90: number }): number {
    const u = this.bodyRand();
    return u < 0.5 ? p.p10 + (u * 2) * (p.p50 - p.p10) : p.p50 + (u - 0.5) * 2 * (p.p90 - p.p50);
  }

  /**
   * The next breath, jittered around this session's mean. Drawn from the same
   * seeded stream as everything else, so a run stays reproducible.
   */
  private jitteredBreathPeriod(): number {
    const j = idleConfig.breath.periodJitter;
    return this.breathMeanPeriod * (1 + this.range({ min: -j, max: j }));
  }

  private range(r: Range) {
    return r.min + (r.max - r.min) * this.rand();
  }

  private bodyRange(r: Range) {
    return r.min + (r.max - r.min) * this.bodyRand();
  }

  step(dt: number, inputs: IdleInputs): IdleFrame {
    const C = idleConfig;
    const F = this.frame;
    F.blinkStarted = false;
    F.saccadeStarted = false;
    F.anticipated = false;
    F.weightShifted = false;
    F.gazeBroke = false;

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
    F.breathStarted = false;
    this.breathPhase += dt / this.breathPeriod;
    if (this.breathPhase >= 1) {
      F.breathStarted = true;
      this.breathPhase %= 1;
      this.breathPeriod = this.jitteredBreathPeriod();
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
    // Listening is not a metronome. Only an observed conversational cue can
    // start an acknowledgement; typing for a long time does not imply assent.
    const nodTotal = C.nod.nodS * C.nod.count;
    if (
      (inputs.partnerPauseEvent || inputs.partnerF0Falling) &&
      !inputs.speechActive &&
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

    // ================= the body layer (ADR-113) =================
    const B = C.body;

    /*
      -- speech energy (torsoEnergyCorrelation, 8e62c1b) --
      Two eased followers: the envelope itself (ê), and an engage 0/1 (g) for
      whether the input is wired at all. They drive the torso/shoulder noise:

        value = amp · ((1 − m) · scale · slow  +  m · fast)
        scale = 1 − (1 − quietScale) · g · (1 − ê)      — quiet speech sits lower
        m     = fastMix · g · ê²                        — the energy octave, loud only

      BOUNDS PROOF, so the channel-envelope test holds without touching its
      numbers: |slow| ≤ 1, |fast| ≤ 1, scale ∈ (0, 1], m ∈ [0, 1], so
      |(1 − m)·scale·slow + m·fast| ≤ (1 − m) + m = 1 and the channel never
      exceeds the amp the config already declares. ê² rather than ê so the
      residual envelope in a short inter-phrase gap buys almost no fast
      motion — the gaps are what make the correlation readable.

      Unwired, g stays 0: scale is exactly 1, m exactly 0, and the fast
      noises are stepped regardless — so the output is bit-identical to the
      pre-energy engine, draw for draw.
    */
    const E = B.speechEnergy;
    const kEnergy = 1 - Math.exp(-dt / E.tauS);
    const energyWired = inputs.speechEnergy !== undefined;
    this.energyEngage += ((energyWired ? 1 : 0) - this.energyEngage) * kEnergy;
    this.energyEased +=
      ((energyWired ? clamp(inputs.speechEnergy as number, 0, 1) : 0) - this.energyEased) * kEnergy;
    const energyScale = 1 - (1 - E.quietScale) * this.energyEngage * (1 - this.energyEased);
    const energyMix = E.fastMix * this.energyEngage * this.energyEased * this.energyEased;
    const [energyFastTorso, energyFastShL, energyFastShR] = this.energyFastNoise;
    const fastTorso = energyFastTorso.step(dt);
    const fastShL = energyFastShL.step(dt);
    const fastShR = energyFastShR.step(dt);

    // -- weight shift: a discrete transfer, eased, with follow-through --
    this.shiftIn -= dt;
    if (this.shiftIn <= 0 && !(this.shiftT < this.shiftMoveS)) {
      // The new stance is at least half the range away from the old one, or
      // it would not read as a shift at all.
      let to = (this.bodyRand() * 2 - 1) * B.weightShift.amplitudeM;
      if (Math.abs(to - this.shiftTo) < B.weightShift.amplitudeM * 0.5) {
        to = this.shiftTo > 0 ? -B.weightShift.amplitudeM * (0.5 + 0.5 * this.bodyRand())
                              : B.weightShift.amplitudeM * (0.5 + 0.5 * this.bodyRand());
      }
      this.shiftFrom = F.weightShift;
      this.shiftTo = to;
      this.shiftT = 0;
      this.shiftMoveS = this.bodyRange(B.weightShift.moveS);
      this.shiftIn = this.sampleShiftInterval();
      F.weightShifted = true;
    }
    if (this.shiftT < this.shiftMoveS) {
      this.shiftT += dt;
      const u = clamp(this.shiftT / this.shiftMoveS, 0, 1);
      // Follow-through rides on sin(πu)·u³: zero at both ends, so the pose
      // lands exactly on the target; peaked near u≈0.9 so the body goes a
      // little past the new stance and settles back — settle, not lurch.
      const ease = smooth(u) + 4 * B.weightShift.overshoot * Math.sin(Math.PI * u) * u * u * u;
      F.weightShift = this.shiftFrom + (this.shiftTo - this.shiftFrom) * ease;
    }

    // -- torso turn: slow wander plus a held turn on a turn end or a timer --
    this.turnIn -= dt;
    if (
      (inputs.partnerPauseEvent || this.turnIn <= 0) &&
      !(this.turnT < this.turnHoldS + 2 * B.torsoTurn.easeS)
    ) {
      this.turnAmp = (this.bodyRand() < 0.5 ? -1 : 1) * this.bodyRange(B.torsoTurn.eventDeg) * DEG;
      this.turnHoldS = this.bodyRange(B.torsoTurn.holdS);
      this.turnT = 0;
      this.turnIn = this.bodyRange(B.torsoTurn.eventIntervalS);
    }
    let turn = 0;
    if (this.turnT < this.turnHoldS + 2 * B.torsoTurn.easeS) {
      const e = B.torsoTurn.easeS;
      const t = this.turnT;
      const env = t < e ? smooth(t / e) : t < e + this.turnHoldS ? 1 : 1 - smooth((t - e - this.turnHoldS) / e);
      turn = this.turnAmp * env;
      this.turnT += dt;
    }
    /*
      The DRIFT rides the energy; the held event turn does not. Scaling `turn`
      would make a held posture wobble with the voice — two systems fighting
      over one joint. The convex-mix bound above keeps the noise part inside
      the driftDeg the envelope test asserts.
    */
    F.torsoYaw =
      ((1 - energyMix) * energyScale * this.torsoNoise.step(dt) + energyMix * fastTorso) *
        B.torsoTurn.driftDeg *
        DEG +
      turn;

    // -- shoulders, wrists, fingers: independent band-limited noise --
    const [shL, shR] = this.shoulderNoise;
    F.shoulderL =
      ((1 - energyMix) * energyScale * shL.step(dt) + energyMix * fastShL) * B.shoulder.maxDeg * DEG;
    F.shoulderR =
      ((1 - energyMix) * energyScale * shR.step(dt) + energyMix * fastShR) * B.shoulder.maxDeg * DEG;
    const [wrL, wrR] = this.wristNoise;
    F.wristL = wrL.step(dt) * B.wrist.maxDeg * DEG;
    F.wristR = wrR.step(dt) * B.wrist.maxDeg * DEG;
    /*
      The hand relaxation scalar: a held settle value that steps on a posture
      change, plus a slow drift so it is never actually still. Clamped to 0..1
      because the writer reads it as a fraction of a curl range.
    */
    /*
      A posture change RE-SETTLES the hand; it does not teleport it. Swapping
      the value outright moved the scalar at 17.9 per second — a pop, and a
      linear one, which the easing rule forbids on its own. Smoothstep has zero
      velocity at both ends, so the hand arrives and leaves at rest.
    */
    if (F.weightShifted) {
      for (const i of [0, 1] as const) {
        this.handFrom[i] = this.handTo[i] as number;
        this.handTo[i] = this.bodyRange(B.hand.settle);
        this.handT[i] = 0;
        this.handMoveS[i] = this.bodyRange(B.hand.moveS);
      }
    }
    for (const i of [0, 1] as const) {
      this.handT[i] = Math.min(1, (this.handT[i] as number) + dt / (this.handMoveS[i] as number));
      const e = this.handT[i] as number;
      const eased = e * e * (3 - 2 * e);
      const from = this.handFrom[i] as number;
      const settled = from + ((this.handTo[i] as number) - from) * eased;
      const drifted =
        settled +
        ((this.handNoise[i * 2] as ValueNoise).step(dt) * 0.65 +
          (this.handNoise[i * 2 + 1] as ValueNoise).step(dt) * 0.35) *
          B.hand.drift;
      const value = Math.min(1, Math.max(0, drifted));
      if (i === 0) F.handRelaxL = value;
      else F.handRelaxR = value;
    }

    // -- gaze break: leave the lens, hold, return --
    this.awayIn -= dt;
    if (this.awayIn <= 0 && !(this.awayT < this.awayHoldS + 2 * B.gazeAway.easeS)) {
      this.awayYaw = (this.bodyRand() < 0.5 ? -1 : 1) * this.bodyRange(B.gazeAway.yawDeg) * DEG;
      this.awayPitch = this.bodyRange(B.gazeAway.pitchDeg) * DEG;
      this.awayHoldS = this.bodyRange(B.gazeAway.holdS);
      this.awayT = 0;
      this.awayIn = this.bodyRange(B.gazeAway.intervalS);
      F.gazeBroke = true;
    }
    let away = 0;
    if (this.awayT < this.awayHoldS + 2 * B.gazeAway.easeS) {
      const e = B.gazeAway.easeS;
      const t = this.awayT;
      away = t < e ? smooth(t / e) : t < e + this.awayHoldS ? 1 : 1 - smooth((t - e - this.awayHoldS) / e);
      this.awayT += dt;
    }
    F.gazeAwayYaw = this.awayYaw * away;
    F.gazeAwayPitch = this.awayPitch * away;

    // -- head follows the eyes, a beat behind --
    const kf = 1 - Math.exp(-dt / B.headFollow.tauS);
    this.followYaw += (B.headFollow.gain * (F.eyeYaw + F.gazeAwayYaw) - this.followYaw) * kf;
    this.followPitch += (B.headFollow.gain * (F.eyePitch + F.gazeAwayPitch) - this.followPitch) * kf;
    F.headFollowYaw = this.followYaw;
    F.headFollowPitch = this.followPitch;

    F.gains.breath = this.breathBoost;
    F.gains.sway = 1;
    F.gains.drift = driftGain;
    return F;
  }
}
