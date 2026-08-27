'use client';
// OcrReview — on-device OCR in the BROWSER, via tesseract.js.
//
// This used to say "Text scanning is only available in the app." That was a
// packaging fact dressed up as a product decision: ExecuTorch has no web build,
// so the web fork gave up. But a child on a school Chromebook has the same
// homework as a child on a phone, and telling them to find a different device
// is not a fallback, it is a wall.
//
// tesseract.js is the Tesseract engine compiled to WebAssembly. It runs
// entirely on the device — no API, no key, no per-image cost, which is the same
// constraint that put ExecuTorch on native.
//
// KNOWN LIMIT, stated because it decides how the result is used: Tesseract is a
// PRINTED-text engine. Worksheets, textbooks and typed problem sets read well;
// a child's own handwriting reads poorly. That is exactly why the result lands
// in `DigitizedTextReview` rather than going straight to the tutor — the child
// confirms or corrects what was read, and a bad read costs an edit rather than
// a wrong lesson. If handwriting becomes the common case, the upgrade is a
// TrOCR handwriting model through transformers.js with WebGPU, not a bigger
// Tesseract.
// SOT: docs/pack/24-homework-capture-spec.md §5 · ./ocr-review.native.tsx
// SOT-KEYWORDS: ocr review web tesseract wasm on-device capture age band
import { useEffect, useState } from 'react';
import { Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { DigitizedTextReview } from './digitized-text-review';
import type { AgeBand } from './age-band';

export interface OcrReviewProps {
  ageBand?: AgeBand;
  source: string;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

type Phase = 'loading' | 'ready' | 'error';

export function OcrReview({ ageBand = 'teen', source, onConfirm, onCancel }: OcrReviewProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [text, setText] = useState('');

  useEffect(() => {
    if (!source) return;
    let cancelled = false;

    void (async () => {
      try {
        /*
          Imported inside the effect, not at module scope. The worker pulls a
          ~30MB WASM core and a language file on first use, and a static import
          would put that in the route's bundle for every learner — including the
          ones who never photograph anything.
        */
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('eng');
        try {
          const result = await worker.recognize(source);
          if (!cancelled) {
            setText(result.data.text.trim());
            setPhase('ready');
          }
        } finally {
          // Always, even if recognition threw: a live worker holds the WASM
          // heap and its own thread, and a child photographing four problems
          // would otherwise leave four behind.
          await worker.terminate();
        }
      } catch {
        if (!cancelled) setPhase('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source]);

  if (phase === 'loading') {
    const copy = ageBand === 'young' ? 'Getting the word reader ready...' : 'Reading the text...';
    return (
      <View className="flex-1 items-center justify-center p-inset">
        <Text className="font-sans text-body text-text text-center">{copy}</Text>
      </View>
    );
  }

  if (phase === 'error') {
    const copy =
      ageBand === 'young'
        ? "I couldn't read the words. You can type them instead."
        : 'Could not read the text. You can type it instead.';
    return (
      <View className="flex-1 items-center justify-center gap-stack p-inset">
        <Text className="font-sans text-body text-text text-center">{copy}</Text>
      </View>
    );
  }

  /*
    Straight to review even when the read came back empty. An empty box a child
    can type into beats an error telling them the picture failed — they know
    what the problem says; the app is the one that could not read it.
  */
  return (
    <DigitizedTextReview ageBand={ageBand} initialText={text} onConfirm={onConfirm} onCancel={onCancel} />
  );
}
