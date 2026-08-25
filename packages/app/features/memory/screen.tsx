// Memory screen — TS resolution anchor; bundlers load the .native/.web forks.
// A bare .ts/.tsx anchor beats .native.tsx in Metro resolution, so it must re-export.
// SOT: docs/pack/03-starter-tailoring.md
// SOT-KEYWORDS: memory screen anchor fork resolution

export { MemoryScreen } from './screen.web';
