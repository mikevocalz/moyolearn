'use client';
// Review uses the same serialized native OCR service as tutor attachments.
// SOT-KEYWORDS: ocr review native shared singleton lifecycle
import { OcrReviewBase, type OcrReviewProps } from './ocr-review-base';
import { readAttachment } from './read-attachment.native';
export type { OcrReviewProps } from './ocr-review-base';
const read = async (source: string) => ({ text: await readAttachment(source) });
export function OcrReview(props: OcrReviewProps) {
  return <OcrReviewBase {...props} read={read} />;
}
