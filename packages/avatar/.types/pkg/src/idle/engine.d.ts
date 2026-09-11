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
export declare const IDLE_CHANNELS: readonly ["breathY", "breathPitch", "swayX", "swayY", "driftYaw", "driftPitch", "nodPitch", "eyeYaw", "eyePitch", "eyeBlinkLeft", "eyeBlinkRight", "eyesWide", "weightShift", "torsoYaw", "shoulderL", "shoulderR", "wristL", "wristR", "handRelaxL", "handRelaxR", "gazeAwayYaw", "gazeAwayPitch", "headFollowYaw", "headFollowPitch"];
export type IdleChannel = (typeof IDLE_CHANNELS)[number];
export type IdleFrame = {
    [K in IdleChannel]: number;
} & {
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
    gains: {
        breath: number;
        sway: number;
        drift: number;
    };
};
/** Finger channels in hand order: thumb, index, middle, ring, pinky. */
/**
 * One channel per HAND. There is no per-finger channel and there must not be:
 * ten independent noises read as fidgeting (PR #31) and a hand's digits are not
 * independently controlled anyway. The writer turns this scalar into ten angles
 * through a fixed gradient.
 */
export declare const HAND_CHANNELS: {
    readonly L: "handRelaxL";
    readonly R: "handRelaxR";
};
export declare class IdleEngine {
    readonly seed: number;
    private rand;
    private breathPhase;
    private breathPeriod;
    /** This session's resting rate. Fixed; only the individual cycles vary. */
    private breathMeanPeriod;
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
    private shiftFrom;
    private shiftTo;
    private shiftT;
    private shiftMoveS;
    private shiftIn;
    private torsoNoise;
    private turnIn;
    private turnAmp;
    private turnT;
    private turnHoldS;
    private shoulderNoise;
    private wristNoise;
    private handNoise;
    /** Where each hand is settling FROM, TO, and how far through it is. */
    private handFrom;
    private handTo;
    private handT;
    private handMoveS;
    private awayIn;
    private awayT;
    private awayHoldS;
    private awayYaw;
    private awayPitch;
    private followYaw;
    private followPitch;
    /**
     * The body layer draws from its OWN stream, derived from the seed. A shared
     * stream would interleave its draws with the head's during `step`, and a
     * seed that produced a given face before ADR-113 would produce a different
     * one after it — every head golden would need re-approval for adding a body.
     */
    private bodyRand;
    private anticipationArmed;
    private anticipationFired;
    private anticipationLead;
    private lastTimeUntilOnset;
    private wideT;
    private frame;
    constructor(seed?: number);
    /**
     * The next breath, jittered around this session's mean. Drawn from the same
     * seeded stream as everything else, so a run stays reproducible.
     */
    private jitteredBreathPeriod;
    private range;
    private bodyRange;
    step(dt: number, inputs: IdleInputs): IdleFrame;
}
