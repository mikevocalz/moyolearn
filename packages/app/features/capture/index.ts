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
export { readDocumentAt } from './read-document-at.ts';
export { readDocument, extractPdfText, extractDocxText, type DocumentReading } from './read-document.ts';
export { readHomework, readPrinted, readHandwriting, MIN_USABLE_CHARS, type OcrResult } from './ocr-web.ts';
