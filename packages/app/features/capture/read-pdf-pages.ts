// Page-tree extraction via PDF.js. Never discard a failed/blank page or normalize text.
// SOT-KEYWORDS: homework pdfjs page tree text regions extraction
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { pdfPage, pdfPagesText } from './pdf-pages.ts';
import type { PdfPageReading } from './pdf-pages.ts';
export async function readPdfPages(
  document: Pick<PDFDocumentProxy, 'numPages' | 'getPage'>,
  preview?: (page: PDFPageProxy, reading: PdfPageReading) => Promise<string>,
) {
  const pages: PdfPageReading[] = [];
  // Bound parser/render work; report a document failure instead of truncating pages.
  if (
    !Number.isInteger(document.numPages) ||
    document.numPages < 1 ||
    document.numPages > 100
  )
    throw new Error('PDF exceeds page limit or has no pages');
  for (let index = 1; index <= document.numPages; index++) {
    const result = pdfPage(index);
    let page: PDFPageProxy | undefined;
    try {
      page = await document.getPage(index);
      const viewport = page.getViewport({ scale: 1 });
      result.width = viewport.width;
      result.height = viewport.height;
      try {
        const content = await page.getTextContent({
          disableNormalization: true,
        });
        for (const item of content.items) {
          if (!('str' in item)) continue;
          result.regions.push({
            coordinateSpace: 'pdf-user-space',
            text: item.str,
            direction: item.dir,
            transform: [...item.transform],
            width: item.width,
            height: item.height,
          });
          result.text += item.str + (item.hasEOL ? '\n' : '');
        }
        result.textLayer = result.text;
        // Broken font maps can return nonempty control codes instead of words.
        // Do not guess a substitution cipher or pass these through as homework.
        // Keep the raw layer/regions as evidence while the browser tries OCR.
        const brokenMapping =
          /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\ufffd]/u.test(
            result.text,
          );
        if (brokenMapping) result.text = '';
        result.status = result.text.trim() ? 'text' : 'needs-ocr';
      } catch {
        // Rendering can still recover a page whose text layer is damaged.
        result.status = 'failed';
      }
      if (preview) {
        // A preview failure must not erase text successfully extracted from this page.
        try {
          result.preview = await preview(page, result);
        } catch {
          result.preview = '';
          result.requiresSourceCheck = true;
        }
      }
    } catch {
      result.status = 'failed';
    } finally {
      try {
        page?.cleanup();
      } catch {
        /* Disposal cannot discard page evidence. */
      }
    }
    pages.push(result);
  }
  return { text: pdfPagesText(pages), reason: 'ok' as const, pages };
}
