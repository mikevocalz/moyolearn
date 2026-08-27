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

/**
 * An item as it comes back off disk: written by whichever build was installed
 * when the child took the picture, so every field has to be treated as maybe.
 */
type PersistedUpload = Partial<QueuedUpload>;

const present = (value: string | undefined): value is string =>
  typeof value === 'string' && value.length > 0;

/**
 * Items read back from storage, minus the ones that could never upload.
 *
 * The persisted shape is a version boundary, not a type: an item enqueued
 * before `messageId`/`attachmentId` existed simply arrives without them, which
 * is why they are optional and why this does not reject it. What it does reject
 * is an item with no `uri` or no `name` — that one can never be presigned, so
 * left in place it would burn all five attempts and then report itself to the
 * child as a photo that "didn't send", which is a lie they can do nothing with.
 *
 * One bad item drops one item. Dropping the whole queue is what a blind cast
 * does when it hands `undefined.length` to the uploader instead.
 */
export function reviveQueue(items: readonly PersistedUpload[]): QueuedUpload[] {
  return items.map(revive).filter((item): item is QueuedUpload => item !== null);
}

function revive(item: PersistedUpload): QueuedUpload | null {
  if (
    !present(item.id) ||
    !present(item.uri) ||
    !present(item.name) ||
    !present(item.mimeType) ||
    !present(item.sessionId)
  ) {
    return null;
  }
  return {
    ...item,
    id: item.id,
    uri: item.uri,
    name: item.name,
    mimeType: item.mimeType,
    sessionId: item.sessionId,
    // An item written before `attempts` was counted starts at zero rather than
    // at NaN, which compares false against MAX_ATTEMPTS and would retry forever.
    attempts: Number.isFinite(item.attempts) ? Number(item.attempts) : 0,
  };
}

/** Applied to the LIVE queue, never to the snapshot a drain pass started from. */
export type QueueTransform = (queue: readonly QueuedUpload[]) => QueuedUpload[];

export const withoutUpload =
  (id: string): QueueTransform =>
  (queue) =>
    queue.filter((item) => item.id !== id);

export const withFailedAttempt =
  (id: string, now?: number): QueueTransform =>
  (queue) =>
    queue.map((item) => (item.id === id ? afterFailure(item, now) : item));

export interface DrainPort {
  /** Throws on failure. The retry policy is driven by exceptions, not by nulls. */
  upload: (item: QueuedUpload) => Promise<CompletedUpload>;
  apply: (transform: QueueTransform) => void;
  onUploaded?: UploadReporter;
}

/**
 * One pass over the due items: upload, delete on success, count on failure.
 *
 * The policy lives here rather than in the store for the reason stated at the
 * top of this file — the store cannot be imported without a device, and "does a
 * failed upload keep its photo" is precisely the behaviour that only ever runs
 * on a bad network. The store supplies the two ports and owns persistence.
 */
export async function drainQueue(
  queue: readonly QueuedUpload[],
  port: DrainPort,
  now = Date.now(),
): Promise<CompletedUpload[]> {
  const completed: CompletedUpload[] = [];
  for (const item of due(queue, now)) {
    let landed: CompletedUpload;
    try {
      landed = await port.upload(item);
      port.apply(withoutUpload(item.id));
    } catch {
      /*
        Counted, not dropped. The backoff is computed from `lastAttemptAt`, so a
        failure has to be recorded for the next drain to know when it may try
        again — and after MAX_ATTEMPTS the item stops being due rather than
        being deleted, so it can still be reported.
      */
      port.apply(withFailedAttempt(item.id));
      continue;
    }
    completed.push(landed);
    try {
      port.onUploaded?.(landed);
    } catch {
      /*
        A consumer that throws while recording the URL must not turn a transfer
        that already succeeded into a failed attempt. Inside the try above it
        would do exactly that: the item would come back due and the same bytes
        would be uploaded a second time to a second key. The upload is the
        queue's job; telling someone about it is not the queue's to retry.
      */
    }
  }
  return completed;
}
