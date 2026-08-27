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
import { fileSize } from './file-size';
import type { QueuedUpload } from './upload-queue.shared.ts';

const API_URL =
  (typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_API_URL : undefined) ??
  'http://localhost:3001';

/**
 * MediaKind from the MIME type.
 *
 * There are THREE kinds, and this collapsed everything non-image to
 * `document` — so every voice note was presigned as a document and rejected
 * with "audio/m4a can't be uploaded here." The queue then retried it on
 * schedule, forever, against a rule that could never pass. The retry policy
 * worked perfectly and was the reason nobody would have noticed.
 */
function kindFor(mimeType: string): 'image' | 'audio' | 'document' {
  if (mimeType.startsWith('image/')) return 'image';
  // `video/mp4` is in the audio allowlist: a recorder writing an .mp4 container
  // is still a voice note, and the presign rules already say so.
  if (mimeType.startsWith('audio/') || mimeType === 'video/mp4') return 'audio';
  return 'document';
}

export async function uploadQueued(item: QueuedUpload): Promise<void> {
  const size = await fileSize(item.uri);
  const res = await fetch(`${API_URL}/api/media/presign`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      filename: item.name,
      contentType: item.mimeType,
      /*
        MEASURED, not assumed.

        This sent 0 with a comment asserting the presign route reads that as
        "unmeasured". It does not — it rejects it with "That file appears to be
        empty", so every queued upload failed validation and the retry policy
        dutifully re-failed it on schedule. `fileSize` already existed for
        exactly this, platform-forked; I wrote an assumption instead of using it.
      */
      size,
      kind: kindFor(item.mimeType),
    }),
  });

  const body = (await res.json()) as { ok: true; uploadUrl: string } | { ok: false; error: string };
  if (!res.ok || body.ok !== true) {
    throw new Error(body.ok === false ? body.error : `Presign failed (${res.status})`);
  }

  await uploadTransport({
    file: { uri: item.uri, name: item.name, type: item.mimeType, size },
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
