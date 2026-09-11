'use client';
// Tutor audio context — native (`react-native-audio-api`).
//
// Delegates to the Web Audio-shaped implementation so the shared queue can use
// the same pattern across platforms. iOS session category setup is the app
// shell's responsibility at startup, not here.
// SOT: docs/pack/32-tutor-voice-tone.md §3 · packages/ui/audio/AudioPlayer.native.tsx
// SOT-KEYWORDS: tutor audio native react native audio api decode buffer source

import { AudioContext, decodeAudioData } from 'react-native-audio-api';

export interface TutorAudioBuffer {
  /** Seconds. */
  duration: number;
  /** For the lipsync analysis — see `@acme/avatar`'s `analyseSpeech`. */
  sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

export interface TutorAudioSource {
  start(when?: number): void;
  stop(): void;
}

let context: AudioContext | null = null;

export function ensureTutorAudioContext(): AudioContext {
  if (!context) {
    context = new AudioContext();
  }
  return context;
}

export function resumeTutorAudioContext(): void {
  const ctx = ensureTutorAudioContext();
  // `react-native-audio-api` mirrors the Web Audio `state` field.
  if ((ctx as { state?: string }).state === 'suspended') {
    void (ctx as { resume?: () => Promise<void> }).resume?.();
  }
}

export function getTutorAudioContextTime(): number {
  return (ensureTutorAudioContext() as { currentTime: number }).currentTime;
}

/**
 * DECODE AT THE CONTEXT'S RATE, NOT THE FILE'S — this argument is the whole
 * fix for a lip-sync drift that got worse the longer Natalie spoke.
 *
 * The web fork gets this invariant for free: `BaseAudioContext.decodeAudioData`
 * is specified to resample to `ctx.sampleRate`, so a decoded buffer always
 * matches the graph that will play it. This fork used the module-level
 * `decodeAudioData`, which takes an OPTIONAL rate and turns its absence into
 * `0` — miniaudio's "keep the file's rate". Nothing downstream corrects it:
 * the buffer source's playback rate is `playbackRate * detune` with no
 * `buffer.sampleRate / context.sampleRate` factor, so the read cursor advances
 * one file-frame per output-frame.
 *
 * The TTS is `mp3_44100_64` (`@acme/voice`'s LIVE_OUTPUT_FORMAT) and an
 * Android `AudioContext` takes the device rate, which is 48000 on essentially
 * every modern handset. 48000/44100 = 1.0884, so the voice played 8.84% fast
 * and sharp while the viseme cursor — `context.currentTime - playbackStartAt`,
 * in real seconds — indexed a timeline in clip seconds. The mouth trailed the
 * voice by 0.0884*t: ~88ms at 1s, ~265ms at 3s, ~440ms at 5s, resetting each
 * sentence. It also made the mouth run ~8% past the end of every sentence,
 * because `activeDuration` is in clip seconds and `onEnded` fired early.
 *
 * `analyseSpeech` needs no change: it reads `decoded.sampleRate`, which is now
 * the context's.
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §3 (turn-taking)
 * SOT-KEYWORDS: audio decode sample rate resample lipsync viseme drift native android
 */
export async function decodeTutorAudioBuffer(buffer: ArrayBuffer): Promise<TutorAudioBuffer> {
  const ctx = ensureTutorAudioContext() as { sampleRate: number };
  return decodeAudioData(buffer, ctx.sampleRate) as unknown as TutorAudioBuffer;
}

export function createTutorBufferSource(decoded: TutorAudioBuffer): TutorAudioSource {
  const ctx = ensureTutorAudioContext();
  const source = ctx.createBufferSource();
  (source as { buffer?: unknown }).buffer = decoded;
  source.connect(ctx.destination);
  return {
    start(when = 0) {
      source.start(when);
    },
    stop() {
      try {
        source.stop();
      } catch {
        // Already stopped or never started; the state we wanted.
      }
    },
    set onEnded(handler: (() => void) | null) {
      (source as { onEnded?: (() => void) | null }).onEnded = handler;
    },
  } as unknown as TutorAudioSource;
}

export function setTutorSourceEnded(source: TutorAudioSource, onEnded: () => void): void {
  (source as { onEnded?: (() => void) | null }).onEnded = onEnded;
}
