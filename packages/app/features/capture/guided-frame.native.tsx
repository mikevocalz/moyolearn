'use client';
// GuidedFrame — native live camera view with Skia edge overlay and capture trigger.
// SOT: docs/pack/24-homework-capture-spec.md §2
// SOT-KEYWORDS: guidedframe camera capture takephoto visioncamera native age band skia

import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { Canvas, Rect } from '@shopify/react-native-skia';
import type { SkSize } from '@shopify/react-native-skia';
import { Camera, useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';
import type { CameraRef } from 'react-native-vision-camera';
import { Button, Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { buttonSizeForBand, type AgeBand } from './age-band';
import type { CapturePhoto } from './types';

export interface GuidedFrameProps {
  ageBand?: AgeBand;
  onCapture: (photo: CapturePhoto) => void;
}

export function GuidedFrame({ ageBand = 'teen', onCapture }: GuidedFrameProps) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const photoOutput = usePhotoOutput();
  const cameraRef = useRef<CameraRef>(null);
  const canvasSize = useSharedValue<SkSize>({ width: 0, height: 0 });

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
    const photo = await photoOutput.capturePhotoToFile({}, {});
    onCapture(photo);
  };

  const buttonSize = buttonSizeForBand(ageBand);
  const captureLabel = ageBand === 'young' ? 'Snap' : 'Capture';
  const hint =
    ageBand === 'young'
      ? 'Put the page inside the box!'
      : ageBand === 'child'
        ? 'Keep the page inside the guide.'
        : 'Line up the page inside the frame.';

  if (!hasPermission) {
    const copy =
      ageBand === 'young'
        ? 'We need the camera to take a picture of your work.'
        : 'Camera permission is needed to scan your work.';
    return (
      <View className="flex-1 items-center justify-center p-inset">
        <Text className="font-sans text-body text-text text-center">{copy}</Text>
      </View>
    );
  }

  if (device == null) {
    return (
      <View className="flex-1 items-center justify-center p-inset">
        <Text className="font-sans text-body text-text text-center">No back camera found.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <Camera
        ref={cameraRef}
        device={device}
        isActive
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
          {hint}
        </Text>
      </View>
      <View className="absolute bottom-0 left-0 right-0 p-inset">
        <Button
          title={captureLabel}
          variant="highlighter"
          size={buttonSize}
          fullWidth
          onPress={handleCapture}
          aria-label="Take picture of your work"
        />
      </View>
    </View>
  );
}
