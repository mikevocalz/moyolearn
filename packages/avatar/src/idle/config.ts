/**
 * Every constant the idle engine reads, in one place, so the engine stays
 * pure `step(dt, inputs)` and the numbers stay reviewable next to the research
 * that chose them. Separated from the engine because the golden-image harness
 * and the channel-envelope test both assert against these bounds directly.
 *
 * Ported verbatim from the gnm-avatar reference renderer (`src/idle/config.ts`).
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2
 * SOT-KEYWORDS: idle config breath sway drift saccade blink nod anticipation constants
 */

/** Every idle-layer interval/amplitude lives here — no magic numbers at call sites. */
export interface Range {
  readonly min: number;
  readonly max: number;
}

export const idleConfig = {
  seed: 1,
  breath: {
    rateHz: { min: 0.2, max: 0.27 },
    inhaleFraction: 0.4, // ~40/60 inhale/exhale
    bobM: 0.0018,
    pitchDeg: 0.3,
    anticipationBoost: 1.4,
  },
  sway: {
    // second octave = 0.15 * e so the pair never phase-locks (irrational ratio)
    octaves: [
      { hz: 0.15, weight: 0.65 },
      { hz: 0.15 * Math.E, weight: 0.35 },
    ],
    amplitudeM: 0.01, // full pelvis scale (+-10 mm); applied by the body rig
  },
  drift: { hz: 0.2, maxDeg: 0.3, speechGain: 0.7 },
  blink: {
    baseHazard: 0.2, // /s; with boosts + doubles lands ~15-20 blinks/min
    refractoryS: 0.35,
    closeS: 0.12,
    openS: 0.18,
    doubleP: 0.2,
    doubleDelayS: 0.25,
    gapBoost: 4,
    postSaccadeBoost: 3,
    postSaccadeWindowS: 0.3,
  },
  saccade: {
    intervalS: { min: 0.3, max: 2.0 },
    durationS: 0.04, // ballistic, no easing
    fixationBoxDeg: 2.0,
    speechBoxDeg: 0.8, // face-on while speaking
    maxDeg: 5,
  },
  gaze: { aversionYawDeg: 2.5, aversionPitchDeg: -1.2, easeTauS: 0.25 },
  nod: {
    pitchDeg: { min: 4, max: 8 },
    nodS: 0.35,
    count: 2,
    refractoryS: 1.5,
    speechTimerS: { min: 2, max: 4 },
  },
  anticipation: {
    leadS: { min: 0.25, max: 0.4 },
    eyesWide: 0.15,
    attackS: 0.1,
    decayS: 0.6,
  },
  speech: { gapWeightSum: 0.05, releaseMs: 250 },
  listening: {
    pauseMs: 250,
    floorRiseRate: 0.001,
    floorFallRate: 0.05,
    speechFactor: 3,
    minThreshold: 0.01,
    f0WindowMs: 300,
    f0MinHz: 70,
    f0MaxHz: 400,
    f0FallRatio: 0.9,
    recentEndMs: 2000,
  },
} as const;

export type IdleConfig = typeof idleConfig;
