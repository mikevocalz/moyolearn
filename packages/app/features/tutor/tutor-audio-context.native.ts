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

export async function decodeTutorAudioBuffer(buffer: ArrayBuffer): Promise<TutorAudioBuffer> {
  return decodeAudioData(buffer) as unknown as TutorAudioBuffer;
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
