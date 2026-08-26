'use client';
// Video recording on device (VisionCamera 5).
//
// The caps are handed to the RECORDER, not policed by a JS timer. VisionCamera
// finalises the file itself at `maxDuration`/`maxFileSize` and reports which
// limit ended it, so a recording that hits the ceiling is a complete, usable
// video with an honest explanation — rather than a JS interval racing the
// native encoder and truncating a file mid-write.
//
// State is a scoped store, not `useState`, and the recorder handle lives in it
// too: a store can hold a value nothing subscribes to, which keeps this hook on
// one state mechanism instead of splitting across refs and setters.
// SOT: packages/app/features/media/video-note.constants.ts
// SOT-KEYWORDS: video recorder vision-camera native duration limit zustand
import { useVideoOutput } from 'react-native-vision-camera';
import { useInstanceStore, useStore } from '@acme/ui';
import { VIDEO_MAX_BYTES, VIDEO_MAX_SECONDS } from './video-note.constants.ts';

export type RecorderPhase = 'idle' | 'recording' | 'finished' | 'error';

/** Why a recording ended — the UI says something different for each. */
export type StopReason = 'stopped' | 'max-duration-reached' | 'max-file-size-reached';

interface RecorderState {
  phase: RecorderPhase;
  /** Seconds elapsed. Driven by a tick, purely for display. */
  elapsed: number;
  filePath: string | null;
  reason: StopReason | null;
  error: string | null;
  recorder: { stopRecording: () => Promise<void> } | null;
  tick: ReturnType<typeof setInterval> | null;
}

const INITIAL: RecorderState = {
  phase: 'idle',
  elapsed: 0,
  filePath: null,
  reason: null,
  error: null,
  recorder: null,
  tick: null,
};

export function useVideoRecorder() {
  const videoOutput = useVideoOutput({ enableAudio: true });
  const store = useInstanceStore<RecorderState>(() => ({ ...INITIAL }));
  const state = useStore(store, (s) => s);
  const patch = (next: Partial<RecorderState>) => store.setState((s) => ({ ...s, ...next }));

  const clearTick = () => {
    const t = store.getState().tick;
    if (t) clearInterval(t);
    patch({ tick: null });
  };

  const start = async () => {
    patch({ ...INITIAL, phase: 'recording' });
    try {
      const recorder = await videoOutput.createRecorder({
        maxDuration: VIDEO_MAX_SECONDS,
        maxFileSize: VIDEO_MAX_BYTES,
      });
      await recorder.startRecording(
        (filePath: string, reason: StopReason) => {
          clearTick();
          patch({ phase: 'finished', filePath, reason, recorder: null });
        },
        (error: Error) => {
          clearTick();
          patch({ phase: 'error', error: error.message, recorder: null });
        },
      );
      /*
        A display tick only. The recording's real length is whatever the encoder
        wrote — this counter exists so the number on screen moves, and it is
        never the source of truth for when to stop.
      */
      const tick = setInterval(() => {
        store.setState((s) => ({ ...s, elapsed: s.elapsed + 1 }));
      }, 1000);
      patch({ recorder, tick });
    } catch (error) {
      clearTick();
      patch({ phase: 'error', error: error instanceof Error ? error.message : 'Could not start recording.' });
    }
  };

  const stop = async () => {
    clearTick();
    await store.getState().recorder?.stopRecording();
  };

  const reset = () => {
    clearTick();
    patch({ ...INITIAL });
  };

  return {
    ...state,
    videoOutput,
    start,
    stop,
    reset,
    /** Fraction of the cap used — drives the ring around the shutter. */
    ratio: Math.min(1, state.elapsed / VIDEO_MAX_SECONDS),
    remaining: Math.max(0, VIDEO_MAX_SECONDS - state.elapsed),
  };
}
