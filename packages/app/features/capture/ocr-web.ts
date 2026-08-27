// Reading homework in a browser: printed text and a child's own handwriting.
//
// Two engines, because no free on-device one does both well.
//
//  - Tesseract (WASM) reads a PAGE. It finds lines, columns and problem
//    numbers, and it is fast and small. On typed worksheets and textbook
//    problems it is good. On handwriting it is poor — it was trained on print,
//    and no amount of preprocessing changes that.
//  - TrOCR-handwritten (transformers.js, ONNX, WebGPU when available) reads
//    HANDWRITING, and reads it well. But it is a line-level model with no
//    layout analysis: hand it a whole page and it returns one confused line.
//
// So Tesseract runs first and its CONFIDENCE decides. Confidence is exactly the
// signal here: Tesseract does not know it is looking at handwriting, but it does
// know it is unsure, and on handwriting it is reliably unsure. A low score
// escalates to TrOCR rather than handing a child a garbled read of their own
// work.
//
// Both run on-device. No API, no key, no per-image cost — the same constraint
// that put ExecuTorch on native, met the same way.
// SOT: packages/app/features/capture/ocr-review.tsx
// SOT-KEYWORDS: ocr web tesseract trocr handwriting transformers on-device capture
export interface OcrResult {
  text: string;
  /** 0–100 as Tesseract reports it; undefined when TrOCR produced the text. */
  confidence?: number;
  engine: 'tesseract' | 'trocr';
}

/**
 * Escalate ONLY when Tesseract found nothing at all.
 *
 * This threshold has now been wrong twice, and the second time is the
 * instructive one.
 *
 * First it was a confidence of 70, on the theory that Tesseract is reliably
 * unsure about handwriting. Running it disproved that: `12 x 8 = ?` in clean
 * bold print reads as `12x8="?` at confidence 47 — right enough to coach from.
 * Confidence is averaged per character, and symbols and short strings drag it
 * down, which describes most homework maths.
 *
 * Then it was 8 characters. That read is 7. A number picked to feel safe cut
 * straight through the commonest case in the product.
 *
 * The real lesson is not the number, it is that TrOCR should not be a fallback
 * for a PAGE at all. It is a line-level model with no layout analysis: given a
 * whole photograph it returns one confused line, so escalating to it made a
 * nearly-correct read worse and the tutor refused the turn. Doing that
 * usefully needs line detection first — which is exactly what CRAFT provides on
 * native and what the web path does not have.
 *
 * So: keep whatever Tesseract found, and let the child correct it in
 * `DigitizedTextReview`, which exists for precisely this. Handwriting stays
 * reachable through `readHandwriting` for a caller that has already cropped to
 * a line; it is no longer guessed at from a full page.
 */
export const MIN_USABLE_CHARS = 1;

/** Printed-page pass. Returns text plus how sure it is. */
export async function readPrinted(source: string): Promise<OcrResult> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const result = await worker.recognize(source);
    return {
      text: result.data.text.trim(),
      confidence: result.data.confidence,
      engine: 'tesseract',
    };
  } finally {
    // Always — a live worker holds the WASM heap and its own thread, and a child
    // photographing four problems would otherwise leave four behind.
    await worker.terminate();
  }
}

/** Handwriting pass. Slower and a larger download, so it is not the default. */
export async function readHandwriting(source: string): Promise<OcrResult> {
  const { pipeline } = await import('@huggingface/transformers');
  /*
    `small`, not `base`: this downloads to a child's device, often on school
    wi-fi, and base is several times the size for a margin that does not survive
    a photograph taken at an angle.

    WebGPU where it exists, WASM where it does not — `device: 'webgpu'` is still
    experimental in several browsers, so it is requested rather than required.
  */
  const recognise = await pipeline('image-to-text', 'Xenova/trocr-small-handwritten', {
    device: 'webgpu',
    dtype: { encoder_model: 'fp16', decoder_model_merged: 'q4' },
  }).catch(() => pipeline('image-to-text', 'Xenova/trocr-small-handwritten'));

  const output = (await recognise(source)) as Array<{ generated_text?: string }>;
  return { text: (output[0]?.generated_text ?? '').trim(), engine: 'trocr' };
}

/**
 * Read a photo of homework, printed or handwritten.
 *
 * The escalation is one-way and deliberate: a confident Tesseract read is
 * returned as-is rather than being second-guessed by a slower model, because a
 * correct answer arriving now beats a marginally better one arriving after a
 * download.
 */
export async function readHomework(source: string): Promise<OcrResult> {
  const printed = await readPrinted(source);

  // Anything at all is kept, however unsure Tesseract says it is. A slightly
  // wrong reading of the real problem beats a confident reading of a different
  // one, and the child confirms it in review either way.
  if (printed.text.length >= MIN_USABLE_CHARS) return printed;

  try {
    const handwritten = await readHandwriting(source);
    /*
      Keep whichever actually said more. TrOCR on printed input, or on a page it
      cannot lay out, returns a short confident-looking fragment — so a failed
      escalation must not be allowed to replace what Tesseract managed.
    */
    return handwritten.text.length > printed.text.length ? handwritten : printed;
  } catch {
    return printed;
  }
}
