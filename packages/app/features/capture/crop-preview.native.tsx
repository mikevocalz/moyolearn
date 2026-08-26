'use client';
// CropPreview — native crop-after confirmation, fixed to the guide rectangle used in GuidedFrame.
// SOT: docs/pack/24-homework-capture-spec.md §1
// SOT-KEYWORDS: crop preview native homework image manipulator review age band

import { useEffect, useState } from 'react';
import { Image as RNImage } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { Button, Image, Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { buttonSizeForBand, type AgeBand } from './age-band';

export interface CropPreviewProps {
  ageBand?: AgeBand;
  source: string;
  onCrop: (uri: string) => void;
  onCancel: () => void;
}

const CROP_X = 0.1;
const CROP_Y = 0.25;
const CROP_W = 0.8;
const CROP_H = 0.5;

export function CropPreview({ ageBand = 'teen', source, onCrop, onCancel }: CropPreviewProps) {
  const [busy, setBusy] = useState(false);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const buttonSize = buttonSizeForBand(ageBand);

  useEffect(() => {
    RNImage.getSize(source, (width, height) => setSize({ width, height }));
  }, [source]);

  const handleCrop = async () => {
    if (!size) return;
    setBusy(true);
    const originX = Math.round(size.width * CROP_X);
    const originY = Math.round(size.height * CROP_Y);
    const width = Math.round(size.width * CROP_W);
    const height = Math.round(size.height * CROP_H);
    const result = await ImageManipulator.manipulateAsync(
      source,
      [{ crop: { originX, originY, width, height } }],
      { format: ImageManipulator.SaveFormat.JPEG, compress: 0.95 },
    );
    setBusy(false);
    onCrop(result.uri);
  };

  return (
    <View className="flex-1 gap-stack p-inset">
      <Image alt="Captured work" src={source} className="h-64 w-full rounded-card" />
      <Text className="font-sans text-body text-text text-center">
        {ageBand === 'young'
          ? 'We will zoom in on the middle. Tap when it looks good!'
          : 'Cropping to the problem in the center.'}
      </Text>
      <Button
        title={busy ? 'Cropping...' : 'Use this crop'}
        variant="highlighter"
        size={buttonSize}
        fullWidth
        onPress={handleCrop}
        disabled={busy}
        aria-label="Use the cropped area"
      />
      <Button title="Retake" variant="outline" size={buttonSize} fullWidth onPress={onCancel} aria-label="Take the picture again" />
    </View>
  );
}
