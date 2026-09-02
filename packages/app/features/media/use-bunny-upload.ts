'use client';
// The upload state machine (doc 29 §3): presign → PUT → done.
//
// ONE store per hook instance, never `useState` — and never a module-level
// `create()`, which would make two simultaneous uploads share one progress bar.
//
// Progress is BYTES, not a spinner. A batch spinner cannot say which file is
// moving, and a determinate bar with nothing behind it teaches people to
// distrust the ones that mean something (the doctrine already written into
// features/editor/attachment.ts — kept here deliberately).
//
// The abort controller lives in the store rather than a ref: a store can hold a
// value nothing subscribes to, and keeping it there means the hook has one state
// mechanism instead of two.
// SOT: docs/decisions/bunny-storage-presign-spike.md
// SOT-KEYWORDS: upload hook bunny presign progress zustand media state machine
import { useInstanceStore, useStore } from '@acme/ui';
import { uploadTransport } from './transport';
import { MAX_BYTES, type MediaKind, type PresignResult } from './media.types.ts';
import { API_URL } from '../../core/api-url.ts';

/**
 * `validating` and `uploading` are separate states because they fail for
 * different reasons and a user can act on only one of them: a rejected type is
 * fixable by picking another file, a failed PUT is fixable by retrying.
 */
export type UploadPhase = 'idle' | 'validating' | 'uploading' | 'done' | 'error';

export interface PickedFile {
  uri: string;
  name: string;
  type: string;
  size: number;
}

interface UploadState {
  phase: UploadPhase;
  /** 0–1. Null while the total length is unknown — an indeterminate bar. */
  ratio: number | null;
  bytesSent: number;
  bytesTotal: number | null;
  error: string | null;
  result: PresignResult | null;
  controller: AbortController | null;
}

const INITIAL: UploadState = {
  phase: 'idle',
  ratio: null,
  bytesSent: 0,
  bytesTotal: null,
  error: null,
  result: null,
  controller: null,
};

export function useBunnyUpload(kind: MediaKind) {
  const store = useInstanceStore<UploadState>(() => ({ ...INITIAL }));
  const state = useStore(store, (s) => s);
  const patch = (next: Partial<UploadState>) => store.setState((s) => ({ ...s, ...next }));

  const cancel = () => {
    store.getState().controller?.abort();
    patch({ ...INITIAL });
  };

  const upload = async (file: PickedFile): Promise<PresignResult | null> => {
    /*
      The size ceiling is checked HERE as well as on the server. Not because the
      client can be trusted — it cannot, which is why the server checks too — but
      because a user who picked a 90MB file deserves to hear so immediately
      rather than after a round trip.
    */
    if (file.size > MAX_BYTES[kind]) {
      const mb = Math.round(MAX_BYTES[kind] / (1024 * 1024));
      patch({ phase: 'error', error: `That file is larger than the ${mb} MB limit.` });
      return null;
    }

    const controller = new AbortController();
    patch({ ...INITIAL, phase: 'validating', controller });

    try {
      const res = await fetch(`${API_URL}/api/media/presign`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size, kind }),
        signal: controller.signal,
      });
      /*
        A discriminated union, so the failure branch cannot read a field the
        success branch has and vice versa — `ok` is the discriminant and TS
        narrows on it rather than on `'error' in body`.
      */
      const body = (await res.json()) as
        | ({ ok: true } & PresignResult)
        | { ok: false; error: string };

      if (!res.ok || body.ok !== true) {
        // The server's sentence, not `HTTP 422` — it is the only text in this
        // path written for a person.
        const message = body.ok === false ? body.error : `Upload failed (${res.status})`;
        patch({ phase: 'error', error: message, controller: null });
        return null;
      }

      patch({ phase: 'uploading', bytesTotal: file.size, result: body });

      await uploadTransport({
        file,
        url: body.uploadUrl,
        contentType: file.type,
        signal: controller.signal,
        onProgress: (sent, total) =>
          patch({
            bytesSent: sent,
            bytesTotal: total || null,
            ratio: total > 0 ? sent / total : null,
          }),
      });

      patch({ phase: 'done', ratio: 1, bytesSent: file.size, controller: null });
      return body;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        patch({ ...INITIAL });
        return null;
      }
      patch({
        phase: 'error',
        error: error instanceof Error ? error.message : 'Upload failed.',
        controller: null,
      });
      return null;
    }
  };

  return {
    ...state,
    upload,
    cancel,
    /** True while bytes are moving — the moment to disable a second pick. */
    busy: state.phase === 'validating' || state.phase === 'uploading',
  };
}
