// Browser-only PDF.js loader. Assets are bundled locally by copy-pdf-assets.mjs.
// SOT-KEYWORDS: homework pdf browser worker preview canvas cleanup
import { pdfPagesText } from './pdf-pages.ts';
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
    const result = await readPdfPages(document, async (page) => {
      const original = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
        scale: Math.min(
          1.5,
          1200 / Math.max(original.width, original.height),
          Math.sqrt(pixelsPerPage / (original.width * original.height)),
        ),
      });
      const canvas = globalThis.document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      try {
        await page.render({ canvas, viewport }).promise;
        return canvas.toDataURL('image/png');
      } finally {
        canvas.width = 0;
        canvas.height = 0;
      }
    });
    for (const page of result.pages) {
      if (
        (page.status !== 'needs-ocr' && page.status !== 'failed') ||
        !page.preview
      )
        continue;
      try {
        const reading = await readHomework(page.preview);
        if (!reading.text.trim()) continue;
        page.text = reading.text;
        page.status = 'ocr';
        page.regions = (reading.regions ?? []).map((region) => ({
          text: region.text,
          direction: region.direction,
          confidence: region.confidence,
          coordinateSpace: 'preview-pixels',
          transform: [1, 0, 0, 1, region.bbox.x0, region.bbox.y0],
          width: region.bbox.x1 - region.bbox.x0,
          height: region.bbox.y1 - region.bbox.y0,
        }));
      } catch {
        /* Keep the page preview and explicit needs-ocr status for manual review. */
      }
    }
    return { ...result, text: pdfPagesText(result.pages) };
  } finally {
    await task.destroy();
  }
}
