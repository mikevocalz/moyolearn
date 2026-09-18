'use client';
// Review uses the same serialized native OCR service as tutor attachments.
// SOT-KEYWORDS: ocr review native shared singleton lifecycle
import { OcrReviewBase, type OcrReviewProps } from './ocr-review-base';
import { readAttachmentEvidence } from './read-attachment.native';
export type { OcrReviewProps } from './ocr-review-base';
const read = (source: string, _mimeType?: string, signal?: AbortSignal) =>
  readAttachmentEvidence(source, signal);
export function OcrReview(props: OcrReviewProps) {
  return <OcrReviewBase {...props} read={read} />;
}
