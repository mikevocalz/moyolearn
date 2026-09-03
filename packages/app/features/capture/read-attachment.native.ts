// Read a photographed problem, on device, via ExecuTorch's CRAFT + CRNN.
//
// The module-level instance is created ONCE. `OCRModule.fromModelName` loads
// two models; doing that per photograph would make a four-image turn pay for
// eight model loads.
// SOT: packages/app/features/capture/ocr-review.native.tsx
// SOT-KEYWORDS: read attachment native ocr executorch craft crnn homework
import { OCRModule, OCR_ENGLISH } from 'react-native-executorch';

let ocr: Awaited<ReturnType<typeof OCRModule.fromModelName>> | undefined;

export async function readAttachment(uri: string): Promise<string> {
  try {
    ocr ??= await OCRModule.fromModelName(OCR_ENGLISH);
    const detections = await ocr.forward(uri);
    return detections.map((d) => d.text).join('\n').trim();
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
