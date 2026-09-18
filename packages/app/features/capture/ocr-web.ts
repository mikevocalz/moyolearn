// Browser recognition candidates. A page uses Tesseract; line-only TrOCR is
// available separately and is never used as a whole-page fallback.
// SOT: docs/design/homework-intelligence.md
// SOT-KEYWORDS: ocr web tesseract trocr source preservation
export interface OcrResult {
  text: string;
  /** 0–100 as Tesseract reports it; undefined when TrOCR produced the text. */
  confidence?: number;
  engine: 'tesseract' | 'trocr';
  regions?: { text: string; confidence: number; direction: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[];
}

/** Printed-page pass. Returns text plus how sure it is. */
export async function readPrinted(source: string): Promise<OcrResult> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const result = await worker.recognize(source, {}, { text: true, blocks: true });
    return {
      text: result.data.text.trim(),
      confidence: result.data.confidence,
      engine: 'tesseract',
      regions: result.data.blocks?.flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines.map((line) => ({ text: line.text, confidence: line.confidence, direction: paragraph.is_ltr ? 'ltr' : 'rtl', bbox: line.bbox })))),
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

export async function readHomework(source: string): Promise<OcrResult> {
  // Whole-page TrOCR can invent or omit lines. Preserve the printed candidate;
  // an empty reading must reach source review, not a line-only recognizer.
  return readPrinted(source);
}
