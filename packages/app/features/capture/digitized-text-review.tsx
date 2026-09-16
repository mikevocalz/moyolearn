'use client';
// DigitizedTextReview — let the learner fix what OCR read before it feeds Natalie.
// SOT: docs/pack/24-homework-capture-spec.md §4 · §5
// SOT-KEYWORDS: digitized-text review ocr correction confirm age band

import { type ReactNode } from 'react';
import {
  Button,
  ErrorMessage,
  KeyboardAwareScroll,
  Text,
  Textarea,
  useInstanceStore,
  useStore,
} from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { buttonSizeForBand, type AgeBand } from './age-band';

export interface DigitizedTextReviewProps {
  ageBand?: AgeBand;
  initialText: string;
  /** Original page and review context scroll together with the editable text. */
  children?: ReactNode;
  /** Confidence from the OCR engine, 0–100; undefined means unknown. */
  confidence?: number;
  /** OCR candidates require an explicit comparison with the source, even after edits. */
  requiresSourceCheck?: boolean;
  /** Confirm is blocked while the text still matches a low-confidence read. */
  lowConfidenceThreshold?: number;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

export function DigitizedTextReview({
  ageBand = 'teen',
  initialText,
  children,
  confidence,
  requiresSourceCheck = false,
  lowConfidenceThreshold = 40,
  onConfirm,
  onCancel,
}: DigitizedTextReviewProps) {
  const store = useInstanceStore(() => ({ text: initialText, sourceChecked: false }));
  const { text, sourceChecked } = useStore(store);
  const size = buttonSizeForBand(ageBand);
  const label = ageBand === 'young' ? 'Fix the words' : 'Review what was read';
  const confirmLabel = ageBand === 'young' ? 'Looks good' : 'Looks good';
  const retryLabel = ageBand === 'young' ? 'Try again' : 'Try again';
  const isLowConfidence =
    confidence !== undefined && confidence < lowConfidenceThreshold;
  const isPristine = text === initialText;
  const confirmDisabled =
    text.trim().length === 0 ||
    (requiresSourceCheck ? !sourceChecked : isLowConfidence && isPristine);
  const warningCopy =
    ageBand === 'young'
      ? "I'm not sure I read this right. Please fix it before sending."
      : 'The reader is not confident. Please check and correct before sending.';

  return (
    <KeyboardAwareScroll className="flex-1" keyboardShouldPersistTaps="handled">
      <View className="gap-stack p-inset">
        {children}
        {requiresSourceCheck ? (
          <Text className="font-sans text-body text-text">
            Check every question against the original. The reader can miss
            handwriting, fraction bars, signs, or numbers. Fix missing work and
            write fractions as (top)/(bottom). Keep the original answers, even
            if they are wrong.
          </Text>
        ) : null}
        {isLowConfidence ? (
          <ErrorMessage message={warningCopy} className="text-body" />
        ) : null}
        <Textarea
          label={label}
          autoCorrect={false}
          autoCapitalize="none"
          value={text}
          onChangeText={(value) => {
            store.setState({ text: value, sourceChecked: false });
          }}
        />
        {requiresSourceCheck ? (
          <Button
            title={
              sourceChecked
                ? 'Source checked'
                : 'I checked every question against the original'
            }
            variant="outline"
            size={size}
            fullWidth
            disabled={!text.trim() || sourceChecked}
            onPress={() => store.setState({ sourceChecked: true })}
          />
        ) : null}
        <Button
          title={
            confirmDisabled
              ? ageBand === 'young'
                ? 'Fix the words first'
                : 'Correct before sending'
              : confirmLabel
          }
          variant="highlighter"
          size={size}
          fullWidth
          onPress={() => {
            if (!confirmDisabled) onConfirm(text);
          }}
          disabled={confirmDisabled}
          aria-label="Use this text"
        />
        <Button
          title={retryLabel}
          variant="outline"
          size={size}
          fullWidth
          onPress={onCancel}
          aria-label="Start over"
        />
      </View>
    </KeyboardAwareScroll>
  );
}
