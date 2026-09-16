// PDF page evidence: native adapters and browser parsing share page identity/status.
// SOT-KEYWORDS: homework pdf page regions source text evidence
export const pdfPageStatus = {
  text: 'text',
  ocr: 'ocr',
  needsOcr: 'needs-ocr',
  failed: 'failed',
} as const;
export function pdfPage(index: number) {
  return {
    index,
    text: '',
    // Keep the original extraction even when its font mapping requires OCR.
    textLayer: '',
    status:
      pdfPageStatus.failed as (typeof pdfPageStatus)[keyof typeof pdfPageStatus],
    preview: '',
    width: 0,
    height: 0,
    regions: [] as {
      text: string;
      direction: string;
      transform: number[];
      width: number;
      height: number;
      coordinateSpace: 'pdf-user-space' | 'preview-pixels';
      confidence?: number;
    }[],
  };
}
export type PdfPageReading = ReturnType<typeof pdfPage>;
export function pdfPagesText(pages: readonly PdfPageReading[]): string {
  return pages
    .map(
      (page) =>
        `Page ${page.index}:\n${page.text || (page.status === 'needs-ocr' ? '[Page has no readable text layer; source review required]' : '[Page could not be read; source review required]')}`,
    )
    .join('\n\n');
}
