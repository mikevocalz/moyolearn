// @acme/app/server — server-only barrel for protected operations and services.
// This entry point must never be imported from client code; every re-exported
// file begins with `import 'server-only'`.
// SOT: CLAUDE.md §The block
// SOT-KEYWORDS: app server barrel protected operation service server-only
import 'server-only';

export {
  protectedOperation,
  isMockAuth,
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
  type LoadBlockedTags,
  type DistillationPorts,
  type TutorTurnPorts,
} from './features/tutor/tutor.service';

/*
  S27's eraser. Exported beside the tutoring ports because it is the other end of
  the same loop: `LoadBlockedTags` is what distillation reads, and
  `EraseFactAndBlockTag` is what writes it. Splitting them across two barrels
  would let one land without the other, which is the state this feature was
  already in.
*/
export {
  eraseMemoryLine,
  type ErasedLine,
  type EraseFactAndBlockTag,
} from './features/memory/memory.service';

export {
  coachTutorTurn,
  type CoachTurnInput,
  type CoachEvent,
  type CoachPorts,
  type LoadGradeBand,
  type LoadLearnerFlags,
} from './features/tutor/coach.service';
export type { RecordSafetyEvent } from './features/tutor/safety-events';
/*
  The safety-event shape travels with the ports that move it, exactly as
  `DerivedFact` does above. `apps/web` does not depend on `@acme/safety` and
  should not start: the plane is server-side and reaching it from an app package
  is how a classifier ends up called from somewhere that is not the boundary. The
  repository that writes the row still has to name what a row is, so the type
  comes through the barrel that already hands it the port.
*/
export type { SafetyEvent, PlaneLog } from '@acme/safety';
/*
  Doc 12 §5's other half: the pause a child sees, told to the adult who can do
  something about it. Exported from the server barrel because the read runs
  inside `protectedOperation` and the events are a Payload collection — the
  screen gets the shape, never the query.
*/
export {
  guardianSafetyStatus,
  type GuardianSafetyStatus,
  type LoadGuardianSafetyEvents,
  type SafetyAlertSummary,
} from './features/ai-activity/safety-status.service';
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
