'use client';
// GuidedFrame — native live camera view with Skia edge overlay and capture trigger.
// SOT: docs/pack/24-homework-capture-spec.md §2
// SOT-KEYWORDS: guidedframe camera capture takephoto visioncamera native age band skia realtime hints

import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { Canvas, Rect } from '@shopify/react-native-skia';
import type { SkSize } from '@shopify/react-native-skia';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';
import type { CameraRef } from 'react-native-vision-camera';
import { Button, Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { buttonSizeForBand, type AgeBand } from './age-band';
import type { CapturePhoto } from './types';

export interface GuidedFrameProps {
  ageBand?: AgeBand;
  onCapture: (photo: CapturePhoto) => void;
  /** Web-fallback exits; the live viewfinder has the shared cancel chrome. */
  onPickPhoto?: () => void;
  onBack?: () => void;
}

export function GuidedFrame({
  ageBand = 'teen',
  onCapture,
  onBack,
  onPickPhoto,
}: GuidedFrameProps) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const photoOutput = usePhotoOutput();
  const cameraRef = useRef<CameraRef>(null);
  const canvasSize = useSharedValue<SkSize>({ width: 0, height: 0 });
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [busy, setBusy] = useState(false);
  const [captureError, setCaptureError] = useState(false);
  const capturing = useRef(false);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setActive(state === 'active'),
    );
    return () => subscription.remove();
  }, []);

  const guideX = useDerivedValue(() => canvasSize.value.width * 0.1);
  const guideY = useDerivedValue(() => canvasSize.value.height * 0.25);
  const guideW = useDerivedValue(() => canvasSize.value.width * 0.8);
  const guideH = useDerivedValue(() => canvasSize.value.height * 0.5);

  useEffect(() => {
    if (!hasPermission) {
      void requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const handleCapture = async () => {
    if (capturing.current) return;
    capturing.current = true;
    setBusy(true);
    setCaptureError(false);
    try {
      const photo = await photoOutput.capturePhotoToFile({}, {});
      /*
      A URI, NOT A BARE PATH. VisionCamera returns a filesystem path
      (`/data/user/0/.../VisionCamera_123.jpg`) and anything that treats its
      argument as a URI reads a leading `/` as a RELATIVE one — `SolitoImage`
      throws "add the nextJsURL prop to your SolitoProvider" on exactly that,
      which is what the in-session camera hit the first time it was opened.

      `CaptureScreen` never saw it only because `stripExif` normalises the path
      as a side effect of re-encoding. Normalising here instead means every
      consumer gets a usable value rather than the one that happened to run an
      image manipulator first. expo-image-manipulator accepts `file://`, so the
      EXIF strip is unaffected.
    */
      await onCapture({
        ...photo,
        filePath: photo.filePath.startsWith('file://')
          ? photo.filePath
          : `file://${photo.filePath}`,
      });
    } catch {
      setCaptureError(true);
    } finally {
      capturing.current = false;
      setBusy(false);
    }
  };

  const buttonSize = buttonSizeForBand(ageBand);
  /*
    "Snap" for every band, not just the youngest. The flow is called Snap
    everywhere else a child meets it — the tutor's empty state offers "Snap your
    homework" and capture-tip titles itself "How Snap works" for all bands — so
    a button reading "Capture" was the one place the name changed, and an action
    that renames itself mid-flow is an action a child has to learn twice.
  */
  const captureLabel = 'Snap';
  const defaultHint =
    ageBand === 'young'
      ? 'Put the page inside the box!'
      : ageBand === 'child'
        ? 'Keep the page inside the guide.'
        : 'Line up the page inside the frame.';
  const hintText = captureError
    ? 'Could not take the photo. Please try again.'
    : defaultHint;

  if (!hasPermission) {
    const copy =
      ageBand === 'young'
        ? 'We need the camera to take a picture of your work.'
        : 'Camera permission is needed to scan your work.';
    return (
      <View className="flex-1 items-center justify-center p-inset">
        <Text className="font-sans text-body text-text text-center">
          {copy}
        </Text>
        {onPickPhoto ? (
          <Button
            title="Choose photo"
            variant="outline"
            size={buttonSize}
            onPress={onPickPhoto}
          />
        ) : null}
        {onBack ? (
          <Button
            title="Cancel"
            variant="ghost"
            size={buttonSize}
            onPress={onBack}
          />
        ) : null}
      </View>
    );
  }

  if (device == null) {
    return (
      <View className="flex-1 items-center justify-center p-inset">
        <Text className="font-sans text-body text-text text-center">
          No back camera found.
        </Text>
        {onPickPhoto ? (
          <Button
            title="Choose photo"
            variant="outline"
            size={buttonSize}
            onPress={onPickPhoto}
          />
        ) : null}
        {onBack ? (
          <Button
            title="Cancel"
            variant="ghost"
            size={buttonSize}
            onPress={onBack}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View className="flex-1">
      <Camera
        ref={cameraRef}
        device={device}
        isActive={active}
        outputs={[photoOutput]}
        style={StyleSheet.absoluteFill}
      />
      <View className="absolute inset-0 pointer-events-none">
        <Canvas style={StyleSheet.absoluteFill} onSize={canvasSize}>
          <Rect
            x={guideX}
            y={guideY}
            width={guideW}
            height={guideH}
            color="rgba(255,255,255,0.8)"
            style="stroke"
            strokeWidth={3}
          />
        </Canvas>
        <Text className="absolute top-20 w-full p-inset text-center font-sans text-label font-semibold text-text-inverse">
          {hintText}
        </Text>
      </View>
      <View className="absolute bottom-0 left-0 right-0 p-inset gap-element">
        {onPickPhoto ? (
          <Button
            title="Choose photo"
            variant="outline"
            size={buttonSize}
            onPress={onPickPhoto}
            disabled={busy}
          />
        ) : null}
        <Button
          title={busy ? 'Taking photo…' : captureLabel}
          disabled={busy || !active}
          variant="highlighter"
          size={buttonSize}
          fullWidth
          onPress={handleCapture}
          aria-label="Take picture of your work"
        />
        {onBack ? (
          <Button
            title="Cancel"
            variant="ghost"
            size={buttonSize}
            onPress={onBack}
            disabled={busy}
          />
        ) : null}
      </View>
    </View>
  );
}
