// Shared native OCR owns one serialized model and retains source-linked candidates.
// SOT: ./native-ocr-evidence.ts; installed OCRModule.fromModelName / forward
// SOT-KEYWORDS: read attachment native ocr executorch evidence single-flight cancellation
import { isAvailable, OCRModule, OCR_ENGLISH } from 'react-native-executorch';
import { createNativeOcrReader } from './native-ocr-evidence.ts';

let ocr: Awaited<ReturnType<typeof OCRModule.fromModelName>> | undefined;

export const readAttachmentEvidence = createNativeOcrReader(async () => {
  ocr ??= await OCRModule.fromModelName(OCR_ENGLISH);
  return ocr;
}, () => isAvailable);

/** Compatibility projection; callers that review evidence use the structured reader. */
export async function readAttachment(uri: string): Promise<string> {
  return (await readAttachmentEvidence(uri)).text;
}
