'use client';
// One review lifecycle for both recognition backends. Source changes invalidate reads.
// SOT: docs/design/homework-intelligence.md
// SOT-KEYWORDS: ocr review cancellation manual source lifecycle shared
import { useEffect, useRef, useState } from 'react';
import { Button, Image, Text } from '@acme/ui';
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
  pages?: DocumentReading['pages'];
}
type Props = OcrReviewProps & {
  read: (source: string, mimeType?: string) => Promise<Reading>;
};
type State =
  | { kind: 'loading' }
  | { kind: 'manual' }
  | { kind: 'failed'; reason?: DocumentReading['reason'] }
  | { kind: 'ready'; reading: Reading };

export function OcrReviewBase(props: Props) {
  return (
    <ReviewSource key={`${props.source}:${props.mimeType ?? ''}`} {...props} />
  );
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

  if (state.kind === 'ready' && state.reading.pages?.length) {
    return (
      <PdfPagesReview
        pages={state.reading.pages}
        ageBand={ageBand}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
  }
  if (state.kind === 'ready' || state.kind === 'manual') {
    return (
      <DigitizedTextReview
        ageBand={ageBand}
        initialText={state.kind === 'ready' ? state.reading.text : ''}
        confidence={
          state.kind === 'ready' ? state.reading.confidence : undefined
        }
        requiresSourceCheck={
          state.kind === 'ready' && state.reading.confidence !== undefined
        }
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

function PdfPagesReview({
  pages,
  ageBand,
  onConfirm,
  onCancel,
}: {
  pages: NonNullable<DocumentReading['pages']>;
  ageBand: AgeBand;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [confirmed, setConfirmed] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState(false);
  const page = pages[index];
  if (!page) return null;
  const confirmPage = (text: string) => {
    const next = { ...confirmed, [page.index]: text };
    setConfirmed(next);
    if (index + 1 < pages.length) {
      setIndex(index + 1);
      setExpanded(false);
    } else
      onConfirm(
        pages.map((p) => `Page ${p.index}:\n${next[p.index]}`).join('\n\n'),
      );
  };
  return (
    <DigitizedTextReview
      key={page.index}
      ageBand={ageBand}
      initialText={page.text}
      confidence={page.confidence}
      requiresSourceCheck={page.requiresSourceCheck || page.status !== 'text'}
      onCancel={onCancel}
      onConfirm={confirmPage}
    >
      <Text className="font-sans text-label text-text">
        PDF page {page.index} of {pages.length}
      </Text>
      {page.preview ? (
        <Image
          src={page.preview}
          alt={`Original PDF page ${page.index}`}
          contentFit="contain"
          className={
            expanded
              ? 'h-screen w-full rounded-card'
              : 'h-64 w-full rounded-card'
          }
        />
      ) : (
        <Text className="font-sans text-body text-text">
          The page preview is unavailable. Check your original file before
          confirming.
        </Text>
      )}
      {page.preview ? (
        <Button
          title={expanded ? 'Reduce page preview' : 'Enlarge page preview'}
          variant="outline"
          size={buttonSizeForBand(ageBand)}
          fullWidth
          onPress={() => setExpanded(!expanded)}
        />
      ) : null}
      {page.status !== 'text' && page.status !== 'ocr' ? (
        <Text className="font-sans text-body text-text">
          {page.status === 'needs-ocr'
            ? 'We could not read all of this page. Add any missing words or math from the original. Only mark it empty if it has no work.'
            : 'This page could not be read. Check the original before typing its words.'}
        </Text>
      ) : null}
      {!page.text.trim() && page.preview ? (
        <Button
          title="This page has no work"
          variant="outline"
          size={buttonSizeForBand(ageBand)}
          fullWidth
          onPress={() =>
            confirmPage('[Learner confirmed this page has no work]')
          }
        />
      ) : null}
    </DigitizedTextReview>
  );
}
