'use client';
// Resumable video upload (doc 29 §3, §4).
//
// TWO PHASES, and conflating them is the mistake this hook exists to avoid.
// `uploading` is bytes leaving the device — real, measurable, cancellable.
// `processing` is Bunny transcoding, which has no byte count and no honest
// percentage. Showing one bar for both means it sits at 100% for a minute while
// the user waits for something the bar already claimed was done.
//
// Cross-session resume works because `tusUrlStorage` supplies what React Native
// cannot: tus-js-client's own store needs Web Storage, so on native
// `findPreviousUploads()` returns nothing forever unless a store is injected.
// SOT: packages/app/features/media/tus-url-storage.ts
// SOT-KEYWORDS: video upload tus resumable stream bunny progress zustand
import * as tus from 'tus-js-client';
import { useInstanceStore, useStore } from '@acme/ui';
import { tusUrlStorage } from './tus-url-storage';
import { useTransferTray } from './transfer-tray.store';
import { API_URL } from '../../core/api-url.ts';

export type VideoPhase = 'idle' | 'preparing' | 'uploading' | 'processing' | 'ready' | 'error';

export interface VideoFile {
  uri: string;
  name: string;
  type: string;
  size: number;
}

/** What a finished upload gives its caller. Final the moment the bytes land. */
export interface UploadedVideoResult {
  videoId: string;
  playbackUrl: string;
  thumbnailUrl: string;
}

interface VideoState {
  phase: VideoPhase;
  ratio: number | null;
  bytesSent: number;
  bytesTotal: number | null;
  error: string | null;
  videoId: string | null;
  playbackUrl: string | null;
  thumbnailUrl: string | null;
  upload: tus.Upload | null;
  /** True when this transfer picked up where a previous session left off. */
  resumed: boolean;
}

const INITIAL: VideoState = {
  phase: 'idle',
  ratio: null,
  bytesSent: 0,
  bytesTotal: null,
  error: null,
  videoId: null,
  playbackUrl: null,
  thumbnailUrl: null,
  upload: null,
  resumed: false,
};

