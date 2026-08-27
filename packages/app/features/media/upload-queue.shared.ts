// Uploads that survive a dropped connection.
//
// A child photographs four problems on school wi-fi, the network drops
// mid-upload, and the app is closed before it comes back. Without a queue those
// photos are gone — the turn was sent, the images were not, and nobody finds out
// until a tutor opens the session and sees text referring to pictures that
// aren't there.
//
// The queue is persisted, so it outlives both the network and the process. What
// drains it differs by platform and is deliberately NOT decided here:
//
//   native — `expo-background-task`, which the OS runs when it suits: on
//            charge, on wi-fi, minutes or hours later. Deferred is the right
//            shape for an upload nobody is watching, and the wrong shape for
//            anything a child is waiting on, which is why OCR stayed in-process.
//   web    — a drain on load and on `online`, because a browser tab has no
//            equivalent guarantee and pretending otherwise would be worse than
//            being plain about it.
//
// Pure: no storage, no fetch, no platform imports, so the retry policy can be
// tested without a device.
// SOT: docs/pack/29-bunny-media-spec.md §3
// SOT-KEYWORDS: upload queue background retry offline resilience media bunny
export interface QueuedUpload {
  id: string;
  /** Local URI. Still on the device — the whole point is that it has not left. */
  uri: string;
  name: string;
  mimeType: string;
  /** What this belongs to, so a drained upload can be attached to its turn. */
  sessionId: string;
  /**
   * When the stored object may be deleted. Stamped at ENQUEUE, not at upload:
   * the window starts when the child took the picture, so a file that sat in a
   * queue for two days does not get a fresh week once it finally lands.
   */
  expiresAt?: string;
  attempts: number;
  /** Epoch ms. Set when an attempt fails, so backoff is computable offline. */
  lastAttemptAt?: number;
  /**
   * Which message the attachment hangs off, and which attachment inside it.
   *
   * Both OPTIONAL, and not because they are decoration: the queue is persisted,
   * so a photo enqueued by yesterday's build is read back by today's and has
   * never heard of either field. Making them required would make every item
   * already on a device unrevivable — the exact photos the queue exists to
   * protect. `sessionId` is enough to file an upload under a session; these two
   * are what let it be filed against the message a child is looking at.
   */
  messageId?: string;
  attachmentId?: string;
}

/**
 * What a finished upload reports back.
 *
 * The drain used to delete the item and return nothing, so the location Bunny
 * had just handed us died inside the loop and only the device that took the
 * photo could ever display it. `url` is what renders; `storageKey` is the
 * durable handle (`url` is derived from it, and a CDN hostname change does not
 * invalidate it). The identifiers travel back with them because a background
 * drain finishing minutes later cannot be correlated by arrival order.
 */
export interface CompletedUpload {
  /** The queue item's `id` — the handle the caller enqueued under. */
  id: string;
  sessionId: string;
  messageId?: string;
  attachmentId?: string;
  url: string;
  storageKey: string;
}

/** Told about each upload that really landed. Never told about failures. */
export type UploadReporter = (completed: CompletedUpload) => void;

/**
 * Five attempts, then it stops trying.
 *
 * Not because five is magic, but because a queue that retries forever is a
 * queue that never tells anyone it is stuck — and a photo that will never
 * upload should surface to the child as "this one didn't send" rather than
 * draining their battery in silence.
 */
export const MAX_ATTEMPTS = 5;

/** 2s, 8s, 32s, 128s — exponential, so a flapping network is not hammered. */
export function backoffMs(attempts: number): number {
  return 2000 * 4 ** Math.max(0, attempts - 1);
}

export function isDue(item: QueuedUpload, now = Date.now()): boolean {
  if (item.attempts >= MAX_ATTEMPTS) return false;
  if (item.attempts === 0 || item.lastAttemptAt === undefined) return true;
  return now - item.lastAttemptAt >= backoffMs(item.attempts);
}

/** Items worth trying right now, oldest first so nothing starves. */
export function due(queue: readonly QueuedUpload[], now = Date.now()): QueuedUpload[] {
  return queue.filter((item) => isDue(item, now));
}

/** Items that have given up, for surfacing to the learner. */
export function abandoned(queue: readonly QueuedUpload[]): QueuedUpload[] {
  return queue.filter((item) => item.attempts >= MAX_ATTEMPTS);
}

export function afterFailure(item: QueuedUpload, now = Date.now()): QueuedUpload {
  return { ...item, attempts: item.attempts + 1, lastAttemptAt: now };
}
