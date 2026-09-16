'use client';
// One review lifecycle for both recognition backends. Source changes invalidate reads.
// SOT: docs/design/homework-intelligence.md
// SOT-KEYWORDS: ocr review cancellation manual source lifecycle shared
// Mobbin: https://mobbin.com/flows/22a448fc-fb46-47d5-b1d9-b0c39d233a0d (page-first preview) · https://mobbin.com/flows/208579eb-8a5a-4c99-93a1-f81beadc76e8 (source with editable text) · https://mobbin.com/flows/575c875e-96ed-4b25-8927-c92bb2d22d64 (retain source during recognition)
import { useEffect, useRef } from 'react';
import { Button, Image, Text, useInstanceStore, useStore } from '@acme/ui';
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
  requiresSourceCheck?: boolean;
  reason?: DocumentReading['reason'];
  pages?: DocumentReading['pages'];
}
type Props = OcrReviewProps & {
  read: (source: string, mimeType?: string, signal?: AbortSignal) => Promise<Reading>;
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
  const store = useInstanceStore<{ state: State }>(() => ({ state: { kind: 'loading' } }));
  const state = useStore(store, (value) => value.state);
  const setState = (state: State) => store.setState({ state });
  const activeRead = useRef<AbortController | null>(null);
  const cancelRead = () => {
    activeRead.current?.abort();
  };
  const cancel = () => { cancelRead(); onCancel(); };
  const size = buttonSizeForBand(ageBand);
  useEffect(() => {
    const controller = new AbortController();
    activeRead.current = controller;
    void read(source, mimeType, controller.signal)
      .then((reading) => {
        if (!controller.signal.aborted)
          store.setState({ state:
            reading.text.trim()
              ? { kind: 'ready', reading }
              : { kind: 'failed', reason: reading.reason },
          });
      })
      .catch(() => {
        if (!controller.signal.aborted) store.setState({ state: { kind: 'failed' } });
      });
    return () => {
      controller.abort();
    };
  }, [source, mimeType, read, store]);

  if (state.kind === 'ready' && state.reading.pages?.length) {
    return (
      <PdfPagesReview
        pages={state.reading.pages}
        ageBand={ageBand}
        onConfirm={onConfirm}
        onCancel={cancel}
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
          state.kind === 'ready' && (state.reading.requiresSourceCheck === true || state.reading.confidence !== undefined)
        }
        onConfirm={onConfirm}
        onCancel={cancel}
      >
        {!mimeType || mimeType.startsWith('image/') ? (
          <Image src={source} alt="Original homework photo" contentFit="contain" className="h-64 w-full rounded-card" />
        ) : null}
      </DigitizedTextReview>
    );
  }
  return (
    <View className="flex-1 items-center justify-center gap-stack p-inset">
      {!mimeType || mimeType.startsWith('image/') ? (
        <Image src={source} alt="Original homework photo" contentFit="contain" className="h-64 w-full rounded-card" />
      ) : null}
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
          cancelRead();
          setState({ kind: 'manual' });
        }}
      />
      <Button
        title="Back to pages"
        variant="outline"
        size={size}
        fullWidth
        onPress={cancel}
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
  const store = useInstanceStore<{ index: number; confirmed: Record<number, string>; expanded: boolean }>(() => ({ index: 0, confirmed: {}, expanded: false }));
  const { index, confirmed, expanded } = useStore(store);
  const page = pages[index];
  if (!page) return null;
  const confirmPage = (text: string) => {
    const next = { ...confirmed, [page.index]: text };
    store.setState({ confirmed: next });
    if (index + 1 < pages.length) {
      store.setState({ index: index + 1, expanded: false });
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
          onPress={() => store.setState({ expanded: !expanded })}
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
