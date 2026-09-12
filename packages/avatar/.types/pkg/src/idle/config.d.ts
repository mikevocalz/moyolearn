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
export declare const idleConfig: {
    readonly seed: 1;
    readonly breath: {
        /**
         * The MEAN rate for a session — 12-16/min — drawn once, not per cycle.
         * A person has a resting rate; they do not redraw it every breath.
         */
        readonly rateHz: {
            readonly min: 0.2;
            readonly max: 0.27;
        };
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
        readonly periodJitter: 0.26;
        readonly inhaleFraction: 0.4;
        readonly bobM: 0.0018;
        readonly pitchDeg: 0.3;
        readonly anticipationBoost: 1.4;
    };
    readonly sway: {
        readonly octaves: readonly [{
            readonly hz: 0.15;
            readonly weight: 0.65;
        }, {
            readonly hz: number;
            readonly weight: 0.35;
        }];
        readonly amplitudeM: 0.0153;
    };
    readonly drift: {
        readonly hz: 0.2;
        readonly maxDeg: 0.3;
        readonly speechGain: 0.7;
    };
    readonly blink: {
        readonly baseHazard: 0.2;
        readonly refractoryS: 0.35;
        readonly closeS: 0.12;
        readonly openS: 0.18;
        readonly doubleP: 0.2;
        readonly doubleDelayS: 0.25;
        readonly gapBoost: 4;
        readonly postSaccadeBoost: 3;
        readonly postSaccadeWindowS: 0.3;
    };
    readonly saccade: {
        readonly intervalS: {
            readonly min: 0.3;
            readonly max: 2;
        };
        readonly durationS: 0.04;
        readonly fixationBoxDeg: 2;
        readonly speechBoxDeg: 0.8;
        readonly maxDeg: 5;
    };
    readonly gaze: {
        readonly aversionYawDeg: 2.5;
        readonly aversionPitchDeg: -1.2;
        readonly easeTauS: 0.25;
    };
    readonly nod: {
        readonly pitchDeg: {
            readonly min: 4;
            readonly max: 8;
        };
        readonly nodS: 0.35;
        readonly count: 2;
        readonly refractoryS: 1.5;
        readonly speechTimerS: {
            readonly min: 2;
            readonly max: 4;
        };
    };
    readonly anticipation: {
        readonly leadS: {
            readonly min: 0.25;
            readonly max: 0.4;
        };
        readonly eyesWide: 0.15;
        readonly attackS: 0.1;
        readonly decayS: 0.6;
    };
    readonly body: {
        /**
         * A discrete transfer of weight between the legs. Not the continuous sway
         * above (that is the balance tremor) — this is the thing a person does
         * every quarter-minute or so, and its absence is most of "mannequin".
         */
        readonly weightShift: {
            readonly intervalPercentilesS: {
                readonly p10: 2.3;
                readonly p50: 5.9;
                readonly p90: 19.1;
            };
            readonly moveS: {
                readonly min: 0.7;
                readonly max: 1.9;
            };
            /** Lateral hip travel, metres. Measured p50 3.9 cm; the guess was 2.2. */
            readonly amplitudeM: 0.039;
            /** Follow-through past the new stance before it settles, as a fraction. */
            readonly overshoot: 0.08;
        };
        /** A slight turn of the torso: slow wander, plus a held turn on a turn end. */
        readonly torsoTurn: {
            readonly hz: 0.05;
            readonly driftDeg: 1.5;
            readonly eventIntervalS: {
                readonly min: 10;
                readonly max: 24;
            };
            readonly eventDeg: {
                readonly min: 9;
                readonly max: 15;
            };
            readonly holdS: {
                readonly min: 3;
                readonly max: 6;
            };
            readonly easeS: 0.8;
            readonly overshoot: 0.12;
            readonly lagS: {
                readonly head: 0.04;
                readonly chest: 0.15;
                readonly spine: 0.27;
            };
        };
        readonly spineLagS: {
            readonly spine1: 0.09;
            readonly spine2: 0.17;
            readonly chest: 0.26;
            readonly head: 0.34;
        };
        readonly foot: {
            readonly intervalS: {
                readonly min: 6;
                readonly max: 16;
            };
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
            readonly heelDeg: {
                readonly min: 3;
                readonly max: 6;
            };
            readonly moveS: {
                readonly min: 0.5;
                readonly max: 1;
            };
        };
        readonly step: {
            readonly intervalS: {
                readonly min: 22;
                readonly max: 70;
            };
            /**
             * How far the base moves. A shift of weight and a re-plant, not a walk.
             *
             * Was 4.5-9.5 cm with a 12 cm leash, and the recording of 2026-09-11
             * showed what that sums to: 118 px of torso wander across a 540 px pane
             * — a fifth of the frame — with her parked at the leash edge for the
             * last ten seconds. A step reads at half this size; past it she is
             * pacing, not adjusting.
             */
            readonly lengthM: {
                readonly min: 0.03;
                readonly max: 0.055;
            };
            /** Time one foot spends in the air. */
            readonly swingS: {
                readonly min: 0.34;
                readonly max: 0.5;
            };
            /** The gap between the first foot landing and the second leaving. */
            readonly betweenS: {
                readonly min: 0.12;
                readonly max: 0.3;
            };
            /** How high the heel comes up mid-swing, as extra knee flexion, degrees. */
            readonly liftDeg: 9;
            /** The torso arrives over the new base behind the feet. */
            readonly bodyLagS: 0.22;
            /** Never further than this from where she started, in metres. */
            readonly maxOffsetM: 0.06;
            /**
             * Past this fraction of the leash a step always aims home. Without it
             * she walks to the leash and stays there — the re-aim only fires on a
             * step that would CROSS the boundary, so sitting just inside it was
             * stable for as long as the draws kept pointing outward.
             */
            readonly homewardPast: 0.5;
            /**
             * How the direction is drawn. Back is the commonest thing a listener
             * does with their feet — giving the other person room — and forward only
             * ever happens as the return from a back step, which the leash produces
             * on its own by re-aiming toward centre.
             */
            readonly backWeight: 0.45;
        };
        readonly fold: {
            readonly afterIdleS: 40;
            readonly intervalS: {
                readonly min: 55;
                readonly max: 140;
            };
            readonly holdS: {
                readonly min: 16;
                readonly max: 42;
            };
            readonly easeS: 1.1;
        };
        readonly stance: {
            /** Knee flexion at zero load, before either split. */
            readonly kneeBaseDeg: 7.5;
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
            readonly kneeBaseSplitDeg: 1;
            /** Added to the free knee and taken off the loaded one at full load. */
            readonly kneeSplitDeg: 5.5;
            /** The free heel unweights: plantarflexion on the unloaded foot. */
            readonly freeFootPlantarDeg: 2;
            /** The loaded hip rides high — pelvis roll toward the free side. */
            readonly pelvisRollDeg: 4;
            /** Shoulders tilt AGAINST the pelvis. Same sign convention, applied up-chain. */
            readonly shoulderCounterDeg: 5;
            /**
             * The knee leads the pelvis and the shoulder lags it, in seconds.
             * Anticipation and overlap: everything starting on one frame is the
             * seventh item on the reads-robotic list.
             */
            readonly kneeLeadS: 0.12;
            readonly shoulderLagS: 0.15;
        };
        readonly shoulder: {
            readonly hz: 0.12;
            readonly maxDeg: 1.5;
        };
        readonly speechEnergy: {
            /** Eased follower on the envelope, so an energy step never pops. */
            readonly tauS: 0.3;
            /** Amplitude share left at zero energy while the input is wired. */
            readonly quietScale: 0.15;
            /**
             * The energy octave's rate — stress-group rate, where the speed the
             * verifier measures actually lives (amplitude is capped, so rate is the
             * only axis energy may spend). Jittered spans — it cannot loop.
             */
            readonly fastHz: 4;
            /** The fast octave's convex weight at FULL energy (m = fastMix·ê²). */
            readonly fastMix: 1;
        };
        readonly wrist: {
            readonly hz: 0.18;
            readonly maxDeg: 7;
        };
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
        readonly hand: {
            /** Rate of the slow drift that keeps the hand from ever being still. */
            readonly hz: {
                readonly min: 0.05;
                readonly max: 0.15;
            };
            /**
             * Drift amplitude, as a fraction of the relaxation range.
             *
             * 0.12 of a 0.35 range is about one degree at the knuckle, measured on
             * the rig — below the threshold where anything is visible at the size
             * she renders on a phone, which is why the hand read as carved. 0.3 is
             * ~2.5 degrees of slow open-and-settle: still a hand at rest, now a
             * hand you can see is alive.
             */
            readonly drift: 0.3;
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
            readonly wiggle: {
                readonly hz: {
                    readonly min: 0.3;
                    readonly max: 0.75;
                };
                readonly deg: 3;
            };
            /** Where the scalar is re-seeded on a posture change. */
            readonly settle: {
                readonly min: 0.15;
                readonly max: 0.75;
            };
            /**
             * A posture change is not the only reason a hand changes shape.
             *
             * The re-settle used to fire ONLY on a weight shift, so between shifts
             * the hand held one curl for 6-19 seconds with a drift on top. Hands
             * do not do that — they open, close a little, and re-settle on their own
             * clock, several times a minute, for no external reason at all.
             */
            readonly settleIntervalS: {
                readonly min: 4;
                readonly max: 13;
            };
            /**
             * How long the hand takes to re-settle, in seconds. Matched to the weight
             * shift's own 1.2-2.2 s: the hand resettles BECAUSE the weight moved, so
             * it should finish alongside it rather than snap ahead of it.
             */
            readonly moveS: {
                readonly min: 1.2;
                readonly max: 2.2;
            };
        };
        /**
         * Gaze leaves the lens for a moment and comes back. The upper interval is
         * the companionship firewall's stare ceiling (doc 22 §7; gesture-gate.ts
         * `maxGazeHoldMs`), so a held stare cannot happen by construction.
         */
        readonly gazeAway: {
            readonly intervalS: {
                readonly min: 3;
                readonly max: 4;
            };
            readonly holdS: {
                readonly min: 0.5;
                readonly max: 1.6;
            };
            readonly yawDeg: {
                readonly min: 4;
                readonly max: 8;
            };
            readonly pitchDeg: {
                readonly min: -3;
                readonly max: 1;
            };
            readonly easeS: 0.15;
        };
        /** The head trails the eyes: a fraction of the gaze, a beat late. */
        readonly headFollow: {
            readonly gain: 0.35;
            readonly tauS: 0.35;
        };
    };
    readonly expression: {
        readonly smile: {
            /** The resting warmth, drawn once per session — a person has a face. */
            readonly base: {
                readonly min: 0.05;
                readonly max: 0.11;
            };
            /** ...which never quite holds still. */
            readonly driftHz: {
                readonly min: 0.03;
                readonly max: 0.08;
            };
            readonly driftAmp: 0.05;
            /** And lifts, now and then, the way a listener's face does. */
            readonly event: {
                readonly intervalS: {
                    readonly min: 8;
                    readonly max: 24;
                };
                readonly peak: {
                    readonly min: 0.24;
                    readonly max: 0.46;
                };
                readonly riseS: 0.42;
                readonly holdS: {
                    readonly min: 0.7;
                    readonly max: 2.2;
                };
                readonly fallS: 1.1;
            };
            /**
             * The two corners are never at one angle, and never arrive together.
             * A symmetric smile is the single most synthetic thing a face can do —
             * item 11's facial half.
             */
            readonly asymmetry: 0.16;
            readonly lagS: 0.08;
            /**
             * A little jaw at full smile, so the teeth show. A closed-mouth smile at
             * 0.45 reads as a smirk; the lips have to part for it to read as warm.
             */
            readonly teeth: 0.22;
            /**
             * The eye squint share. A smile that stops at the mouth is the uncanny
             * one — Duchenne's whole point is that the orbicularis is what makes it
             * read as felt rather than performed.
             */
            readonly duchenne: 0.42;
            /** Cheeks rise with it; without this the mouth corners stretch a flat face. */
            readonly cheek: 0.55;
            /**
             * What reduced motion HOLDS. A smile is a pose: pinning it removes no
             * vestibular load and hands the reader a blank face for their trouble.
             * Pin the transition, not the pose — the stance rule, on the face.
             */
            readonly heldReduced: 0.07;
        };
        /** The lips part between phrases. Breath, not speech. */
        readonly mouthPart: {
            readonly intervalS: {
                readonly min: 6;
                readonly max: 19;
            };
            readonly open: {
                readonly min: 0.05;
                readonly max: 0.13;
            };
            readonly riseS: 0.5;
            readonly holdS: {
                readonly min: 0.5;
                readonly max: 1.8;
            };
            readonly fallS: 0.8;
        };
        readonly yawn: {
            readonly afterIdleS: 240;
            readonly refractoryS: 200;
            readonly riseS: 1.25;
            readonly holdS: 0.5;
            readonly fallS: 1.7;
            /** Peak weights and angles at the top of the yawn. */
            readonly jaw: 0.95;
            readonly brow: 0.5;
            readonly eyesShut: 0.85;
            readonly headPitchDeg: 8;
            /** The chest takes a breath with it, as a multiplier on the breath bob. */
            readonly chest: 1.6;
            /** And the shoulders come up and settle. */
            readonly shoulderDeg: 3.5;
        };
    };
    readonly speech: {
        readonly gapWeightSum: 0.05;
        readonly releaseMs: 250;
    };
    readonly listening: {
        readonly pauseMs: 250;
        readonly floorRiseRate: 0.001;
        readonly floorFallRate: 0.05;
        readonly speechFactor: 3;
        readonly minThreshold: 0.01;
        readonly f0WindowMs: 300;
        readonly f0MinHz: 70;
        readonly f0MaxHz: 400;
        readonly f0FallRatio: 0.9;
        readonly recentEndMs: 2000;
    };
};
export type IdleConfig = typeof idleConfig;
