/**
 * The speech driver: everything that turns "an utterance is playing" into
 * per-frame viseme weights and a co-speech gesture pose.
 *
 * The audio device is behind `AudioBackend` — a four-method interface — for one
 * reason that matters more than testability: the mouth cannot be better than
 * the clock, and this file is where the clock is read. Keeping the device
 * abstract means the sampling logic runs in Node against a fake clock, so the
 * onset lead, the release tail and the gesture interpolation are unit-testable
 * rather than eyeballed on a device.
 *
 * The real backend is `./backend-audio-api.ts`, on `react-native-audio-api` —
 * Web Audio on iOS and Android, delegating to the browser's own AudioContext on
 * web, so there is ONE implementation for all three platforms (doc 22 §4 row 15).
 * `HTMLAudioElement.currentTime` becomes `ctx.currentTime - startTime`, which is
 * also a higher-resolution clock than the one it replaces.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2, §4 row 15
 * SOT-KEYWORDS: speech driver audio clock viseme gesture onset release backend playback
 */
import { idleConfig } from '../idle/config.ts';
import { sampleTrack, type GestureTrack, type Shape, type SpeechSample, type Track } from './track.ts';

/**
 * Pre-speech lookahead. The idle engine schedules its anticipation beat against
 * this, so it must be known BEFORE playback starts — which is why an utterance
 * decodes first and is then scheduled a fixed lead out, rather than played the
 * moment it arrives.
 */
export const ONSET_LEAD_MS = 300;

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
  sampleGesture(): { joints: string[]; pose: Float32Array } | null;
  /** Decodes, schedules the onset a fixed lead out, and starts playback. */
  speak(utterance: Utterance): Promise<void>;
  /** Wall-clock ms at which the next onset is scheduled, or 0. */
  readonly scheduledOnsetAt: number;
  /** Playback position in seconds within the active utterance. */
  now(): number;
  stop(): void;
}

export function createSpeechDriver(
  backend: AudioBackend,
  /** Injected so the release ramp is testable; defaults to the wall clock. */
  wallClock: () => number = () => Date.now()
): SpeechDriver {
  let track: Track | null = null;
  let gesture: GestureTrack | null = null;
  let trackIdx = 0;
  let lastShape: Shape = {};
  let release: { shape: Shape; start: number } | null = null;

  let active: DecodedUtterance | null = null;
  let startedAt = 0; // backend clock, seconds
  let scheduledOnsetAt = 0; // wall clock, ms

  const playbackSeconds = (): number => {
    if (!active) return 0;
    const t = backend.now() - startedAt;
    if (t < 0) return 0;
    return t > active.durationSeconds ? active.durationSeconds : t;
  };

  const playing = (): boolean =>
    active !== null && backend.now() >= startedAt && playbackSeconds() < active.durationSeconds;

  return {
    get scheduledOnsetAt() {
      return scheduledOnsetAt;
    },

    now: playbackSeconds,

    sampleSpeech(nowMs: number): SpeechSample {
      if (playing() && track) {
        const sampled = sampleTrack(track, playbackSeconds(), trackIdx);
        trackIdx = sampled.idx;
        lastShape = sampled.shape;
        let sum = 0;
        for (const k in sampled.shape) sum += Math.abs(sampled.shape[k] as number);
        return {
          shape: sampled.shape,
          active: true,
          gap: sum < idleConfig.speech.gapWeightSum,
        };
      }
      // Playback ended: ease the last shape out rather than snapping the mouth
      // shut, which reads as a glitch on a face.
      if (active && !playing() && !release && Object.keys(lastShape).length > 0) {
        release = { shape: lastShape, start: nowMs };
        active = null;
      }
      if (release) {
        const p = Math.min(1, (nowMs - release.start) / idleConfig.speech.releaseMs);
        if (p >= 1) {
          release = null;
          lastShape = {};
        } else {
          const shape: Shape = {};
          for (const k in release.shape) shape[k] = (release.shape[k] as number) * (1 - p);
          return { shape, active: false, gap: false };
        }
      }
      return { shape: {}, active: false, gap: false };
    },

    sampleGesture() {
      if (!gesture || !playing()) return null;
      const frames = gesture.frames;
      if (frames.length === 0) return null;
      const f = playbackSeconds() * gesture.fps;
      const i = Math.min(Math.floor(f), frames.length - 1);
      const j = Math.min(i + 1, frames.length - 1);
      const k = f - i;
      const a = frames[i] as number[];
      const b = frames[j] as number[];
      const out = new Float32Array(a.length);
      for (let n = 0; n < a.length; ++n) {
        out[n] = (a[n] as number) * (1 - k) + (b[n] as number) * k;
      }
      return { joints: gesture.joints, pose: out };
    },

    async speak(utterance: Utterance): Promise<void> {
      // An utterance already playing releases rather than cutting.
      if (active) release = { shape: lastShape, start: wallClock() };
      backend.stop();

      // Decode FIRST. `decodeAudioData` resolves only after the whole buffer
      // decodes, so scheduling before this point would schedule against a
      // duration nobody knows yet — and the idle engine's anticipation beat is
      // keyed off the onset.
      const decoded = await backend.decode(utterance.audio);

      track = utterance.track && utterance.track.length ? utterance.track : null;
      gesture = utterance.gesture && utterance.gesture.frames?.length ? utterance.gesture : null;
      trackIdx = 0;

      if (!track) {
        // Alignment unavailable: spread letters evenly across the known
        // duration. A talking face with approximate timing beats a still one.
        track = evenTrack(utterance.text, decoded.durationSeconds);
      }

      const lead = ONSET_LEAD_MS / 1000;
      startedAt = backend.now() + lead;
      scheduledOnsetAt = wallClock() + ONSET_LEAD_MS;
      active = decoded;
      release = null;
      backend.play(decoded, startedAt);
    },

    stop() {
      backend.stop();
      active = null;
      track = null;
      gesture = null;
      release = null;
      lastShape = {};
      scheduledOnsetAt = 0;
    },
  };
}

/** Fallback viseme track when the aligner gave us nothing. */
export function evenTrack(text: string, durationSeconds: number): Track {
  const letters = text.split('');
  const keys: Track = [[0, {}]];
  letters.forEach((c, i) => {
    if (/[a-z]/i.test(c)) {
      keys.push([
        durationSeconds * (i / letters.length),
        { jawOpen: 'aeiou'.includes(c.toLowerCase()) ? 0.5 : 0.2 },
      ]);
    }
  });
  keys.push([durationSeconds, {}]);
  return keys;
}
