'use client';
// Tutor audio context — web (Web Audio API).
//
// Creates a single session AudioContext and provides the small platform-specific
// surface the shared queue needs. The public types are deliberately opaque so
// the queue never depends on Web Audio implementation details.
// SOT: docs/pack/32-tutor-voice-tone.md §3 · packages/ui/audio/AudioPlayer.web.tsx
// SOT-KEYWORDS: tutor audio web audio context decode buffer source

export interface TutorAudioBuffer {
  /** Seconds. */
  duration: number;
}

export interface TutorAudioSource {
  start(when?: number): void;
  stop(): void;
}

let context: AudioContext | null = null;

export function ensureTutorAudioContext(): AudioContext {
  if (!context) {
    const Ctx = window.AudioContext;
    context = new Ctx();
  }
  return context;
}

export function resumeTutorAudioContext(): void {
  const ctx = ensureTutorAudioContext();
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
}

export function getTutorAudioContextTime(): number {
  return ensureTutorAudioContext().currentTime;
}

export async function decodeTutorAudioBuffer(buffer: ArrayBuffer): Promise<TutorAudioBuffer> {
  const ctx = ensureTutorAudioContext();
  return ctx.decodeAudioData(buffer) as unknown as TutorAudioBuffer;
}

export function createTutorBufferSource(decoded: TutorAudioBuffer): TutorAudioSource {
  const ctx = ensureTutorAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = decoded as unknown as AudioBuffer;
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
    set onended(handler: (() => void) | null) {
      source.onended = handler;
    },
  } as unknown as TutorAudioSource;
}

export function setTutorSourceEnded(source: TutorAudioSource, onEnded: () => void): void {
  (source as { onended?: (() => void) | null }).onended = onEnded;
}
