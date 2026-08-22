'use client';
// GuidedFrame — native live camera view with a capture trigger.
// SOT: docs/pack/24-homework-capture-spec.md §2
// SOT-KEYWORDS: guidedframe camera capture takephoto visioncamera native age band

import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
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

  useEffect(() => {
    if (!hasPermission) {
      void requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const handleCapture = async () => {
    const photo = await photoOutput.capturePhotoToFile({}, {});
    onCapture(photo);
  };

  const size = buttonSizeForBand(ageBand);
  const captureLabel = ageBand === 'young' ? 'Snap' : ageBand === 'child' ? 'Capture' : 'Capture';

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
      <View className="absolute bottom-0 left-0 right-0 p-inset">
        <Button title={captureLabel} variant="highlighter" size={size} fullWidth onPress={handleCapture} aria-label="Take picture of your work" />
      </View>
    </View>
  );
}
