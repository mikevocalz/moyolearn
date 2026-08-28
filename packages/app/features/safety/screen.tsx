// Safety queue screen — TS resolution anchor; bundlers load the .native/.web forks.
// A bare .tsx anchor beats .native.tsx in Metro resolution, so it must re-export.
// SOT: docs/pack/03-starter-tailoring.md
// SOT-KEYWORDS: safety queue screen anchor fork resolution
export { SafetyQueueScreen } from './screen.web';
