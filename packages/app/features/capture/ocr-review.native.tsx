'use client';
// OcrReview — on-device OCR using react-native-executorch, then review/correct.
// SOT: docs/pack/24-homework-capture-spec.md §5
// SOT-KEYWORDS: ocr review native executorch useOCR age band

import { useEffect, useState } from 'react';
import { useOCR, OCR_ENGLISH } from 'react-native-executorch';
import { Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { DigitizedTextReview } from './digitized-text-review';
import { type AgeBand } from './age-band';

export interface OcrReviewProps {
  ageBand?: AgeBand;
  source: string;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

export function OcrReview({ ageBand = 'teen', source, onConfirm, onCancel }: OcrReviewProps) {
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
    const copy = ageBand === 'young' ? 'Getting the word reader ready...' : 'Loading text reader...';
    return (
      <View className="flex-1 items-center justify-center p-inset">
        <Text className="font-sans text-body text-text text-center">{copy}</Text>
      </View>
    );
  }

  if (ocr.error) {
    const copy =
      ageBand === 'young'
        ? "I couldn't read the words. Try again or use your voice."
        : `Could not read text: ${ocr.error.message}`;
    return (
      <View className="flex-1 items-center justify-center p-inset gap-stack">
        <Text className="font-sans text-body text-text text-center">{copy}</Text>
      </View>
    );
  }

  return <DigitizedTextReview ageBand={ageBand} initialText={text} onConfirm={onConfirm} onCancel={onCancel} />;
}
