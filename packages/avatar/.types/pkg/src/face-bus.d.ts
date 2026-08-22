/**
 * THE single face writer. Speech, idle and emotion all want the head's
 * expression vector; exactly one of them writes it, once per frame, and this is
 * that one. Everything else contributes named ARKit weights and the bus merges
 * them by per-channel max — so an emotion baseline holds the brows while
 * speech drives the mouth, instead of the two fighting.
 *
 * THREE CHANGES FROM THE REFERENCE, all forced, all worth knowing:
 *
 * 1. **The mic listener is gone.** The reference fed the idle engine from an
 *    always-on microphone (partner speaking, pause events, falling F0). Doc 22
 *    §3 cuts it: turn-taking comes from the gateway stream, not from a live mic
 *    at a child. Those inputs are now supplied by the caller through
 *    `setConversationCues` — the idle engine's interface is unchanged, so
 *    backchannel nods and anticipation still work; they are just driven by
 *    something we can consent to.
 *
 * 2. **It is a factory, not a module singleton.** The reference kicked off a
 *    `fetch('/gnm/arkit-map.json')` at import time behind a `typeof window`
 *    check. Import-time I/O is wrong on RN and untestable anywhere; the encoder
 *    is now injected, already resolved.
 *
 * 3. **The encoder is injected, not assumed.** After the rebake (doc 22 §6.3)
 *    the head's expression vector may BE the 19 ARKit channels, in which case
 *    there is no matrix multiply per frame at all. See `./speech/encoder.ts`.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2, §3, §6.3, §7
 * SOT-KEYWORDS: face bus single writer merge max idle emotion speech expression encoder
 */
import { EmotionState, type EmotionCategory } from './emotion.ts';
import { type IdleFrame } from './idle/engine.ts';
import type { ExpressionEncoder } from './speech/encoder.ts';
import type { SpeechDriver } from './speech/driver.ts';
import type { Shape } from './speech/track.ts';
/**
 * Conversational cues the idle engine uses for backchannel nods and pre-speech
 * anticipation. The gateway knows all of these; a microphone is not required
 * for any of them.
 */
export interface ConversationCues {
    /** The learner is composing or speaking their turn. */
    partnerSpeaking: boolean;
    /** A turn just ended — fires for one frame. */
    partnerPauseEvent: boolean;
    /** Their turn is trailing off (question mark, send pending). */
    partnerF0Falling: boolean;
    /** A turn was recently completed, so a reply is expected. */
    recentlyEnded: boolean;
}
export interface FaceBusOptions {
    speech: SpeechDriver;
    encoder: ExpressionEncoder;
    seed?: number;
    /** Injected so a golden run is not at the mercy of the wall clock. */
    clock?: () => number;
}
export interface FaceBus {
    /** Advances every contributor and makes the one expression write. */
    step(dt: number): IdleFrame;
    setEmotion(category: EmotionCategory, intensity?: number): void;
    setSeed(seed: number): void;
    /** Gateway-supplied turn-taking cues; held until replaced. */
    setConversationCues(cues: Partial<ConversationCues>): void;
    /**
     * Reduced motion (doc 22 §7): pins breath, sway, drift, gaze and blink
     * hazard. Speech-driven mouth and a minimal blink survive — this is
     * vestibular accessibility, and a still avatar must be provably still.
     */
    setReducedMotion(reduced: boolean): void;
    /** Dev-only held weights (the reference's `?pose=`), merged over everything. */
    poseWeights: Shape | null;
    readonly emotion: EmotionState;
}
export declare function createFaceBus(options: FaceBusOptions): FaceBus;
