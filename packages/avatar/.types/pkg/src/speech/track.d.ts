/**
 * The pure half of the speech driver: track shapes, the keyframe sampler, and
 * the ARKit→GNM coefficient matrix. Split out of the reference renderer's
 * single `src/speech.ts` because that file mixed this — which is arithmetic on
 * typed arrays and runs anywhere — with `HTMLAudioElement`, `new Audio()`, and
 * `fetch('/tts')`, which run in exactly one place.
 *
 * The split is the port (doc 22 §4 row 15). It is NOT a platform seam: the
 * playback half is one shared implementation on `react-native-audio-api`,
 * which is Web Audio on iOS, Android and web alike (web delegates to the
 * browser's own AudioContext), so `ctx.currentTime - startTime` replaces
 * `HTMLAudioElement.currentTime` once, everywhere. The split exists because
 * this half is arithmetic that needs no audio device at all — which is what
 * makes the viseme math unit-testable in Node.
 *
 * A track is authored as `[[t, {shapeName: weight}], ...]` and sampled on the
 * audio clock each frame. The face bus — not this module — owns the single
 * expression write per frame.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2, §4 row 15
 * SOT-KEYWORDS: speech viseme track sampler arkit mapper coefficients gesture emage lipsync
 */
/** Named ARKit-style blendshape weights, e.g. `{ jawOpen: 0.4 }`. */
export type Shape = Record<string, number>;
/** Authored viseme track: `[timeSeconds, weights]` keyframes, time-ordered. */
export type Track = [number, Shape][];
/** Co-speech gesture for one utterance (EMAGE, 30 fps in the reference). */
export interface GestureTrack {
    fps: number;
    joints: string[];
    frames: number[][];
}
/** One frame's speech contribution, pulled by the face bus. */
export interface SpeechSample {
    shape: Shape;
    active: boolean;
    gap: boolean;
}
/**
 * Keyframe advance by playback time + smoothstep interpolation.
 *
 * `idx` is carried by the caller across frames: playback is monotonic in the
 * common case, so the scan is O(1) amortised, and the backward `while` keeps
 * a seek or a loop correct rather than fast-and-wrong.
 */
export declare function sampleTrack(track: Track, t: number, idx: number): {
    shape: Shape;
    idx: number;
};
export interface ArkitMap {
    names: string[];
    coeffs: number[][];
}
/**
 * name-indexed flat matrix; out = sum(weight_i * coeffs_i) over nonzero weights.
 *
 * Output length comes from the map's own coefficient length, never a constant —
 * the GNM expression dimension is a property of the head container, and a
 * hard-coded width silently truncates the moment the container changes.
 */
export declare class ArkitMapper {
    readonly dim: number;
    private index;
    private matrix;
    constructor(map: ArkitMap);
    map(shape: Shape): Float32Array;
}
