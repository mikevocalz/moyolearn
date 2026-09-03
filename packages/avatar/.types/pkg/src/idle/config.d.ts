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
        readonly rateHz: {
            readonly min: 0.2;
            readonly max: 0.27;
        };
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
        readonly amplitudeM: 0.01;
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
            readonly intervalS: {
                readonly min: 8;
                readonly max: 20;
            };
            readonly moveS: {
                readonly min: 1.2;
                readonly max: 2.2;
            };
            /** Lateral travel of the hip, metres. */
            readonly amplitudeM: 0.022;
            /** Follow-through past the new stance before it settles, as a fraction. */
            readonly overshoot: 0.08;
        };
        /** A slight turn of the torso: slow wander, plus a held turn on a turn end. */
        readonly torsoTurn: {
            readonly hz: 0.05;
            readonly driftDeg: 1.5;
            readonly eventIntervalS: {
                readonly min: 12;
                readonly max: 30;
            };
            readonly eventDeg: {
                readonly min: 2;
                readonly max: 4;
            };
            readonly holdS: {
                readonly min: 3;
                readonly max: 6;
            };
            readonly easeS: 0.8;
        };
        readonly shoulder: {
            readonly hz: 0.12;
            readonly maxDeg: 1.5;
        };
        readonly wrist: {
            readonly hz: 0.18;
            readonly maxDeg: 3;
        };
        /** Per finger: its own rate and its own amplitude, so no two are in phase. */
        readonly finger: {
            readonly hz: {
                readonly min: 0.2;
                readonly max: 0.35;
            };
            readonly deg: {
                readonly min: 2;
                readonly max: 5;
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
                readonly min: 0.3;
                readonly max: 1.2;
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
