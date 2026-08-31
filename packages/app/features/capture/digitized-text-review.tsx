'use client';
// DigitizedTextReview — let the learner fix what OCR read before it feeds Natalie.
// SOT: docs/pack/24-homework-capture-spec.md §4 · §5
// SOT-KEYWORDS: digitized-text review ocr correction confirm age band

import { useState } from 'react';
import { Button, ErrorMessage, Textarea } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { buttonSizeForBand, type AgeBand } from './age-band';

export interface DigitizedTextReviewProps {
  ageBand?: AgeBand;
  initialText: string;
  /** Confidence from the OCR engine, 0–100; undefined means unknown. */
  confidence?: number;
  /** Confirm is blocked while the text still matches a low-confidence read. */
  lowConfidenceThreshold?: number;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

export function DigitizedTextReview({
  ageBand = 'teen',
  initialText,
  confidence,
  lowConfidenceThreshold = 40,
  onConfirm,
  onCancel,
}: DigitizedTextReviewProps) {
  const [text, setText] = useState(initialText);
  const size = buttonSizeForBand(ageBand);
  const label = ageBand === 'young' ? 'Fix the words' : 'Review what was read';
  const confirmLabel = ageBand === 'young' ? 'Looks good' : 'Looks good';
  const retryLabel = ageBand === 'young' ? 'Try again' : 'Try again';
  const isLowConfidence = confidence !== undefined && confidence < lowConfidenceThreshold;
  const isPristine = text === initialText;
  const confirmDisabled = isLowConfidence && isPristine;
  const warningCopy =
    ageBand === 'young'
      ? "I'm not sure I read this right. Please fix it before sending."
      : 'The reader is not confident. Please check and correct before sending.';

  return (
    <View className="flex-1 gap-stack p-inset">
      {isLowConfidence ? (
        <ErrorMessage message={warningCopy} className="text-body" />
      ) : null}
      <Textarea
        label={label}
        value={text}
        onChangeText={setText}
        containerClassName="flex-1"
      />
      <Button
        title={confirmDisabled ? (ageBand === 'young' ? 'Fix the words first' : 'Correct before sending') : confirmLabel}
        variant="highlighter"
        size={size}
        fullWidth
        onPress={() => onConfirm(text)}
        disabled={confirmDisabled}
        aria-label="Use this text"
      />
      <Button title={retryLabel} variant="outline" size={size} fullWidth onPress={onCancel} aria-label="Start over" />
    </View>
  );
}
