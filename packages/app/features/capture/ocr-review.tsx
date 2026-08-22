// OcrReview — web fallback. Native OCR lives in ./ocr-review.native.tsx.
// SOT: docs/pack/24-homework-capture-spec.md §5
// SOT-KEYWORDS: ocr review web fallback executorch age band

import { Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import type { AgeBand } from './age-band';

export interface OcrReviewProps {
  ageBand?: AgeBand;
  source: string;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

export function OcrReview({ ageBand }: OcrReviewProps) {
  const copy =
    ageBand === 'young'
      ? 'Reading words from pictures only works in the app. Ask a grown-up to help.'
      : 'Text scanning is only available in the app.';
  return (
    <View className="flex-1 items-center justify-center p-inset">
      <Text className="font-sans text-body text-text text-center">{copy}</Text>
    </View>
  );
}
