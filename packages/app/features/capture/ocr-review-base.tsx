'use client';
// One review lifecycle for both recognition backends. Source changes invalidate reads.
// SOT: docs/design/homework-intelligence.md
// SOT-KEYWORDS: ocr review cancellation manual source lifecycle shared
import { useEffect, useRef, useState } from 'react';
import { Button, Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { DigitizedTextReview } from './digitized-text-review';
import { buttonSizeForBand, type AgeBand } from './age-band';
import type { DocumentReading } from './read-document';

export interface OcrReviewProps {
  ageBand?: AgeBand;
  source: string;
  mimeType?: string;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}
export interface Reading {
  text: string;
  confidence?: number;
  reason?: DocumentReading['reason'];
}
type Props = OcrReviewProps & { read: (source: string, mimeType?: string) => Promise<Reading> };
type State =
  | { kind: 'loading' }
  | { kind: 'manual' }
  | { kind: 'failed'; reason?: DocumentReading['reason'] }
  | { kind: 'ready'; reading: Reading };

export function OcrReviewBase(props: Props) {
  return <ReviewSource key={`${props.source}:${props.mimeType ?? ''}`} {...props} />;
}
function ReviewSource({
  source,
  mimeType,
  ageBand = 'teen',
  read,
  onConfirm,
  onCancel,
}: Props) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const generation = useRef(0);
  const size = buttonSizeForBand(ageBand);
  useEffect(() => {
    const request = ++generation.current;
    void read(source, mimeType)
      .then((reading) => {
        if (request === generation.current)
          setState(
            reading.text.trim()
              ? { kind: 'ready', reading }
              : { kind: 'failed', reason: reading.reason },
          );
      })
      .catch(() => {
        if (request === generation.current) setState({ kind: 'failed' });
      });
    return () => {
      generation.current++;
    };
  }, [source, mimeType, read]);

  if (state.kind === 'ready' || state.kind === 'manual') {
    return (
      <DigitizedTextReview
        ageBand={ageBand}
        initialText={state.kind === 'ready' ? state.reading.text : ''}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
  }
  return (
    <View className="flex-1 items-center justify-center gap-stack p-inset">
      <Text className="font-sans text-body text-text text-center">
        {state.kind === 'loading'
          ? 'Reading your page…'
          : state.reason === 'scanned'
            ? 'This PDF needs its pages read as images. You can type the words or go back.'
            : state.reason === 'unsupported'
              ? 'We cannot read this file format yet. You can type the words or choose another file.'
              : state.reason === 'empty'
                ? 'We found no text in this file. You can type the words or go back.'
                : 'We could not read this source. You can type the words or go back.'}
      </Text>
      <Button
        title="Type the words"
        variant="highlighter"
        size={size}
        fullWidth
        onPress={() => {
          generation.current++;
          setState({ kind: 'manual' });
        }}
      />
      <Button
        title="Back to pages"
        variant="outline"
        size={size}
        fullWidth
        onPress={onCancel}
      />
    </View>
  );
}
