// Delete-account screen (FD-26) — TS resolution anchor; bundlers load the
// .native/.web forks. A bare .tsx anchor beats .native.tsx in Metro resolution,
// so it must re-export.
// SOT: docs/pack/03-starter-tailoring.md
// SOT-KEYWORDS: account deletion screen anchor fork resolution fd-26

export { DeleteAccountScreen } from './screen.web';
