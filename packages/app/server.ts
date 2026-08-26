// @acme/app/server — server-only barrel for protected operations and services.
// This entry point must never be imported from client code; every re-exported
// file begins with `import 'server-only'`.
// SOT: CLAUDE.md §The block
// SOT-KEYWORDS: app server barrel protected operation service server-only
import 'server-only';

export { protectedOperation, type ProtectedCtx } from './core/protected-operation';
export {
  evaluateTutorTurn,
  type TutorTurnInput,
  type TutorTurnResult,
} from './features/tutor/tutor.service';
