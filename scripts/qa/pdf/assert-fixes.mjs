// Assertions for the regressions fixed after the real-document corpus run.
// SOT-KEYWORDS: homework pdf hybrid OCR resolution browser regression assertions
export function assertPdfFixes(qa) {
  if (qa?.state !== 'complete') throw new Error('Wait for all PDF cases to finish');
  const pages = name => {
    const result = qa.results.find(result => result.name === name);
    if (!result?.pages?.length) throw new Error(`Missing successful fixture: ${name}`);
    return result.pages;
  };
  const hybrid = pages('scan-header-only-layer')[0];
  const single = pages('broken-font-page1')[0];
  const packet = pages('grade5-fractions');
  const checks = {
    hybridQuestion: hybrid.text.includes('2+2=5'),
    hybridTextLayer: hybrid.text.includes('Homework page 1'),
    hybridReviewed: hybrid.requiresSourceCheck,
    blurReviewed: pages('scan-blurred')[0].requiresSourceCheck,
    fractionsReviewed: pages('scanned-fractions-pages65-66').every(page => page.requiresSourceCheck),
    packetComplete: packet.length === 20,
    resolutionIndependentOfPageCount: packet.every(page => page.ocrWidth === single.ocrWidth && page.ocrHeight === single.ocrHeight),
    allOcrReviewed: qa.results.flatMap(result => result.pages ?? []).filter(page => page.status === 'ocr').every(page => page.requiresSourceCheck),
    wrongAnswerPreserved: pages('wrong-answer')[0].text === 'Original answer: 2 + 2 = 5',
    hundredPagesComplete: pages('100-pages').length === 100,
  };
  const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  if (failed.length) throw new Error(`PDF regressions: ${failed.join(', ')}`);
  return checks;
}
