'use client';
// The video-note sheet's open state.
//
// Same boundary problem the attach dialog and the voice recorder have: the
// editor lives inside a Gorhom bottom sheet, and a Modal mounted in there stops
// the sheet mounting its content at all. So the sheet is mounted once at the app
// root and asked for a video through this store.
//
// It settles with the UPLOADED video, not a local file. Video is the one medium
// where that distinction is load-bearing: the upload is resumable and has a
// processing phase after the bytes land, so "the user finished recording" and
// "there is something a note can point at" are minutes apart. Resolving with a
// `file://` path would hand the editor something it must not persist.
// SOT: packages/app/features/media/use-video-upload.ts · docs/pack/29 §4
// SOT-KEYWORDS: video note store request resolve sheet root modal bottom sheet
import { create } from 'zustand';

/** What a finished video note gives the editor. */
export interface UploadedVideo {
  videoId: string;
  playbackUrl: string;
  thumbnailUrl: string;
  /** Seconds, for the link text — the same courtesy the voice note extends. */
  duration: number;
}

interface VideoState {
  open: boolean;
  settle: ((video: UploadedVideo | null) => void) | null;
  request: () => Promise<UploadedVideo | null>;
  resolve: (video: UploadedVideo | null) => void;
}

export const useVideoStore = create<VideoState>((set, get) => ({
  open: false,
  settle: null,

  request: () =>
    new Promise<UploadedVideo | null>((settle) => {
      get().settle?.(null);
      set({ open: true, settle });
    }),

  resolve: (video) => {
    get().settle?.(video);
    set({ open: false, settle: null });
  },
}));
