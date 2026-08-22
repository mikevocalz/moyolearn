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
export declare function mulberry32(seed: number): () => number;
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
export declare const IDLE_CHANNELS: readonly ["breathY", "breathPitch", "swayX", "swayY", "driftYaw", "driftPitch", "nodPitch", "eyeYaw", "eyePitch", "eyeBlinkLeft", "eyeBlinkRight", "eyesWide"];
export type IdleChannel = (typeof IDLE_CHANNELS)[number];
export type IdleFrame = {
    [K in IdleChannel]: number;
} & {
    blinkStarted: boolean;
    saccadeStarted: boolean;
    anticipated: boolean;
    gains: {
        breath: number;
        sway: number;
        drift: number;
    };
};
export declare class IdleEngine {
    readonly seed: number;
    private rand;
    private breathPhase;
    private breathPeriod;
    private breathBoost;
    private swayNoise;
    private driftNoise;
    private blinkState;
    private blinkT;
    private blinkRefractory;
    private forcedBlinkIn;
    private sinceSaccade;
    private localYaw;
    private localPitch;
    private sacVy;
    private sacVp;
    private saccadeLeft;
    private saccadeIn;
    private centerYaw;
    private centerPitch;
    private nodT;
    private nodAmp;
    private nodRefractory;
    private partnerSpeakT;
    private wasPartnerSpeaking;
    private nodTimerAt;
    private anticipationArmed;
    private anticipationFired;
    private anticipationLead;
    private lastTimeUntilOnset;
    private wideT;
    private frame;
    constructor(seed?: number);
    private range;
    step(dt: number, inputs: IdleInputs): IdleFrame;
}
