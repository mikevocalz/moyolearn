'use client';
// Web OCR shares cancellation, failure and manual-review behavior with native.
// SOT-KEYWORDS: ocr review web shared lifecycle
import { OcrReviewBase, type OcrReviewProps } from './ocr-review-base';
import { readHomework } from './ocr-web';
export type { OcrReviewProps } from './ocr-review-base';
export function OcrReview(props: OcrReviewProps) {
  return <OcrReviewBase {...props} read={readHomework} />;
}
