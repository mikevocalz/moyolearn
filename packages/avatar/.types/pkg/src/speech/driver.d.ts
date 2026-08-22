import { type GestureTrack, type SpeechSample, type Track } from './track.ts';
/**
 * Pre-speech lookahead. The idle engine schedules its anticipation beat against
 * this, so it must be known BEFORE playback starts — which is why an utterance
 * decodes first and is then scheduled a fixed lead out, rather than played the
 * moment it arrives.
 */
export declare const ONSET_LEAD_MS = 300;
export interface DecodedUtterance {
    /** Opaque to this module; handed back to the backend to play. */
    readonly handle: unknown;
    readonly durationSeconds: number;
}
export interface AudioBackend {
    /** Monotonic clock in seconds. On Web Audio this is `AudioContext.currentTime`. */
    now(): number;
    decode(audio: ArrayBuffer): Promise<DecodedUtterance>;
    /** Starts playback at `when` on the same clock `now()` reports. */
    play(utterance: DecodedUtterance, when: number): void;
    stop(): void;
}
export interface Utterance {
    audio: ArrayBuffer;
    track: Track | null;
    gesture: GestureTrack | null;
    text: string;
}
export interface SpeechDriver {
    /** Per-frame viseme contribution. `nowMs` is a wall clock, for the release ramp. */
    sampleSpeech(nowMs: number): SpeechSample;
    /** Interpolated gesture pose while speaking, else null. */
    sampleGesture(): {
        joints: string[];
        pose: Float32Array;
    } | null;
    /** Decodes, schedules the onset a fixed lead out, and starts playback. */
    speak(utterance: Utterance): Promise<void>;
    /** Wall-clock ms at which the next onset is scheduled, or 0. */
    readonly scheduledOnsetAt: number;
    /** Playback position in seconds within the active utterance. */
    now(): number;
    stop(): void;
}
export declare function createSpeechDriver(backend: AudioBackend, 
/** Injected so the release ramp is testable; defaults to the wall clock. */
wallClock?: () => number): SpeechDriver;
/** Fallback viseme track when the aligner gave us nothing. */
export declare function evenTrack(text: string, durationSeconds: number): Track;
