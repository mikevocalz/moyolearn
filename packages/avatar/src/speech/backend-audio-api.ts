/**
 * The one audio backend, for all three platforms.
 *
 * `react-native-audio-api` is a real Web Audio implementation — C++ core over
 * AVFoundation on iOS and Oboe on Android — and on web it delegates to the
 * browser's own `window.AudioContext`. So `AudioContext.currentTime`,
 * `decodeAudioData(arrayBuffer)` and `bufferSource.start(when)` are the SAME
 * API everywhere, and the reference's `HTMLAudioElement.currentTime` becomes
 * `ctx.currentTime - startTime` once, shared. Doc 22 §4 row 15.
 *
 * It is also a better clock than the one it replaces: the audio-graph clock is
 * higher-resolution than `HTMLAudioElement.currentTime`, which is coarse and
 * jittery. The mouth cannot be better than the clock.
 *
 * THIS FILE IS NOT UNIT-TESTED and cannot be — it is the device edge. All the
 * logic worth testing lives behind `AudioBackend` in ./driver.ts and runs in
 * Node against a fake clock. Keep this file thin enough that reading it is
 * sufficient review; anything with a decision in it belongs next door.
 *
 * Three things that do NOT unify, and are deliberately not papered over here:
 *   - `onPositionChanged` and `getLatency()` are mobile-only; the driver polls
 *     `now()` per frame instead, which is the better primitive anyway.
 *   - `currentTime` is the graph clock, not the speaker clock, so a Bluetooth
 *     route's 150-300ms is invisible to it. If a per-route offset proves
 *     necessary, it belongs here, fed by AudioManager's `routeChange`.
 *   - iOS session configuration must happen before any AudioContext exists,
 *     and an invalid category/option pair throws and produces TOTAL SILENCE —
 *     a mute avatar with no error in front of a child. That setup is the app's
 *     job at startup, not this module's.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §4 row 15
 * SOT-KEYWORDS: audio backend react-native-audio-api web-audio context currenttime decode play
 */
import type { AudioBackend, DecodedUtterance } from './driver.ts';

/**
 * The slice of `react-native-audio-api` this backend uses, declared rather than
 * imported so the package does not take a hard dependency on the module in
 * environments that never play audio (the golden harness, the unit suite).
 */
export interface WebAudioLike {
  readonly currentTime: number;
  decodeAudioData(audio: ArrayBuffer): Promise<AudioBufferLike>;
  createBufferSource(): AudioBufferSourceLike;
  readonly destination: unknown;
}

export interface AudioBufferLike {
  readonly duration: number;
}

export interface AudioBufferSourceLike {
  buffer: AudioBufferLike | null;
  connect(destination: unknown): void;
  start(when?: number): void;
  stop(when?: number): void;
}

export function createAudioApiBackend(context: WebAudioLike): AudioBackend {
  // A source node is single-use by spec — `start()` twice throws
  // InvalidStateError — so each utterance gets a fresh one. The decoded buffer
  // is what is reusable, and that is what `decode()` hands back.
  let source: AudioBufferSourceLike | null = null;

  return {
    now: () => context.currentTime,

    async decode(audio: ArrayBuffer): Promise<DecodedUtterance> {
      const buffer = await context.decodeAudioData(audio);
      return { handle: buffer, durationSeconds: buffer.duration };
    },

    play(utterance: DecodedUtterance, when: number): void {
      const next = context.createBufferSource();
      next.buffer = utterance.handle as AudioBufferLike;
      next.connect(context.destination);
      next.start(when);
      source = next;
    },

    stop(): void {
      if (!source) return;
      try {
        source.stop();
      } catch {
        // Stopping a source that never started, or already ended, throws. That
        // is not an error condition for us — it is the state we wanted.
      }
      source = null;
    },
  };
}
