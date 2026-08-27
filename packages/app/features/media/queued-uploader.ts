'use client';
// The uploader the queue drains through: presign, then PUT.
//
// Separate from `useBunnyUpload` on purpose. That hook drives a VISIBLE upload —
// progress, cancel, phases a person is watching. A queued upload has no one
// watching: it may run minutes later in a background task, with no component
// mounted and nothing to report progress to. Sharing one function would mean
// the background path carrying UI state it cannot use, and the foreground path
// losing the ability to be cancelled.
//
// It throws on failure rather than returning null, because the queue's retry
// policy is driven by exceptions — a swallowed error would look like success
// and drop the item.
// SOT: packages/app/features/media/upload-queue.store.ts
// SOT-KEYWORDS: queued uploader presign put bunny background drain retry
import { uploadTransport } from './transport';
import type { QueuedUpload } from './upload-queue.shared.ts';

const API_URL =
  (typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_API_URL : undefined) ??
  'http://localhost:3001';

export async function uploadQueued(item: QueuedUpload): Promise<void> {
  const res = await fetch(`${API_URL}/api/media/presign`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      filename: item.name,
      contentType: item.mimeType,
      // The queue holds a local URI, not bytes, so the size is unknown here.
      // The presign route treats 0 as "unmeasured" rather than rejecting it.
      size: 0,
      kind: item.mimeType.startsWith('image/') ? 'image' : 'document',
    }),
  });

  const body = (await res.json()) as { ok: true; uploadUrl: string } | { ok: false; error: string };
  if (!res.ok || body.ok !== true) {
    throw new Error(body.ok === false ? body.error : `Presign failed (${res.status})`);
  }

  await uploadTransport({
    file: { uri: item.uri, name: item.name, type: item.mimeType, size: 0 },
    url: body.uploadUrl,
    contentType: item.mimeType,
    /*
      No progress handler and no abort signal. Nothing is watching, and a
      controller that outlives the component that made it is a leak — the queue
      abandons an item by exhausting its attempts, not by cancelling it.
    */
    onProgress: () => {},
  });
}
