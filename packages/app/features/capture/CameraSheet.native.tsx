'use client';
// The homework camera, presented in-session.
//
// THE SAME TWO COMPONENTS THE SCANNER USES — `GuidedFrame` then `CropPreview`,
// doc 24 §2 — and that is the whole point of this file. The tutor composer used
// `expo-image-picker`'s `launchCameraAsync`, i.e. the OS camera app: no edge
// overlay, no "closer / steady / light / glare" hints, no age-band shutter, no
// crop. A child photographing a worksheet that way hands the OCR exactly the
// picture it reads worst, so the second camera was not merely a duplicate of the
// first (CLAUDE.md, "never invent a second way") — it was the worse one, on the
// surface where reading the page matters most.
//
// A SHEET RATHER THAN THE ROUTE. `CaptureScreen` ends by navigating, and
// leaving a live session would tear down the WebGPU stage and re-parse a 14 MB
// body every time a child photographs a question. Mounted at the app ROOT for
// the reason `AudioRecorderSheet` is: the composer can sit inside a bottom
// sheet, and a Modal mounted in there stops the sheet mounting at all.
// SOT: ./guided-frame.native.tsx · ./crop-preview.native.tsx · ./camera.store.ts
// SOT-KEYWORDS: camera sheet guided frame crop preview tutor session homework capture
import { useCallback, useState } from 'react';
import { Image, Modal } from 'react-native';
import { View } from '@acme/ui/primitives';
import { GuidedFrame } from './guided-frame';
import { CropPreview } from './crop-preview';
import { useCameraStore } from './camera.store.ts';
import type { AgeBand } from './age-band';

/**
 * `CameraImage` carries dimensions so the tray can lay the thumbnail out
 * without a second native measuring pass — `Image.getSize` is that pass, and a
 * failure there costs the dimensions, not the photo.
 */
async function measure(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve({ width: 0, height: 0 }),
    );
  });
}

export function CameraSheet({ ageBand = 'teen' }: { ageBand?: AgeBand }) {
  const open = useCameraStore((state) => state.open);
  const resolve = useCameraStore((state) => state.resolve);
  // The shot waiting to be cropped. Cleared on every exit, or the next open
  // starts on the last photo's crop screen.
  const [shot, setShot] = useState<string | null>(null);

  const close = useCallback(
    (uri: string | null) => {
      setShot(null);
      if (uri === null) {
        resolve(null);
        return;
      }
      void measure(uri).then(({ width, height }) => resolve({ uri, width, height }));
    },
    [resolve],
  );

  return (
    <Modal
      visible={open}
      animationType="slide"
      // Full-screen, not a card: a viewfinder the child has to frame a page in
      // needs the screen, and the guide rectangle is authored against it.
      presentationStyle="fullScreen"
      onRequestClose={() => close(null)}
    >
      <View className="flex-1 bg-ink-950">
        {shot === null ? (
          <GuidedFrame
            ageBand={ageBand}
            onCapture={(photo) => setShot(photo.filePath)}
            onBack={() => close(null)}
          />
        ) : (
          <CropPreview
            ageBand={ageBand}
            source={shot}
            onCrop={close}
            // Back to the viewfinder, not out of the camera: a bad frame is a
            // retake, and making it an exit means re-opening the sheet.
            onCancel={() => setShot(null)}
          />
        )}
      </View>
    </Modal>
  );
}
