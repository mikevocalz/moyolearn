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
