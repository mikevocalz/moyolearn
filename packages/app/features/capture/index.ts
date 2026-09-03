// Capture feature barrel.
// SOT: CLAUDE.md ("Features import a domain's index.ts — never a deep path")
// SOT-KEYWORDS: capture feature barrel screen store age band

export { CaptureScreen } from './screen';
export { CaptureTip, type CaptureTipProps } from './capture-tip';
export { useCaptureStore } from './capture.store';
export { asAgeBand, bandScaleFor, buttonSizeForBand, captureLabelsForBand } from './age-band';
export type { AgeBand, BandScale } from './age-band';
export type { CaptureMode, CapturePhoto, CaptureStep } from './types';
export { problemStorage } from './problem-storage';
export { readProblem, writeProblem, PROBLEM_KEY } from './problem-storage.shared.ts';
export { readAttachment } from './read-attachment';
export { readingOrder, type TextBox } from './reading-order.ts';
export { CameraSheet } from './CameraSheet';
export { useCameraStore } from './camera.store.ts';
export { readDocumentAt } from './read-document-at.ts';
export { readDocument, extractPdfText, extractDocxText, type DocumentReading } from './read-document.ts';
/*
  `ocr-web` is NOT re-exported here, and the deep-path rule does not apply to it.

  It is the WEB recogniser: Tesseract with a TrOCR escalation, reached through
  `@huggingface/transformers`, which pulls in `onnxruntime-web`. That package
  ships `import(/*webpackIgnore:true* / a)` — a dynamic import with a computed
  specifier — and Metro's production transform rejects it outright:

    ../../node_modules/onnxruntime-web/dist/ort.webgpu.bundle.min.mjs:
    Invalid call at line 8

  A barrel export is a STATIC edge, so naming it here put that module in the
  iOS and Android graphs whether or not a native screen ever called it, and
  `expo run:ios --configuration Release` failed to bundle at all. Dev never
  caught it; only the production transform is strict enough.

  Nothing outside this folder imported these symbols, so the line bought
  nothing. The two files that need them — `read-attachment.web` and
  `ocr-review.tsx` — are themselves web forks and import it directly, which is
  how the rest of this folder already keeps a platform-only module out of the
  other platform's bundle.
*/
