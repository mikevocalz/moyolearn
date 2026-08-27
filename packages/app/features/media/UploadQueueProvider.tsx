'use client';
// Starts the upload queue draining, once, for the whole app.
//
// Mounted at the root rather than inside a screen: a queued upload has to
// survive the screen that created it — that is the entire point — and a drain
// registered in a component that unmounts stops draining the moment the child
// navigates away from the tutor.
//
// It renders nothing. This is a lifecycle, not a surface.
// SOT: packages/app/features/media/upload-queue.ts
// SOT-KEYWORDS: upload queue provider drain register background root lifecycle
import { useEffect } from 'react';
import { registerUploadDrain, setUploadDrain, unregisterUploadDrain } from './upload-queue';
import { useUploadQueue } from './upload-queue.store';
import { uploadQueued } from './queued-uploader';

export function UploadQueueProvider() {
  useEffect(() => {
    /*
      The uploader is injected rather than imported by the queue, so the queue
      never learns what Bunny is and stays testable without a network. This is
      the one place the two meet.
    */
    /*
      The reporter is handed down from the platform drain rather than closed
      over here: a background wake-up decides at fire time whether anything is
      listening, and this effect ran once, at launch, possibly hours earlier.
    */
    setUploadDrain(async (onUploaded) => {
      await useUploadQueue.getState().drain(uploadQueued, onUploaded);
    });
    void registerUploadDrain();

    return () => {
      void unregisterUploadDrain();
    };
  }, []);

  return null;
}
