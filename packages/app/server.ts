// @acme/app/server — server-only barrel for protected operations and services.
// This entry point must never be imported from client code; every re-exported
// file begins with `import 'server-only'`.
// SOT: CLAUDE.md §The block
// SOT-KEYWORDS: app server barrel protected operation service server-only
import 'server-only';

export { protectedOperation, type ProtectedCtx } from './core/protected-operation';
export type {
  DerivedFact,
  MasteryFact,
  ReviewFact,
  ScaffoldingFact,
  MisconceptionFact,
  InterestFact,
} from '@acme/student-model';
export {
  evaluateTutorTurn,
  type TutorTurnInput,
  type TutorTurnResult,
  type TranscriptToSave,
  type SaveTranscript,
  type LoadPriorFacts,
  type SaveFacts,
} from './features/tutor/tutor.service';
