'use client';
// The in-session camera's open state — same shape as `editor/audio.store.ts`,
// and for the same reason: the sheet is mounted ONCE at the app root and asked
// for a photo through this store, so a composer inside a bottom sheet can raise
// a full-screen viewfinder without owning it.
//
// It also keeps the tutor session MOUNTED. Navigating to `/capture` and back
// would tear down the WebGPU stage and re-parse a 14 MB body every time a child
// photographs a worksheet mid-lesson.
// SOT: packages/app/features/editor/audio.store.ts · docs/pack/24-homework-capture-spec.md §2
// SOT-KEYWORDS: camera store sheet request resolve guided frame capture homework session
import { create } from 'zustand';
import type { CameraImage } from '../tutor/pick-camera.types.ts';

interface CameraState {
  open: boolean;
  settle: ((photo: CameraImage | null) => void) | null;
  /** Opens the sheet and resolves with the cropped photo, or null on cancel. */
  request: () => Promise<CameraImage | null>;
  resolve: (photo: CameraImage | null) => void;
}

export const useCameraStore = create<CameraState>((set, get) => ({
  open: false,
  settle: null,

  request: () =>
    new Promise<CameraImage | null>((settle) => {
      // A pending request is cancelled rather than left hanging — two opens
      // without this leaves the first promise unresolved for the session.
      get().settle?.(null);
      set({ open: true, settle });
    }),

  resolve: (photo) => {
    get().settle?.(photo);
    set({ open: false, settle: null });
  },
}));
