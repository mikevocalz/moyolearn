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
      eventIntervalS: { min: 10, max: 24 },
      /*
        9-15 DEGREES, and it was 2-4.

        Two to four degrees is inside the noise: the drift channel alone is
        1.5, so a "turn" at 2 degrees was a slightly larger wobble and read as
        one. A person listening does not hold square to you — they angle,
        settle there for a few seconds, and come back, and the head counters
        so the face stays on you while the body is off-axis. That head counter
        (`-frame.torsoYaw * 0.5` in the writer) is what makes a real angle
        readable as attention rather than as turning away.

        15 is the ceiling on purpose and it is the same ceiling as
        `TURN_TOWARD.maxRad`: past it the honest move is a step-turn, which is
        footwork this layer does not have. The cap is the scope boundary, not
        a taste call.
      */
      eventDeg: { min: 9, max: 15 },
      holdS: { min: 3, max: 6 },
      easeS: 0.8,
      /*
        THE TURN SETTLES; it does not arrive and stop dead.

        A smoothstep in and a smoothstep out is symmetric, lands with zero
        velocity and reads mechanical — the body gets to the angle and freezes
        there, which is the tell. Real turning overshoots slightly and comes
        back, the same follow-through the weight shift already rides
        (`weightShift.overshoot`), and for the same reason: mass does not stop
        where the muscle stops.
      */
      overshoot: 0.12,
      /*
        AND IT ARRIVES IN SEQUENCE. Head first, chest behind it, lumbar last:
        seconds of lag per level, the same cascade the lateral weight uses.
        Everything starting on one frame is item 7 on the reads-robotic list,
        and a turn where the whole torso rotates as one piece is the clearest
        case of it — that IS what a mannequin on a turntable does.
      */
      lagS: { head: 0.04, chest: 0.15, spine: 0.27 },
    },
    /*
      THE SPINE IS NOT A BROOM HANDLE.

      The pelvis translation and every counter-lean above it used to be written
      from ONE value of `shift` on the same frame, so the whole upper body slid
      sideways as a rigid block — the tell that reads as "the upper half is
      shifting", and the twelfth principle's overlapping action, missing.

      A real torso arrives in sequence: the pelvis goes, the lumbar answers, the
      chest is later still, and the head is last and smallest. These are the
      time constants of that cascade, in seconds, each stage lagging the one
      below it. Small numbers — a tenth of a second reads as weight, half a
      second would read as drunk.
    */
    spineLagS: { spine1: 0.09, spine2: 0.17, chest: 0.26, head: 0.34 },
    /*
      THE FEET ARE NOT GLUED DOWN.

      The stance solve pins the toe so knee flexion cannot slide the foot, which
      is right for the continuous load but leaves the feet bit-static forever.
      People adjust: the free heel lifts and comes down a few centimetres round,
      the toe pivots a degree or two, and it happens every ten seconds or so
      without them noticing.

      This is the free foot only, and only while it IS free — the event is
      scaled by how unloaded that foot is, so she never lifts the heel she is
      standing on. It is not a step: the toe stays where it is and the pelvis
      does not travel over a new base. That is still out of scope.
    */
    foot: {
      intervalS: { min: 6, max: 16 },
      /**
       * Heel lift on the free foot, as extra KNEE flexion — never ankle.
       * The toe-pinning solve takes any knee angle and re-derives the thigh
       * and ankle around it, so flexing the knee raises the heel with the toe
       * planted; rotating the ankle instead drags the toe (measured: 5.7 mm,
       * against the 2 mm `feet.test.ts` allows). A person lifts their heel.
       *
       * There is no toe pivot here and there cannot be one: pivoting about
       * the ankle slides the toe, and pivoting about the toe is a step.
       */
      heelDeg: { min: 3, max: 6 },
      moveS: { min: 0.5, max: 1.0 },
    },
    /*
      A STEP. The thing the stance layer has always refused to do.

      `presence/humano.ts` put footwork out of scope on purpose and said so in
      three places: past 15 degrees a turn "CLAMPS here rather than faking the
      step", and the toe-pin solve exists precisely so the load can never slide
      a foot. That was the right call while the alternative was faking one with
      a hip spin over planted feet. It is the wrong call as a permanent answer,
      because a person standing and listening for twenty minutes DOES move
      their feet — they take half a step back to give you room, they shift
      sideways, and then they come back.

      This is a real step and not a fake one: the swinging foot un-plants, its
      plant point moves, it comes down, THEN the other foot follows, and the
      body's base is the mean of where the two feet actually are. Nothing here
      slides a planted foot — `swingS` is when a foot is off the ground, and
      the writer only moves a foot's plant while its own swing is live.

      `maxOffsetM` is a leash, not a taste call: she is framed in a pane about
      a metre wide and a tutor who wanders out of frame is a bug, so the base
      may never be more than 12 cm from where she started, and a step that
      would break that is re-aimed back toward centre instead.
    */
    step: {
      intervalS: { min: 22, max: 70 },
      /**
       * How far the base moves. A shift of weight and a re-plant, not a walk.
       *
       * Was 4.5-9.5 cm with a 12 cm leash, and the recording of 2026-09-11
       * showed what that sums to: 118 px of torso wander across a 540 px pane
       * — a fifth of the frame — with her parked at the leash edge for the
       * last ten seconds. A step reads at half this size; past it she is
       * pacing, not adjusting.
       */
      lengthM: { min: 0.03, max: 0.055 },
      /** Time one foot spends in the air. */
      swingS: { min: 0.34, max: 0.5 },
      /** The gap between the first foot landing and the second leaving. */
      betweenS: { min: 0.12, max: 0.3 },
      /** How high the heel comes up mid-swing, as extra knee flexion, degrees. */
      liftDeg: 9,
      /*
        THE WEIGHT LEAVES A FOOT BEFORE THE FOOT LEAVES THE GROUND.

        Without this the swing lifted a heel that was still carrying her —
        physically impossible, and the single biggest reason the step read as
        floating rather than stepping. Each swing is preceded by this many
        seconds of weight shift AWAY from the foot about to move; the shift
        machinery itself does the moving, so the knees and shoulders answer it
        the way they answer any other shift.
      */
      preloadS: 0.26,
      /*
        Toe-off and heel-strike. The foot pitches plantar as it leaves
        (pushing off) and comes back through neutral to land heel-first —
        sin(2πu) gives exactly that shape for free: positive through the first
        half of the swing, negative into the landing.
      */
      pitchDeg: 7,
      /** The torso arrives over the new base behind the feet. */
      bodyLagS: 0.22,
      /** Never further than this from where she started, in metres. */
      maxOffsetM: 0.06,
      /**
       * Past this fraction of the leash a step always aims home. Without it
       * she walks to the leash and stays there — the re-aim only fires on a
       * step that would CROSS the boundary, so sitting just inside it was
       * stable for as long as the draws kept pointing outward.
       */
      homewardPast: 0.5,
      /**
       * How the direction is drawn. Back is the commonest thing a listener
       * does with their feet — giving the other person room — and forward only
       * ever happens as the return from a back step, which the leash produces
       * on its own by re-aiming toward centre.
       */
      backWeight: 0.45,
    },
    /*
      ARMS FOLDED. A posture, not a gesture.

      A person who has been listening for a while folds their arms, holds it
      for half a minute, and drops it when they start to talk. Without it she
      has exactly one upper-body posture for the whole lesson, which no amount
      of micro-motion fixes — the idle layer moves fractions of a degree on top
      of whatever base pose it is handed, and there was only ever one.

      `afterIdleS` keeps it off the front of a session (she does not greet a
      child with folded arms) and speech drops it: the unfold leads her first
      word, which is anticipation rather than a pose change that happens to
      coincide with one.
    */
    fold: {
      afterIdleS: 40,
      intervalS: { min: 55, max: 140 },
      holdS: { min: 16, max: 42 },
      easeS: 1.1,
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
    /**
     * Radial/ulnar deviation — the wrist's OTHER axis. Flexion alone reads as
     * a hinge; a resting hand also drifts side to side a few degrees, and that
     * cross-axis motion is most of what "the hand looks alive" means at a
     * glance.
     */
    wristDev: { hz: 0.14, maxDeg: 6 },
    /*
      SPEECH ENERGY → TORSO/SHOULDER AMPLITUDE (the torsoEnergyCorrelation
      finding, 8e62c1b: r = 0.028 against a ≥ 0.5 target, because speechEnv
      was binary and no torso/shoulder channel was scaled by speech at all).

      The cause is the utterance's own amplitude envelope — HER synthetic
      voice, never the child's — handed in as `speechEnergy` 0..1. While it is
      wired, the torsoYaw drift and the two shoulder noises become
      amp · ((1−m)·scale·slow + m·fast): the slow noise is scaled by
      quietScale..1 (quiet speech and inter-phrase gaps sit LOWER), and at
      high energy a faster value-noise octave is mixed in with convex weight
      m = fastMix·ê². The whole expression is bounded by 1 in noise units —
      |(1−m)·scale·slow + m·fast| ≤ (1−m) + m — so the existing config
      amplitude stays the ceiling and the channel-envelope test's bounds hold
      unchanged: the extra rotational ENERGY comes from rate, not from
      amplitude the bounds would have to grow for. Left unwired, every term
      collapses to exactly the pre-energy arithmetic, bit for bit.
    */
    speechEnergy: {
      /** Eased follower on the envelope, so an energy step never pops. */
      tauS: 0.3,
      /** Amplitude share left at zero energy while the input is wired. */
      quietScale: 0.15,
      /**
       * The energy octave's rate — stress-group rate, where the speed the
       * verifier measures actually lives (amplitude is capped, so rate is the
       * only axis energy may spend). Jittered spans — it cannot loop.
       */
      fastHz: 4.0,
      /** The fast octave's convex weight at FULL energy (m = fastMix·ê²). */
      fastMix: 1.0,
    },
    /*
      THE WRIST. 3 degrees, of which the writer was passing 15% — 0.45 degrees,
      which is nothing at the size she renders, and is why the hands read as
      carved onto the ends of the arms. The wrist is the joint with the most
      idle travel on a standing body: it is unloaded, it carries the hand's
      weight alone, and it never stops adjusting.
    */
    wrist: { hz: 0.18, maxDeg: 7 },
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
      /**
       * Drift amplitude, as a fraction of the relaxation range.
       *
       * 0.12 of a 0.35 range is about one degree at the knuckle, measured on
       * the rig — below the threshold where anything is visible at the size
       * she renders on a phone, which is why the hand read as carved. 0.3 is
       * ~2.5 degrees of slow open-and-settle: still a hand at rest, now a
       * hand you can see is alive.
       */
      drift: 0.3,
      /**
       * A SMALL PER-FINGER OFFSET ON TOP OF THE SHARED SCALAR — the wiggle.
       *
       * This does not reopen the ten-independent-channels mistake (PR #31).
       * The digits still move together, because the shared relaxation scalar
       * is still what carries the shape; this adds under two degrees of
       * independent drift per finger on top, which is the residual a real hand
       * has and a perfectly coupled one does not. Häger-Ross & Schieber's
       * finding is that the digits are not INDEPENDENT, not that they are
       * identical — the enslavement they measured is partial.
       *
       * Keep it under `drift`. If the independent part ever exceeds the shared
       * part, this is fidgeting again.
       */
      /*
        Sized to be SEEN. 3 degrees at a knuckle is ~3 px in the pane she
        renders in — motion that exists in the numbers and not in the eye,
        which is the recurring failure of this whole layer. 5 keeps it under
        the fidget line while actually reading.
      */
      wiggle: { hz: { min: 0.3, max: 0.75 }, deg: 5 },
      /*
        A RIPPLE — the one discrete thing idle fingers do. Continuous noise
        reads as trembling once it is large enough to see; what people
        actually do every ten seconds or so is a single soft wave, each digit
        flexing a beat after its neighbour. One event, phased across the five
        fingers by the writer.
      */
      ripple: {
        intervalS: { min: 9, max: 22 },
        durS: { min: 1.0, max: 1.5 },
        deg: 8,
      },
      /** Where the scalar is re-seeded on a posture change. */
      settle: { min: 0.15, max: 0.75 },
      /**
       * A posture change is not the only reason a hand changes shape.
       *
       * The re-settle used to fire ONLY on a weight shift, so between shifts
       * the hand held one curl for 6-19 seconds with a drift on top. Hands
       * do not do that — they open, close a little, and re-settle on their own
       * clock, several times a minute, for no external reason at all.
       */
      settleIntervalS: { min: 4, max: 13 },
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
  /*
    THE FACE WHEN NOBODY IS DRIVING IT.

    Tell 9 of `what-reads-robotic.md` — "the face never emotes on the 3D path"
    — was answered by wiring the tone's emotion baseline through `input.emotion`,
    and that fixed the case where the LESSON has a mood. It left the ordinary
    case untouched: a neutral tone is an empty preset, so between utterances her
    face held exactly one shape, the mouth closed and the brows flat, for as long
    as the child took to answer. A face that holds one shape is a mask.

    These are the three things a face does with nobody driving it: it carries a
    resting warmth that wanders, it parts the lips now and then, and after long
    enough with nothing happening it yawns. All three sit UNDER speech by
    per-channel max, the same merge the emotion baseline uses, so the mouth
    keeps articulating over the top of them and nothing here can fight a viseme.
  */
  expression: {
    smile: {
      /** The resting warmth, drawn once per session — a person has a face. */
      base: { min: 0.05, max: 0.11 },
      /** ...which never quite holds still. */
      driftHz: { min: 0.03, max: 0.08 },
      driftAmp: 0.05,
      /** And lifts, now and then, the way a listener's face does. */
      event: {
        intervalS: { min: 8, max: 24 },
        peak: { min: 0.24, max: 0.46 },
        riseS: 0.42,
        holdS: { min: 0.7, max: 2.2 },
        fallS: 1.1,
      },
      /**
       * The two corners are never at one angle, and never arrive together.
       * A symmetric smile is the single most synthetic thing a face can do —
       * item 11's facial half.
       */
      asymmetry: 0.16,
      lagS: 0.08,
      /**
       * A little jaw at full smile, so the teeth show. A closed-mouth smile at
       * 0.45 reads as a smirk; the lips have to part for it to read as warm.
       */
      teeth: 0.22,
      /**
       * The eye squint share. A smile that stops at the mouth is the uncanny
       * one — Duchenne's whole point is that the orbicularis is what makes it
       * read as felt rather than performed.
       */
      duchenne: 0.42,
      /** Cheeks rise with it; without this the mouth corners stretch a flat face. */
      cheek: 0.55,
      /**
       * What reduced motion HOLDS. A smile is a pose: pinning it removes no
       * vestibular load and hands the reader a blank face for their trouble.
       * Pin the transition, not the pose — the stance rule, on the face.
       */
      heldReduced: 0.07,
    },
    /** The lips part between phrases. Breath, not speech. */
    mouthPart: {
      intervalS: { min: 6, max: 19 },
      open: { min: 0.05, max: 0.13 },
      riseS: 0.5,
      holdS: { min: 0.5, max: 1.8 },
      fallS: 0.8,
    },
    /*
      A YAWN, after four minutes with nothing to do.

      Not decoration and not a joke: it is the strongest available signal that
      the thing on screen has an internal state that the child is not driving.
      It only fires in genuine quiet — she has not spoken, the child has not
      spoken, nothing is processing — so it can never land on top of a lesson
      beat, and the refractory keeps it rare enough to stay a surprise.
    */
    yawn: {
      afterIdleS: 240,
      refractoryS: 200,
      riseS: 1.25,
      holdS: 0.5,
      fallS: 1.7,
      /** Peak weights and angles at the top of the yawn. */
      jaw: 0.95,
      brow: 0.5,
      eyesShut: 0.85,
      headPitchDeg: 8,
      /** The chest takes a breath with it, as a multiplier on the breath bob. */
      chest: 1.6,
      /** And the shoulders come up and settle. */
      shoulderDeg: 3.5,
    },
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
