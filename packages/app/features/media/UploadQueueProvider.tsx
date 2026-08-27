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
import { useEffect, useRef } from 'react';
import { registerUploadDrain, setUploadDrain, unregisterUploadDrain, reportUpload } from './upload-queue';
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

  /*
    DRAIN WHEN SOMETHING IS QUEUED, not only when the page loads.

    The platform drains fire on launch and on `online` — the offline-first rule
    read literally — and nothing fired when an item was actually added. So a
    photo sent mid-session sat in the queue until the next reload: on web, where
    there is no background task to wake up, that meant the bytes were never
    uploaded during the session at all, and the turn's attachment kept no url.
    Caught by reading a real voice note back off the server and finding the
    transcript there and the media not.

    Guarded against re-entry rather than debounced. A drain mutates the queue it
    is draining, so this effect re-runs while it is still going; the flag makes
    the second call a no-op instead of uploading the same bytes twice. A pass
    that started before the newest item still leaves it queued, and the length
    change after that pass schedules another.
  */
  const queued = useUploadQueue((s) => s.queue.length);
  const draining = useRef(false);
  useEffect(() => {
    if (queued === 0 || draining.current) return;
    draining.current = true;
    void useUploadQueue
      .getState()
      .drain(uploadQueued, reportUpload)
      .finally(() => {
        draining.current = false;
      });
  }, [queued]);

  return null;
}
