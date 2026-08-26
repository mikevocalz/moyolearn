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

const API_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.EXPO_PUBLIC_APP_URL ?? 'http://localhost:3001';

export type VideoPhase = 'idle' | 'preparing' | 'uploading' | 'processing' | 'ready' | 'error';

export interface VideoFile {
  uri: string;
  name: string;
  type: string;
  size: number;
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

  const upload = async (file: VideoFile, title: string) => {
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
        return;
      }

      patch({
        videoId: body.videoId,
        playbackUrl: body.playbackUrl,
        thumbnailUrl: body.thumbnailUrl,
        bytesTotal: file.size,
        phase: 'uploading',
      });

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
        onProgress: (sent, total) =>
          patch({ bytesSent: sent, bytesTotal: total, ratio: total > 0 ? sent / total : null }),
        onSuccess: () =>
          // NOT `ready`. The bytes have landed; Bunny has not finished
          // transcoding, and claiming otherwise shows a broken player.
          patch({ phase: 'processing', ratio: 1 }),
        onError: (error) => patch({ phase: 'error', error: error.message }),
      });

      const previous = await tusUpload.findPreviousUploads();
      if (previous.length > 0 && previous[0]) {
        tusUpload.resumeFromPreviousUpload(previous[0]);
        patch({ resumed: true });
      }
      patch({ upload: tusUpload });
      tusUpload.start();
    } catch (error) {
      patch({ phase: 'error', error: error instanceof Error ? error.message : 'Upload failed.' });
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
