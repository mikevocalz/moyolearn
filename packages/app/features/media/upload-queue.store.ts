'use client';
// The persisted upload queue, and the drain that empties it.
//
// This is the piece that makes `upload-queue.shared` more than a policy: it
// holds the items across launches and hands each due one to the real Bunny
// presign path.
//
// Persistence is the same synchronous key-value contract the rest of the app
// uses — MMKV on native, localStorage on web — because a queue that only lives
// in memory is a queue that loses exactly what it was built to protect.
// SOT: packages/app/features/media/upload-queue.shared.ts
// SOT-KEYWORDS: upload queue store persist drain bunny retry offline media
import { create } from 'zustand';
import { problemStorage } from '../capture/problem-storage';
import { afterFailure, due, MAX_ATTEMPTS, type QueuedUpload } from './upload-queue.shared.ts';

const QUEUE_KEY = 'media-upload-queue';

function read(): QueuedUpload[] {
  const raw = problemStorage.getString(QUEUE_KEY);
  if (raw === undefined) return [];
  try {
    return JSON.parse(raw) as QueuedUpload[];
  } catch {
    // A corrupt queue is worse than an empty one: it would fail every drain
    // forever. Drop it rather than retry a parse that cannot succeed.
    problemStorage.remove(QUEUE_KEY);
    return [];
  }
}

const write = (queue: QueuedUpload[]) => problemStorage.set(QUEUE_KEY, JSON.stringify(queue));

interface QueueState {
  queue: QueuedUpload[];
  enqueue: (item: Omit<QueuedUpload, 'attempts'>) => void;
  /** Runs every due item. Safe to call repeatedly — the drain is idempotent. */
  drain: (upload: (item: QueuedUpload) => Promise<void>) => Promise<void>;
  /** Items that gave up, for telling the learner rather than failing silently. */
  failed: () => QueuedUpload[];
}

export const useUploadQueue = create<QueueState>((set, get) => ({
  queue: read(),

  enqueue: (item) =>
    set((s) => {
      const queue = [...s.queue, { ...item, attempts: 0 }];
      write(queue);
      return { queue };
    }),

  drain: async (upload) => {
    for (const item of due(get().queue)) {
      try {
        await upload(item);
        set((s) => {
          const queue = s.queue.filter((q) => q.id !== item.id);
          write(queue);
          return { queue };
        });
      } catch {
        /*
          Counted, not dropped. The backoff is computed from `lastAttemptAt`, so
          a failure has to be recorded for the next drain to know when it may
          try again — and after MAX_ATTEMPTS the item stops being due rather
          than being deleted, so it can still be reported.
        */
        set((s) => {
          const queue = s.queue.map((q) => (q.id === item.id ? afterFailure(q) : q));
          write(queue);
          return { queue };
        });
      }
    }
  },

  failed: () => get().queue.filter((q) => q.attempts >= MAX_ATTEMPTS),
}));
