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
import type { PresignResult } from './media.types.ts';
import type { CompletedUpload, QueuedUpload } from './upload-queue.shared.ts';
import { kindForMime } from './upload-surfaces.shared.ts';
import { useTransferTray } from './transfer-tray.store';
import { API_URL } from '../../core/api-url.ts';

// EXPO_PUBLIC_API_URL first: the queue predates the shared base and native
// builds may still point it at a tunnel. Everything else resolves through the
// one base, so the browser gets same origin instead of a dead port.
const UPLOAD_API_URL =
  (typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_API_URL : undefined) ?? API_URL;

/*
  MediaKind mapping moved to `upload-surfaces.shared.ts` (`kindForMime`) so the
  dropzone's on-drop validation and this presign path can never disagree about
  which rulebook a MIME type answers to. The lesson that put it here originally
  stands: collapsing everything non-image to `document` sent every voice note
  to the wrong allowlist, and the retry policy dutifully re-failed it forever.
*/

/** The tray's event sink. A store, not a hook — this runs with no React tree. */
const tray = () => useTransferTray.getState();

export async function uploadQueued(item: QueuedUpload): Promise<CompletedUpload> {
  /*
    Announced to the tray around the transfer, not inside the queue: the queue's
    retry policy stays pure, and a background drain with no tray mounted just
    updates rows nobody is looking at — which is exactly what "survives
    navigation" costs. `retried` first because this attempt may BE the retry of
    a row the tray shows as failed; on a fresh row it is a no-op.
  */
  tray().dispatch({ type: 'queued', id: item.id, name: item.name, mimeType: item.mimeType, bytesTotal: null });
  tray().dispatch({ type: 'retried', id: item.id });
  tray().dispatch({ type: 'begin', id: item.id });
  try {
    const completed = await uploadQueuedBytes(item);
    tray().dispatch({ type: 'done', id: item.id });
    return completed;
  } catch (error) {
    tray().dispatch({
      type: 'failed',
      id: item.id,
      error: error instanceof Error ? error.message : 'Upload failed.',
    });
    // Rethrown untouched — the queue's retry policy is driven by exceptions.
    throw error;
  }
}

async function uploadQueuedBytes(item: QueuedUpload): Promise<CompletedUpload> {
  const size = await fileSize(item.uri);
  const res = await fetch(`${UPLOAD_API_URL}/api/media/presign`, {
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
      kind: kindForMime(item.mimeType),
    }),
  });

  /*
    Spread from `PresignResult` rather than restating the fields.

    This declared only `uploadUrl`, and the other three were on the wire the
    whole time: the route has always answered with `publicUrl` and `key`. So the
    drain PUT the bytes, deleted the item, and threw away the only record of
    where they had landed — which is why a photo could be displayed on the
    device that took it and nowhere else. Naming the route's own result type
    here means the two can only drift apart by failing to compile.
  */
  const body = (await res.json()) as ({ ok: true } & PresignResult) | { ok: false; error: string };
  if (!res.ok || body.ok !== true) {
    throw new Error(body.ok === false ? body.error : `Presign failed (${res.status})`);
  }

  await uploadTransport({
    file: { uri: item.uri, name: item.name, type: item.mimeType, size },
    url: body.uploadUrl,
    contentType: item.mimeType,
    /*
      Progress goes to the TRAY, not to a component: the row outlives whatever
      screen enqueued it, which is the tray's whole job (doc 30 §4 — per-file
      bytes, never one spinner). Still no abort signal — a controller that
      outlives the component that made it is a leak, and the queue abandons an
      item by exhausting its attempts, not by cancelling it.
    */
    onProgress: (sent, total) =>
      tray().dispatch({ type: 'progress', id: item.id, bytesSent: sent, bytesTotal: total }),
  });

  /*
    Reported only after the PUT resolves. `publicUrl` is readable the instant
    the object exists and not one moment before, so handing it back off the
    presign response alone would name a URL that 404s for as long as the
    transfer takes — and forever if it fails.
  */
  return {
    id: item.id,
    sessionId: item.sessionId,
    messageId: item.messageId,
    attachmentId: item.attachmentId,
    url: body.publicUrl,
    storageKey: body.key,
  };
}
