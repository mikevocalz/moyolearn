// Read a photographed problem, in a browser.
//
// Thin on purpose: `ocr-web` owns the two-engine decision (Tesseract for the
// page, TrOCR when the confidence says handwriting). This exists so callers ask
// "what does this picture say" without learning which platform they are on.
// SOT: packages/app/features/capture/ocr-web.ts
// SOT-KEYWORDS: read attachment web ocr tesseract trocr handwriting
import { readHomework } from './ocr-web.ts';

export async function readAttachment(uri: string): Promise<string> {
  try {
    const result = await readHomework(uri);
    return result.text;
  } catch {
    /*
      An unreadable photo must not stop the turn. The child still sent it and
      may have typed a question alongside; returning empty lets the turn go with
      whatever else it has rather than failing the send.
    */
    return '';
  }
}
