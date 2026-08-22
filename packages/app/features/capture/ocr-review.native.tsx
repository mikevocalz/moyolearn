'use client';
// OcrReview — on-device OCR using react-native-executorch, then review/correct.
// SOT: docs/pack/24-homework-capture-spec.md §5
// SOT-KEYWORDS: ocr review native executorch useOCR

import { useEffect, useState } from 'react';
import { useOCR, OCR_ENGLISH } from 'react-native-executorch';
import { Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { DigitizedTextReview } from './digitized-text-review';

export interface OcrReviewProps {
  source: string;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

export function OcrReview({ source, onConfirm, onCancel }: OcrReviewProps) {
  const ocr = useOCR({ model: OCR_ENGLISH });
  const [text, setText] = useState('');

  useEffect(() => {
    if (ocr.isReady && source) {
      void ocr.forward(source).then((detections) => {
        setText(detections.map((detection) => detection.text).join('\n'));
      });
    }
  }, [ocr.isReady, source, ocr]);

  if (!ocr.isReady) {
    return (
      <View className="flex-1 items-center justify-center p-inset">
        <Text className="font-sans text-body text-text">Loading text reader...</Text>
      </View>
    );
  }

  if (ocr.error) {
    return (
      <View className="flex-1 items-center justify-center p-inset">
        <Text className="font-sans text-body text-text">Could not read text: {ocr.error.message}</Text>
      </View>
    );
  }

  return <DigitizedTextReview initialText={text} onConfirm={onConfirm} onCancel={onCancel} />;
}
