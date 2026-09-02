// Tutor incidents screen — TS resolution anchor; bundlers load the .native/.web forks.
// A bare .tsx anchor beats .native.tsx in Metro resolution, so it must re-export.
// SOT: docs/pack/03-starter-tailoring.md
// SOT-KEYWORDS: tutor incidents screen anchor fork resolution
export { TutorIncidentsScreen } from './tutor-incidents-screen.web';
