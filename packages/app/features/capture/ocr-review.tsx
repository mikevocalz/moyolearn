// OcrReview — web fallback. Native OCR lives in ./ocr-review.native.tsx.
// SOT: docs/pack/24-homework-capture-spec.md §5
// SOT-KEYWORDS: ocr review web fallback executorch

import { Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';

export interface OcrReviewProps {
  source: string;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

export function OcrReview(_props: OcrReviewProps) {
  return (
    <View className="flex-1 items-center justify-center p-inset">
      <Text className="font-sans text-body text-text">Text scanning is only available in the app.</Text>
    </View>
  );
}
