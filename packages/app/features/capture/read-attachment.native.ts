// Read a photographed problem, on device, via ExecuTorch's CRAFT + CRNN.
//
// The module-level instance is created ONCE. `OCRModule.fromModelName` loads
// two models; doing that per photograph would make a four-image turn pay for
// eight model loads.
// SOT: packages/app/features/capture/ocr-review.native.tsx
// SOT-KEYWORDS: read attachment native ocr executorch craft crnn homework
import { OCRModule, OCR_ENGLISH } from 'react-native-executorch';
import { readingOrder } from './reading-order.ts';

let ocr: Awaited<ReturnType<typeof OCRModule.fromModelName>> | undefined;

export async function readAttachment(uri: string): Promise<string> {
  try {
    ocr ??= await OCRModule.fromModelName(OCR_ENGLISH);
    const detections = await ocr.forward(uri);
    /*
      IN READING ORDER. This was `detections.map(d => d.text).join('\n')`, and a
      text detector emits boxes in its own order — CRAFT's is roughly by
      activation, not by position — so a photographed worksheet came back as its
      own words shuffled. The model was doing its job; nothing was putting the
      page back together afterwards.
    */
    return readingOrder(detections);
  } catch (error) {
    /*
      A silent catch is why "I uploaded my homework and nothing happened" had
      no trace to follow: the reading came back empty, the turn went out with
      no problem text in it, and the child got a generic reply. The contract
      still holds — an unreadable photo costs the reading, not the turn — but
      it no longer costs the DIAGNOSIS.
    */
    if (__DEV__) console.warn('[readAttachment] %s failed:', 'ExecuTorch OCR', error);
    // Same contract as web: an unreadable photo costs the reading, not the turn.
    return '';
  }
}
