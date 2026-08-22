// Capture feature barrel.
// SOT: CLAUDE.md ("Features import a domain's index.ts — never a deep path")
// SOT-KEYWORDS: capture feature barrel screen store age band

export { CaptureScreen } from './screen';
export { useCaptureStore } from './capture.store';
export { asAgeBand, buttonSizeForBand, captureLabelsForBand } from './age-band';
export type { AgeBand } from './age-band';
export type { CaptureMode, CapturePhoto, CaptureStep } from './types';