export function useVideoUpload() {
  const store = useInstanceStore<VideoState>(() => ({ ...INITIAL }));
  const state = useStore(store, (s) => s);
  const patch = (next: Partial<VideoState>) => store.setState((s) => ({ ...s, ...next }));

  /*
    `abort` without arguments keeps the upload URL, so start() resumes from the
    server's offset instead of re-sending. Passing `true` would tell the server
    to forget it — which is what "cancel" means, and is a different button.
  */
  const pause = () => void store.getState().upload?.abort();
  const resume = () => void store.getState().upload?.start();
  const cancel = () => {
    void store.getState().upload?.abort(true);
    patch({ ...INITIAL });
  };

  /**
   * Uploads a video and resolves with its URLs once the BYTES have landed.
   *
   * It resolves at `processing`, not at `ready`: Bunny is still transcoding,
   * but the video row exists and its playback and thumbnail URLs are already
   * final, so a caller has everything it needs to persist. Waiting for the
   * transcode would block a note on work the user does not have to watch.
   *
   * Resolves `null` on failure rather than throwing — the phase and the message
   * are already in the store, and a caller that awaits this wants to know
   * whether to proceed, not to handle a second copy of the error.
   */
  const upload = async (file: VideoFile, title: string): Promise<UploadedVideoResult | null> => {
    patch({ ...INITIAL, phase: 'preparing' });
    try {
      const res = await fetch(`${API_URL}/api/media/video`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      const body = (await res.json()) as
        | {
            ok: true;
            endpoint: string;
            libraryId: string;
            videoId: string;
            expire: number;
            signature: string;
            playbackUrl: string;
            thumbnailUrl: string;
          }
        | { ok: false; error: string };
      if (!res.ok || body.ok !== true) {
        patch({ phase: 'error', error: body.ok === false ? body.error : `Could not start (${res.status})` });
        return null;
      }

      patch({
        videoId: body.videoId,
        playbackUrl: body.playbackUrl,
        thumbnailUrl: body.thumbnailUrl,
        bytesTotal: file.size,
        phase: 'uploading',
      });

      /*
        The tray mirrors this transfer under `video-<id>` so a video that
        outlives its sheet still shows its TWO phases there — `processing` when
        the bytes land, never a bar that claims done at 100% (doc 29 §4). The
        row stays at `processing` until whatever subscribes to the Payload
        doc's status dispatches `done`; this hook resolves before the
        transcode on purpose and cannot honestly claim it.
      */
      const trayId = `video-${body.videoId}`;
      const tray = useTransferTray.getState();
      tray.dispatch({ type: 'queued', id: trayId, name: title || file.name, mimeType: file.type, bytesTotal: file.size });
      tray.dispatch({ type: 'begin', id: trayId });

      /*
        React Native has no File or Blob, so tus-js-client accepts the picker's
        `{ uri, type, name }` object and resolves it natively — its own docs say
        so and its React Native demo does exactly this. Its TYPES do not admit
        that shape, listing only File/Blob/Buffer/reader, so this is the one
        place a cast is warranted: the runtime contract is wider than the
        published type. Casting through the constructor's own parameter type
        keeps it honest — if the library ever widens the signature, this stops
        needing the cast rather than silently hiding a real mismatch.
      */
      const asTusFile = (f: VideoFile) =>
        f as unknown as ConstructorParameters<typeof tus.Upload>[0];

      /*
        The tus callbacks are the only place success and failure are known, so
        the promise is settled from inside them. `settle` rather than two
        callbacks because tus can call onError after a retry sequence that
        already reported progress, and a promise must resolve exactly once.
      */
      let settle: (result: UploadedVideoResult | null) => void = () => {};
      const finished = new Promise<UploadedVideoResult | null>((r) => {
        settle = r;
      });

      const tusUpload = new tus.Upload(asTusFile(file), {
        endpoint: body.endpoint,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        urlStorage: tusUrlStorage(),
        // Stable across sessions, so a resumed pick of the same file finds its
        // previous upload rather than starting a second one.
        fingerprint: async () => `bunny-${body.videoId}`,
        headers: {
          AuthorizationSignature: body.signature,
          AuthorizationExpire: String(body.expire),
          VideoId: body.videoId,
          LibraryId: body.libraryId,
        },
        metadata: { filetype: file.type, title },
        onProgress: (sent, total) => {
          patch({ bytesSent: sent, bytesTotal: total, ratio: total > 0 ? sent / total : null });
          useTransferTray.getState().dispatch({ type: 'progress', id: trayId, bytesSent: sent, bytesTotal: total });
        },
        onSuccess: () => {
          // NOT `ready`. The bytes have landed; Bunny has not finished
          // transcoding, and claiming otherwise shows a broken player.
          patch({ phase: 'processing', ratio: 1 });
          useTransferTray.getState().dispatch({ type: 'processing', id: trayId });
          settle({
            videoId: body.videoId,
            playbackUrl: body.playbackUrl,
            thumbnailUrl: body.thumbnailUrl,
          });
        },
        onError: (error) => {
          patch({ phase: 'error', error: error.message });
          useTransferTray.getState().dispatch({ type: 'failed', id: trayId, error: error.message });
          settle(null);
        },
      });

      const previous = await tusUpload.findPreviousUploads();
      if (previous.length > 0 && previous[0]) {
        tusUpload.resumeFromPreviousUpload(previous[0]);
        patch({ resumed: true });
      }
      patch({ upload: tusUpload });
      tusUpload.start();
      return finished;
    } catch (error) {
      patch({ phase: 'error', error: error instanceof Error ? error.message : 'Upload failed.' });
      return null;
    }
  };

  return {
    ...state,
    upload,
    pause,
    resume,
    cancel,
    busy: state.phase === 'preparing' || state.phase === 'uploading',
  };
}
