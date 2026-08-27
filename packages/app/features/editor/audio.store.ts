'use client';
import { create } from 'zustand';
import type { VoiceRecording } from '@acme/ui';

/*
  The recorder's own type, not a narrower copy of it.

  This used to redeclare `{ uri, duration }` and drop `levels` — so the levels
  captured while recording were thrown away one line after they were produced,
  and the inline waveform that `features/editor/upload.ts` documents could not be
  drawn from anything. A duplicated type that is a subset of the real one is how
  a field disappears without anybody deleting it.
*/
export type Recording = VoiceRecording;

/**
 * The voice-note recorder's open state.
 *
 * Same reasoning as the attach dialog: the editor lives inside a Gorhom bottom
 * sheet, and a dialog mounted in there either gets confined to the sheet's box
 * or — if it uses a Modal — stops the sheet mounting at all. So the recorder is
 * mounted once at the app root and asked for a recording through this store.
 */
/**
 * What the composer draws while a recording is in flight.
 *
 * The recorder used to report nothing between "start" and "here is a file", so
 * the composer's recording UI existed and never rendered: a child pressed the
 * microphone and the input sat there looking exactly as it had a second before.
 * Silence from a microphone is the one thing a recorder must never do.
 */
export interface LiveRecording {
  elapsedSec: number;
  /** 0–1 per sample, newest last. Drawn as the level meter. */
  levels: readonly number[];
}

interface AudioState {
  open: boolean;
  /** Non-null only while recording. */
  live: LiveRecording | null;
  setLive: (live: LiveRecording | null) => void;
  /** Stops the take and keeps it. Set by whichever sheet is mounted. */
  stop: (() => void) | null;
  setStop: (stop: (() => void) | null) => void;
  settle: ((recording: Recording | null) => void) | null;
  request: () => Promise<Recording | null>;
  resolve: (recording: Recording | null) => void;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  open: false,
  live: null,
  stop: null,
  settle: null,

  setLive: (live) => set({ live }),
  setStop: (stop) => set({ stop }),

  request: () =>
    new Promise<Recording | null>((settle) => {
      get().settle?.(null);
      set({ open: true, settle });
    }),

  resolve: (recording) => {
    get().settle?.(recording);
    // `live` and `stop` clear with the take: leaving a stale elapsed count
    // behind would make the next recording start mid-way through the last one.
    set({ open: false, settle: null, live: null, stop: null });
  },
}));

/** mm:ss for an elapsed-seconds count. */
export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, '0')}`;
}
