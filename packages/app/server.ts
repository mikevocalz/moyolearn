// @acme/app/server — server-only barrel for protected operations and services.
// This entry point must never be imported from client code; every re-exported
// file begins with `import 'server-only'`.
// SOT: CLAUDE.md §The block
// SOT-KEYWORDS: app server barrel protected operation service server-only
import 'server-only';

export {
  protectedOperation,
  type ProtectedCtx,
  type ProtectedOperationOptions,
} from './core/protected-operation';
export {
  CapabilityDenied,
  billingReferenceFor,
  grants,
  isFloorCapability,
  withCapability,
  type LoadSubscriptions,
} from './core/capability-gate';
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
export {
  openSession,
  addMessage,
  attachUploadedMedia,
  SessionNotFound,
  type TutorSessionRow,
  type AttachmentPatch,
  type OpenSessionInput,
  type AddMessageInput,
  type AttachUploadedMediaInput,
  type LoadOpenSession,
  type CreateSession,
  type AppendMessage,
  type PatchAttachment,
} from './features/tutor/session.service';
/*
  The stored shapes travel with the ports that move them. The repository has to
  name `StoredMessage` to decode the JSON column, and re-exporting it here means
  it reaches for the service barrel rather than a deep path into the feature.
*/
export type {
  StoredAttachment,
  StoredMessage,
  TutorSessionSnapshot,
} from './features/tutor/session.types';
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
export { orgBrandingFor, type OrgBranding, type LoadOrgBranding } from './features/org';
export {
  presignStreamUpload,
  StreamRejected,
  type StreamUploadCredential,
  type CreateStreamVideo,
  type SignStreamUpload,
} from './features/media/stream.service';
export {
  presignUpload,
  presignVoiceNote,
  PresignRejected,
  type VoiceNotePresign,
  MAX_BYTES,
  type PresignRequest,
  type PresignResult,
  type MediaKind,
  type SignUpload,
} from './features/media/presign.service';
export {
  saveLearnerProfile,
  type SaveGradeBand,
} from './features/onboarding/learner-profile.service';
