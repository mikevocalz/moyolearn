'use client';
// OcrReview — on-device OCR using react-native-executorch, then review/correct.
//
// The phase machine mirrors the web fork exactly (./ocr-review.tsx), because the
// two forks owe the learner the same contract: nothing editable appears until
// there is something to edit, an unreadable photo offers typing rather than a
// dead end, and an empty read still lands in the box the child can type into.
//
// WHY A PHASE AND NOT `ocr.isReady`: `isReady` means the MODELS are loaded, not
// that this photo has been read. Mounting `DigitizedTextReview` on `isReady`
// handed it `initialText=""`, and that component seeds its `useState` once — so
// the real text, which arrives from `forward()` a few seconds later, was
// rendered into a prop nobody read again. On device the reader worked and the
// box stayed permanently empty.
//
// WHY `forward` AND `isReady` RATHER THAN `ocr`: `useOCR` returns a fresh object
// literal every render, so an effect depending on `ocr` re-ran on every render
// and fired `forward()` again each time — against a controller that is already
// busy, with no catch to absorb the rejection. `forward` is `useCallback`d on
// the controller, so it is stable and the read happens once per photo.
// SOT: docs/pack/24-homework-capture-spec.md §5 · ./ocr-review.tsx
// SOT-KEYWORDS: ocr review native executorch useOCR age band phase

import { useEffect, useState } from 'react';
import { useOCR, OCR_ENGLISH, type OCRDetection } from 'react-native-executorch';
import { Button, Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { DigitizedTextReview } from './digitized-text-review';
import { buttonSizeForBand, type AgeBand } from './age-band';

export interface OcrReviewProps {
  ageBand?: AgeBand;
  source: string;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

interface Read {
  text: string;
  /** 0–100, matching `DigitizedTextReview`; undefined when nothing was found. */
  confidence: number | undefined;
}

type Phase = 'loading' | 'ready' | 'error' | 'manual';

function summarise(detections: OCRDetection[]): Read {
  if (detections.length === 0) return { text: '', confidence: undefined };

  const total = detections.reduce((sum, detection) => sum + detection.score, 0);
  return {
    text: detections.map((detection) => detection.text).join('\n'),
    confidence: Math.round((total / detections.length) * 100),
  };
}

export function OcrReview({ ageBand = 'teen', source, onConfirm, onCancel }: OcrReviewProps) {
  const { isReady, forward, error } = useOCR({ model: OCR_ENGLISH });
  const [phase, setPhase] = useState<Phase>('loading');
  const [read, setRead] = useState<Read | null>(null);

  useEffect(() => {
    if (!isReady || !source) return;
    let cancelled = false;

    void forward(source)
      .then((detections) => {
        if (cancelled) return;
        setRead(summarise(detections));
        setPhase('ready');
      })
      .catch(() => {
        if (!cancelled) setPhase('error');
      });

    return () => {
      cancelled = true;
    };
  }, [isReady, forward, source]);

  if (phase === 'loading') {
    // Two waits, one message: the models downloading on first run, and this
    // photo being read. A child does not care which one they are in.
    const copy = ageBand === 'young' ? 'Getting the word reader ready...' : 'Reading the text...';
    return (
      <View className="flex-1 items-center justify-center p-inset">
        <Text className="font-sans text-body text-text text-center">{copy}</Text>
      </View>
    );
  }

  if (phase === 'error' || error !== null) {
    const copy =
      ageBand === 'young'
        ? "I couldn't read the words. You can type them instead."
        : 'Could not read the text. You can type it instead.';
    return (
      <View className="flex-1 items-center justify-center gap-stack p-inset">
        <Text className="font-sans text-body text-text text-center">{copy}</Text>
        <Button
          title={ageBand === 'young' ? 'Type the words' : 'Type it instead'}
          variant="highlighter"
          size={buttonSizeForBand(ageBand)}
          fullWidth
          onPress={() => setPhase('manual')}
          aria-label="Type the problem yourself"
        />
      </View>
    );
  }

  if (phase === 'manual') {
    return (
      <DigitizedTextReview ageBand={ageBand} initialText="" onConfirm={onConfirm} onCancel={onCancel} />
    );
  }

  /*
    Straight to review even when the read came back empty. An empty box a child
    can type into beats an error telling them the picture failed — they know
    what the problem says; the app is the one that could not read it.
  */
  return (
    <DigitizedTextReview
      ageBand={ageBand}
      initialText={read?.text ?? ''}
      confidence={read?.confidence}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
