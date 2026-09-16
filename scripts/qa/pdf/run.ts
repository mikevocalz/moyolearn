// Browser QA against the production reader; observations require source comparison.
// SOT-KEYWORDS: homework pdf edge cases browser QA corpus
import { readPdf } from '../../../packages/app/features/capture/read-pdf.web.ts';
export const names = [
  'wrong-answer',
  'blank',
  'rotated-90',
  'rotated-180',
  'rotated-270',
  'landscape',
  'tiny-page',
  'huge-page',
  'password-protected',
  'truncated',
  'not-a-pdf',
  'zero-pages',
  '101-pages',
  '100-pages',
  'scan-clear',
  'scan-blurred',
  'scan-low-contrast',
  'scan-header-only-layer',
  'broken-font-page1',
  'scanned-fractions-pages65-66',
  'grade5-fractions',
  'handwritten-fractions',
];
const summarize = (
  name: string,
  start: number,
  r: Awaited<ReturnType<typeof readPdf>>,
) => ({
  name,
  ms: Math.round(performance.now() - start),
  pages: r.pages.map((p) => ({
    index: p.index,
    status: p.status,
    text: p.text,
    textLayer: p.textLayer,
    requiresSourceCheck: p.requiresSourceCheck,
    confidence: p.confidence,
    ocrWidth: p.ocrWidth,
    ocrHeight: p.ocrHeight,
    previewBytes: p.preview.length,
    regions: p.regions.length,
    width: p.width,
    height: p.height,
  })),
});
const failure = (name: string, start: number, error: string) => ({
  name,
  ms: Math.round(performance.now() - start),
  error,
});
export async function run() {
  const qa = {
    state: 'running',
    results: [] as Array<
      ReturnType<typeof summarize> | ReturnType<typeof failure>
    >,
  };
  Object.assign(globalThis, { edgeQa: qa });
  for (const name of names) {
    const start = performance.now();
    try {
      const r = await readPdf(
        new Uint8Array(
          await (await fetch('/sources/' + name + '.pdf')).arrayBuffer(),
        ),
      );
      qa.results.push(summarize(name, start, r));
    } catch (e) {
      qa.results.push(failure(name, start, String(e)));
    }
  }
  qa.state = 'complete';
  return qa;
}

void run().then((result) => {
  document.querySelector('#result')!.textContent = JSON.stringify(
    result,
    null,
    2,
  );
});
