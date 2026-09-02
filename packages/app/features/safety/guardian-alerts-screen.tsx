// Guardian alerts screen — TS resolution anchor; bundlers load the .native/.web forks.
// A bare .tsx anchor beats .native.tsx in Metro resolution, so it must re-export.
// SOT: docs/pack/03-starter-tailoring.md
// SOT-KEYWORDS: guardian alerts screen anchor fork resolution
export { GuardianAlertsScreen } from './guardian-alerts-screen.web';
