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

export {
  coachTutorTurn,
  type CoachTurnInput,
  type CoachEvent,
  type LoadGradeBand,
} from './features/tutor/coach.service';
export { PEDAGOGY_CONTRACT, revealsAnswer } from './features/tutor/pedagogy';
// Pure, so the write route can validate against the same list the client edits.
export {
  MANUAL_STAGES,
  applyStageChange,
  clearsAttention,
  type StageChange,
} from './features/ops/stage-change';
export {
  listLeads,
  commitStageChange,
  type ListLeadsInput,
  type ListLeadsResult,
  type LeadSortField,
  type LeadStagePatch,
  type LoadLeads,
  type SaveLeadStage,
} from './features/ops/ops.service';
/*
  The org branding read is PUBLIC and deliberately outside `protectedOperation`
  — a login page has no session to take identity from. The reasoning, and what
  bounds the exposure, is in org.service.ts.
*/
export { orgBrandingFor, type OrgBranding, type LoadOrgBranding } from './features/org/org.service';
export {
  saveLearnerProfile,
  type SaveGradeBand,
} from './features/onboarding/learner-profile.service';
