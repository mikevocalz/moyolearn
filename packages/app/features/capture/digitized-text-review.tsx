'use client';
// DigitizedTextReview — let the learner fix what OCR read before it feeds Natalie.
// SOT: docs/pack/24-homework-capture-spec.md §4 · §5
// SOT-KEYWORDS: digitized-text review ocr correction confirm

import { useState } from 'react';
import { Button, Textarea } from '@acme/ui';
import { View } from '@acme/ui/primitives';

export interface DigitizedTextReviewProps {
  initialText: string;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

export function DigitizedTextReview({ initialText, onConfirm, onCancel }: DigitizedTextReviewProps) {
  const [text, setText] = useState(initialText);

  return (
    <View className="flex-1 gap-stack p-inset">
      <Textarea
        label="Review what was read"
        value={text}
        onChangeText={setText}
        containerClassName="flex-1"
      />
      <Button title="Looks good" variant="highlighter" fullWidth onPress={() => onConfirm(text)} />
      <Button title="Try again" variant="outline" fullWidth onPress={onCancel} />
    </View>
  );
}
