'use client';
// DigitizedTextReview — let the learner fix what OCR read before it feeds Natalie.
// SOT: docs/pack/24-homework-capture-spec.md §4 · §5
// SOT-KEYWORDS: digitized-text review ocr correction confirm age band

import { useState } from 'react';
import { Button, Textarea } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { buttonSizeForBand, type AgeBand } from './age-band';

export interface DigitizedTextReviewProps {
  ageBand?: AgeBand;
  initialText: string;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

export function DigitizedTextReview({ ageBand = 'teen', initialText, onConfirm, onCancel }: DigitizedTextReviewProps) {
  const [text, setText] = useState(initialText);
  const size = buttonSizeForBand(ageBand);
  const label = ageBand === 'young' ? 'Fix the words' : 'Review what was read';
  const confirmLabel = ageBand === 'young' ? 'Looks good' : 'Looks good';
  const retryLabel = ageBand === 'young' ? 'Try again' : 'Try again';

  return (
    <View className="flex-1 gap-stack p-inset">
      <Textarea
        label={label}
        value={text}
        onChangeText={setText}
        containerClassName="flex-1"
      />
      <Button title={confirmLabel} variant="highlighter" size={size} fullWidth onPress={() => onConfirm(text)} aria-label="Use this text" />
      <Button title={retryLabel} variant="outline" size={size} fullWidth onPress={onCancel} aria-label="Start over" />
    </View>
  );
}
