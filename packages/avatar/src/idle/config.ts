/**
 * Every constant the idle engine reads, in one place, so the engine stays
 * pure `step(dt, inputs)` and the numbers stay reviewable next to the research
 * that chose them. Separated from the engine because the golden-image harness
 * and the channel-envelope test both assert against these bounds directly.
 *
 * Ported verbatim from the gnm-avatar reference renderer (`src/idle/config.ts`).
 *
 * The `body` block (2026-09-03, Prompt 6 / ADR-113) is the procedural
 * micro-motion layer below the neck: weight shifts, torso turns, shoulders,
 * wrists, fingers, gaze breaks and head-follow. Its numbers come from
 * `audit/motion/behaviour-taxonomy.md`, which cites the source for each range.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2 · docs/decisions/adr-113-body-motion-layer.md
 * SOT-KEYWORDS: idle config breath sway drift saccade blink nod anticipation constants body weight shift fingers gaze away
 */

/** Every idle-layer interval/amplitude lives here — no magic numbers at call sites. */
export interface Range {
  readonly min: number;
  readonly max: number;
}

export const idleConfig = {
  seed: 1,
  breath: {
    /**
     * The MEAN rate for a session — 12-16/min — drawn once, not per cycle.
     * A person has a resting rate; they do not redraw it every breath.
     */
    rateHz: { min: 0.2, max: 0.27 },
    /**
     * Cycle-to-cycle variation around that mean, as a fraction of the period.
     * Uniform ±26% gives a coefficient of variation of 0.26/√3 ≈ 15%, which is
     * the figure resting adults measure and the one the acceptance record asks
     * for.
     *
     * It has to be a separate number from `rateHz` because the two describe
     * different things, and conflating them is what made this wrong: drawing a
     * fresh rate per cycle from the 12-16/min range caps the variation at
     * 0.07/√3 ≈ 8.7% by construction, and it measured 7.4%. Reaching 15% that
     * way needs a range wide enough to put the mean outside resting rate — the
     * range is the range of the MEAN, not a bound each cycle has to sit inside.
     * An individual cycle may fall outside 12-16/min; a person's does.
     */
    periodJitter: 0.26,
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
    /*
      MEASURED: the StayStill idles carry a fast-band sway sd of p50 0.8 cm
      once slow repositioning drift is separated out. For this two-octave sum
      the sd is 0.522x the amplitude, so matching it needs A = 0.0153 — five
      times the old guess of 3 mm, which was quiet to the point of mannequin.
    */
    amplitudeM: 0.0153,
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
  body: {
    /**
     * A discrete transfer of weight between the legs. Not the continuous sway
     * above (that is the balance tremor) — this is the thing a person does
     * every quarter-minute or so, and its absence is most of "mannequin".
     */
    weightShift: {
      /*
        MEASURED, not guessed — from the StayStill idle corpus (MIT, in the
        asset ledger), 541 inter-shift gaps detected across the 50 two-minute
        general idles with a detector calibrated on the 95 labelled balance
        shifts. `tools/staystill_stats.mjs` regenerates every number here.

        The gaps are heavily skewed — p10 2.3 s, p50 5.9 s, p90 19.1 s — so a
        uniform min/max cannot represent them: uniform over [2.3, 19.1] makes
        the typical gap ~11 s when the measured median is 5.9. The engine
        samples piecewise around the median instead. The old guess of 8-20 s
        made her shift half as often as the people in the data.
      */
      intervalPercentilesS: { p10: 2.3, p50: 5.9, p90: 19.1 },
      /*
        Full transition time. The corpus measures a 10-90% rise of p50 0.43 s
        on the labelled shifts; a smoothstep spends 61% of its span between
        those marks, so the equivalent full move is ~0.7 s. The upper end stays
        judgement (labelled: the measured p90 of 3.4 s is settle-contaminated
        and would read as wandering on a tutor).
      */
      moveS: { min: 0.7, max: 1.9 },
      /** Lateral hip travel, metres. Measured p50 3.9 cm; the guess was 2.2. */
      amplitudeM: 0.039,
      /** Follow-through past the new stance before it settles, as a fraction. */
      overshoot: 0.08,
    },
    /** A slight turn of the torso: slow wander, plus a held turn on a turn end. */
    torsoTurn: {
      hz: 0.05,
      driftDeg: 1.5,
      eventIntervalS: { min: 12, max: 30 },
      eventDeg: { min: 2, max: 4 },
      holdS: { min: 3, max: 6 },
      easeS: 0.8,
    },
    /*
      CONTRAPPOSTO. The legs' answer to a weight shift, and the reason the
      pelvis is not floating over a pair of posts.

      A person standing at rest puts most of their weight on one leg. That leg
      is near-straight and its hip rides high; the free leg's knee carries the
      flexion. The shoulders counter-tilt against the pelvis, which is the whole
      geometry of contrapposto and the thing that separates a standing person
      from a figure at attention.

      Degrees, and asymmetric by construction: `split` is added on one side and
      subtracted on the other, so the two knees are never at one angle. A
      perfectly mirrored pose is a test failure, not a resting state.

      Values from the stance spec (design-handoff, this turn): loaded knee ~2
      degrees, free knee ~13, which `base` 7.5 and `split` 5.5 reproduce at full
      load. The clinical range for an unloaded knee in relaxed stance is 10-20
      degrees, so 13 sits low in it — she is standing and listening, not lounging.
    */
    stance: {
      /** Knee flexion at zero load, before either split. */
      kneeBaseDeg: 7.5,
      /**
       * A CONSTANT left-right difference that the load split rides on top of,
       * so the two knees are never at one angle — not even for the instant the
       * weight passes through centre.
       *
       * Measured without it: 873 frames out of 7200 had both knees identical,
       * every time the load crossed zero. A mirrored pose is a test failure and
       * not a resting state, and "only for a moment" is exactly when a viewer's
       * eye is on the transition. The spec's near-symmetric stance is 5 and 7
       * degrees, which is this 1 degree either side of the base.
       */
      kneeBaseSplitDeg: 1,
      /** Added to the free knee and taken off the loaded one at full load. */
      kneeSplitDeg: 5.5,
      /** The free heel unweights: plantarflexion on the unloaded foot. */
      freeFootPlantarDeg: 2,
      /** The loaded hip rides high — pelvis roll toward the free side. */
      pelvisRollDeg: 4,
      /** Shoulders tilt AGAINST the pelvis. Same sign convention, applied up-chain. */
      shoulderCounterDeg: 5,
      /**
       * The knee leads the pelvis and the shoulder lags it, in seconds.
       * Anticipation and overlap: everything starting on one frame is the
       * seventh item on the reads-robotic list.
       */
      kneeLeadS: 0.12,
      shoulderLagS: 0.15,
    },
    shoulder: { hz: 0.12, maxDeg: 1.5 },
    wrist: { hz: 0.18, maxDeg: 3 },
    /**
     * ONE RELAXATION SCALAR PER HAND, not ten independent finger channels.
     *
     * 0 is an open relaxed hand, 1 a soft curl. Every finger's angle is this
     * scalar times a fixed gradient, so the digits move together — which is
     * what a hand does. Häger-Ross & Schieber (2000) measured that even an
     * instructed single-finger movement carries the neighbouring digits with
     * it; the middle and ring have almost no independent control at all.
     *
     * TEN CHANNELS WAS TRIED TWICE AND IS WRONG BOTH WAYS ROUND. Ten
     * independent noises read as fidgeting and were removed in PR #31. The
     * writer then sampled what remained only at weight shifts, which left the
     * hand frozen for the 8-20 s between them. Neither frozen nor fidgeting:
     * one slow scalar that never quite stops.
     *
     * 0.05-0.15 Hz is deliberately slower than the 0.2-0.35 the per-finger
     * noise used. A hand at rest changes shape over seconds, not fractions of
     * one.
     */
    hand: {
      /** Rate of the slow drift that keeps the hand from ever being still. */
      hz: { min: 0.05, max: 0.15 },
      /** Drift amplitude, as a fraction of the relaxation range. */
      drift: 0.12,
      /** Where the scalar is re-seeded on a posture change. */
      settle: { min: 0.2, max: 0.55 },
      /**
       * How long the hand takes to re-settle, in seconds. Matched to the weight
       * shift's own 1.2-2.2 s: the hand resettles BECAUSE the weight moved, so
       * it should finish alongside it rather than snap ahead of it.
       */
      moveS: { min: 1.2, max: 2.2 },
    },
    /**
     * Gaze leaves the lens for a moment and comes back. The upper interval is
     * the companionship firewall's stare ceiling (doc 22 §7; gesture-gate.ts
     * `maxGazeHoldMs`), so a held stare cannot happen by construction.
     */
    gazeAway: {
      /*
        NOT the measured human number, and the override is deliberate.

        The StayStill idles measure ~3.2 looks a minute — median gap 7.9 s,
        p90 31 s (307 intervals, FK head yaw against a running median; the
        detector validated on labelled clips: look-arounds sweep 122-144
        degrees, look-at-phone stays inside 13). Real adults break gaze a
        QUARTER as often as this config does.

        It stays 3-4 s anyway, because this interval is load-bearing for a
        safety property, not a realism one: the companionship firewall caps a
        held stare at a child at 3 s (doc 22 §7, gesture-gate `maxGazeHoldMs`
        3000), and the gaze break is what discharges it by construction. A
        tutor is not an idling adult in a lab. If the ceiling is ever
        revisited, the measured distribution above is what the interval
        should become — that is a product-safety decision, not a config edit.
      */
      intervalS: { min: 3, max: 4 },
      /*
        MEASURED: above-threshold look duration p50 1.93 s including both
        sweeps; the dwell is that minus the eases (labelled judgement on top
        of the measurement). The old 1.2 s max was a guess.
      */
      holdS: { min: 0.5, max: 1.6 },
      /*
        DELIBERATELY NOT the measured 77-degree excursion. l_aro is a person
        scanning a room; this channel is a conversational gaze aversion, a
        few degrees off the lens. Adopting the corpus number would have her
        turning away from the child mid-sentence.
      */
      yawDeg: { min: 4, max: 8 },
      pitchDeg: { min: -3, max: 1 },
      easeS: 0.15,
    },
    /** The head trails the eyes: a fraction of the gaze, a beat late. */
    headFollow: { gain: 0.35, tauS: 0.35 },
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
