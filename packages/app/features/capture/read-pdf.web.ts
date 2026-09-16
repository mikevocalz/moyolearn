// Browser-only PDF.js loader. Assets are bundled locally by copy-pdf-assets.mjs.
// SOT-KEYWORDS: homework pdf browser worker preview canvas cleanup
import { mergePdfCandidates, pdfPagesText } from './pdf-pages.ts';
import { readHomework } from './ocr-web';
import { readPdfPages } from './read-pdf-pages.ts';
export async function readPdf(bytes: Uint8Array) {
  const pdfjs = await import('pdfjs-dist');
  const assets = `/pdfjs/${pdfjs.version}/`;
  pdfjs.GlobalWorkerOptions.workerSrc = `${assets}pdf.worker.min.mjs`;
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    cMapUrl: `${assets}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${assets}standard_fonts/`,
    wasmUrl: `${assets}wasm/`,
    stopAtErrors: true,
  });
  try {
    const document = await task.promise;
    // Keep retained previews within a document-wide pixel budget as well as
    // the per-page edge limit. The source PDF remains available at full fidelity.
    const pixelsPerPage = Math.min(1_440_000, 12_000_000 / document.numPages);
    const imageOps = new Set([
      pdfjs.OPS.paintImageXObject,
      pdfjs.OPS.paintInlineImageXObject,
      pdfjs.OPS.paintImageXObjectRepeat,
      pdfjs.OPS.paintInlineImageXObjectGroup,
      pdfjs.OPS.paintImageMaskXObject,
      pdfjs.OPS.paintImageMaskXObjectGroup,
      pdfjs.OPS.paintImageMaskXObjectRepeat,
    ]);
    const result = await readPdfPages(document, async (page, reading) => {
      const original = page.getViewport({ scale: 1 });
      if (
        !(original.width > 0 && original.height > 0) ||
        !Number.isFinite(original.width * original.height)
      )
        throw new Error('Invalid PDF page dimensions');
      // A text header does not prove that image questions were extracted.
      // If inspection fails, require source review and try the rendered page.
      let hasImages = true;
      try {
        const operators = await page.getOperatorList();
        hasImages = operators.fnArray.some((op) => imageOps.has(op));
      } catch {
        /* Conservative fallback for an incomplete operator list. */
      }
      const needsOcr = reading.status !== 'text' || hasImages;
      reading.requiresSourceCheck = needsOcr;
      const previewScale = Math.min(
        1.5,
        1200 / Math.max(original.width, original.height),
        Math.sqrt(pixelsPerPage / (original.width * original.height)),
      );
      // OCR resolution must not fall as the document gets longer. Retain only
      // the small preview; dispose each high-resolution raster after recognition.
      const scale = needsOcr
        ? Math.min(
            3,
            2400 / Math.max(original.width, original.height),
            Math.sqrt(5_000_000 / (original.width * original.height)),
          )
        : previewScale;
      const viewport = page.getViewport({ scale });
      const canvas = globalThis.document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      let preview = '';
      try {
        await page.render({ canvas, viewport }).promise;
        const thumbnail = globalThis.document.createElement('canvas');
        thumbnail.width = Math.ceil(original.width * previewScale);
        thumbnail.height = Math.ceil(original.height * previewScale);
        try {
          const context = thumbnail.getContext('2d');
          if (!context) throw new Error('Preview canvas unavailable');
          context.drawImage(canvas, 0, 0, thumbnail.width, thumbnail.height);
          preview = thumbnail.toDataURL('image/png');
        } finally {
          thumbnail.width = 0;
          thumbnail.height = 0;
        }
        if (needsOcr) {
          reading.ocrWidth = canvas.width;
          reading.ocrHeight = canvas.height;
          // Never accept a partial text header as the entire page after OCR fails.
          reading.status = 'needs-ocr';
          try {
            const candidate = await readHomework(canvas.toDataURL('image/png'));
            reading.confidence = candidate.confidence;
            if (candidate.text.trim()) {
              reading.text = mergePdfCandidates(reading.text, candidate.text);
              reading.status = 'ocr';
              reading.regions.push(
                ...(candidate.regions ?? []).map((region) => ({
                  text: region.text,
                  direction: region.direction,
                  confidence: region.confidence,
                  coordinateSpace: 'ocr-pixels' as const,
                  transform: [1, 0, 0, 1, region.bbox.x0, region.bbox.y0],
                  width: region.bbox.x1 - region.bbox.x0,
                  height: region.bbox.y1 - region.bbox.y0,
                })),
              );
            }
          } catch {
            /* Preserve the preview and any original text for correction. */
          }
        }
        return preview;
      } finally {
        canvas.width = 0;
        canvas.height = 0;
      }
    });
    return { ...result, text: pdfPagesText(result.pages) };
  } finally {
    await task.destroy();
  }
}
