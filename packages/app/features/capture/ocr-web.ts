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
 * Below this, treat the page as handwriting and escalate.
 *
 * Tesseract reports ~85–95 on clean print and collapses into the 40s–60s on
 * handwriting. 70 sits in the gap: high enough that a poor print scan still
 * escalates rather than being served badly, low enough that ordinary worksheet
 * noise does not pay for a model download.
 */
export const HANDWRITING_CONFIDENCE_THRESHOLD = 70;

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
  if ((printed.confidence ?? 0) >= HANDWRITING_CONFIDENCE_THRESHOLD && printed.text.length > 0) {
    return printed;
  }
  try {
    const handwritten = await readHandwriting(source);
    // Only prefer it if it actually produced something. A failed model download
    // must not turn a mediocre read into an empty one.
    return handwritten.text.length > 0 ? handwritten : printed;
  } catch {
    return printed;
  }
}
