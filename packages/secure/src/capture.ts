// TS resolution anchor — bundlers load the .native/.web forks.
// SOT: docs/pack/07-security-spec.md §2.5
// SOT-KEYWORDS: capture anchor fork resolution

export { useScreenCaptureGuard, type CaptureGuard } from './capture.web.ts';
