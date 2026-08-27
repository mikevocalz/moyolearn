'use client';
// The transfer rows behind the TransferTray, and nothing visual.
//
// MODULE-LEVEL on purpose, where the kit rule is per-instance stores: the tray
// is the one surface that must survive the screen that started an upload —
// that is its entire job (doc 30 §1) — and there is exactly one of it per app,
// the same way there is one upload queue. Two trays sharing rows is the
// correct behaviour, not the bug `useInstanceStore` exists to prevent.
//
// The rows MIRROR the persisted queue rather than replacing it: enqueue
// anywhere (dropzone, voice note, homework capture) and the row appears here,
// because there is one queue and one set of rules (doc 30 §8.2). Bytes and
// phases arrive as events from `queued-uploader` and `use-video-upload`; the
// reducer that orders them is pure and lives in `upload-surfaces.shared.ts`.
// SOT: docs/pack/30-upload-surfaces-spec.md §1, §4 · upload-surfaces.shared.ts
// SOT-KEYWORDS: transfer tray store transfers rows tabs minimize retry resume queue
import { create } from 'zustand';
import {
  applyTransfer,
  type TransferEvent,
  type TransferRow,
  type TrayTab,
} from './upload-surfaces.shared.ts';
import { MAX_ATTEMPTS, type QueuedUpload } from './upload-queue.shared.ts';
import { useUploadQueue } from './upload-queue.store';
import { drainNow } from './upload-queue';

interface TrayState {
  rows: TransferRow[];
  tab: TrayTab;
  minimized: boolean;
  dispatch: (event: TransferEvent) => void;
  setTab: (tab: TrayTab) => void;
  setMinimized: (minimized: boolean) => void;
  /**
   * Per-file retry that RESUMES (doc 30 §4). For a queue item this makes the
   * one exhausted item due again and re-drains — the drain only runs due items,
   * so nothing else restarts. TUS video keeps its fingerprint and continues
   * from the server's offset via its own resume path.
   */
  retry: (id: string) => void;
  clearCompleted: () => void;
}

export const useTransferTray = create<TrayState>((set, get) => ({
  rows: [],
  tab: 'all',
  minimized: false,

  dispatch: (event) => set((s) => ({ rows: applyTransfer(s.rows, event) })),

  setTab: (tab) => set({ tab }),
  setMinimized: (minimized) => set({ minimized }),

  retry: (id) => {
    get().dispatch({ type: 'retried', id });
    useUploadQueue.getState().retry(id);
    // Fire-and-forget: the row's own events report the outcome, not this call.
    void drainNow();
  },

  clearCompleted: () => get().dispatch({ type: 'cleared' }),
}));

/** One tray row per queue item — including what a previous launch left behind. */
const mirror = (queue: readonly QueuedUpload[]) => {
  const { dispatch } = useTransferTray.getState();
  for (const item of queue) {
    dispatch({ type: 'queued', id: item.id, name: item.name, mimeType: item.mimeType, bytesTotal: null });
    if (item.attempts >= MAX_ATTEMPTS) {
      // Exhausted means "this one didn't send" — surfaced, never silent.
      dispatch({ type: 'failed', id: item.id, error: 'This file didn’t send.' });
    }
  }
};

/*
  Subscribed at module scope, not in a component: an upload enqueued by a
  background capture with no tray mounted must still have a row waiting when
  the tray next renders. The reducer makes re-announcing an existing id a
  no-op, so mirroring the whole queue on every change is idempotent.
*/
mirror(useUploadQueue.getState().queue);
useUploadQueue.subscribe((s) => mirror(s.queue));
