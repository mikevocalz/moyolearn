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
import {
  drainQueue,
  MAX_ATTEMPTS,
  reviveQueue,
  type CompletedUpload,
  type QueuedUpload,
  type UploadReporter,
} from './upload-queue.shared.ts';
import { mediaExpiry } from './retention.ts';

const QUEUE_KEY = 'media-upload-queue';

function read(): QueuedUpload[] {
  const raw = problemStorage.getString(QUEUE_KEY);
  if (raw === undefined) return [];
  try {
    /*
      Revived, not cast. What is on disk was written by whichever build was
      installed when the photo was taken, so it holds items from before
      `messageId`/`attachmentId` existed — a cast would typecheck and then hand
      the uploader an item it cannot upload. Anything that is not an array at
      all throws inside `reviveQueue` and lands in the same drop-it path below,
      which is the right answer for a value that was never a queue.
    */
    return reviveQueue(JSON.parse(raw) as readonly Partial<QueuedUpload>[]);
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
  /**
   * Runs every due item. Safe to call repeatedly — the drain is idempotent.
   *
   * Completions arrive two ways on purpose. `onUploaded` fires per item, which
   * is what a background wake-up needs: it may upload for a minute and the
   * caller should not have to wait for the slowest photo to hear about the
   * first. The returned array is for a caller that awaited the whole pass and
   * wants the batch — a drain with nobody listening passes no reporter and
   * still uploads, because reporting is the extra and the transfer is the job.
   */
  drain: (
    upload: (item: QueuedUpload) => Promise<CompletedUpload>,
    onUploaded?: UploadReporter,
  ) => Promise<CompletedUpload[]>;
  /** Items that gave up, for telling the learner rather than failing silently. */
  failed: () => QueuedUpload[];
}

export const useUploadQueue = create<QueueState>((set, get) => ({
  queue: read(),

  enqueue: (item) =>
    set((s) => {
      // The retention clock starts at capture, not at upload.
      const queue = [...s.queue, { ...item, attempts: 0, expiresAt: item.expiresAt ?? mediaExpiry(new Date()) }];
      write(queue);
      return { queue };
    }),

  drain: (upload, onUploaded) =>
    /*
      The retry policy is pure and lives in `.shared.ts`; this supplies the two
      things it must not know about — the real uploader and persistence. Each
      transform is applied against the state zustand holds at that instant
      rather than the snapshot the pass began with, because a child can stage
      another photo while a background drain is halfway through the first.
    */
    drainQueue(get().queue, {
      upload,
      apply: (transform) =>
        set((s) => {
          const queue = transform(s.queue);
          write(queue);
          return { queue };
        }),
      onUploaded,
    }),

  failed: () => get().queue.filter((q) => q.attempts >= MAX_ATTEMPTS),
}));
