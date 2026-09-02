// @acme/app/server — server-only barrel for protected operations and services.
// This entry point must never be imported from client code; every re-exported
// file begins with `import 'server-only'`.
// SOT: CLAUDE.md §The block
// SOT-KEYWORDS: app server barrel protected operation service server-only
import 'server-only';

export {
  protectedOperation,
  isMockAuth,
  setOrgKindReader,
  type ProtectedCtx,
  type ProtectedOperationOptions,
  type LoadOrgKind,
} from './core/protected-operation';
export {
  CapabilityDenied,
  billingReferenceFor,
  grants,
  isFloorCapability,
  withCapability,
  type LoadSubscriptions,
} from './core/capability-gate';
export {
  MembershipDenied,
  withMembership,
  type LoadMembershipRole,
  type RequiredMembership,
} from './core/membership-gate';
export {
  setTenantOrgReader,
  resolveHostTenant,
  HostTenantDenied,
  type LoadTenantOrgId,
} from './core/host-tenant';
export { MEMBERSHIP_ROLES, isMembershipRole, type MembershipRole } from '@acme/auth/membership';
export {
  ORGANIZATION_KINDS,
  type OrganizationKind,
  roleForOrganizationRoleAndKind,
} from './providers/session/role-mapping';
export {
  loadInstitutionOverview,
  loadDistrictOverview,
  loadSchoolOverview,
  type InstitutionOverviewOptions,
} from './features/institution/institution.service';
export {
  loadOrgSettings,
  type OrgSettingsRead,
} from './features/org-settings/org-settings.service';
export {
  loadDistrictSchools,
  type LoadSchools,
} from './features/institution/schools.service';
export {
  loadOrgPeople,
  type LoadOrgMembers,
  type OrgPeople,
} from './features/institution/people.service';
export {
  loadEnrollmentReport,
  type EnrollmentReport,
} from './features/institution/reports.service';
export {
  loadEnrollmentsByOrg,
  type LoadEnrollments,
} from './features/enrollment/enrollment.service';
export type { Enrollment } from './features/enrollment/enrollment.types';
/*
  The teacher's two daily loops (teacher.classes · teacher.assign), exported
  the way enrollment is: values and port types together, so the repositories
  name row shapes through this barrel and never a deep path. Roster reads
  travel through `LoadClassRoster` because a roster IS enrollments by classId
  — the class dimension, not a second roster collection.
*/
export {
  createTeacherClass,
  teacherClasses,
  teacherClassDetail,
  type ClassDetailPorts,
  type CreateClass,
  type LoadClassRoster,
  type LoadTeacherClass,
  type LoadTeacherClasses,
} from './features/classes/classes.service';
export type {
  CreateClassInput,
  TeacherClass,
  TeacherClassDetail,
} from './features/classes/classes.types';
export {
  closeAssignment,
  createAssignmentDraft,
  editAssignmentDraft,
  extendAssignment,
  publishAssignment,
  teacherAssignmentDetail,
  teacherAssignments,
  type AssignmentLifecyclePorts,
  type CountCompletionsByAssignment,
  type CreateAssignment,
  type CreateAssignmentPorts,
  type EditAssignmentPorts,
  type LoadTeacherAssignment,
  type LoadTeacherAssignments,
  type TeacherAssignmentDetailPorts,
  type TeacherAssignmentListPorts,
  type UpdateAssignment,
  type UpdateAssignmentFields,
} from './features/assignments/assignments.service';
export type {
  Assignment,
  AssignmentStatus,
  AssignmentWithCounts,
  AssignmentWorkItem,
  CreateAssignmentInput,
  EditAssignmentInput,
} from './features/assignments/assignments.types';
/*
  The arrival side of the same domain (J1): what a LEARNER sees of published
  work. A separate service from the teacher's because the gates differ — see
  learner-assignments.service.ts — but exported beside it so both ends of the
  assign loop are found in one place.
*/
export {
  learnerAssignments,
  markAssignmentDone,
  type AssignmentCompletionRecord,
  type CreateAssignmentCompletion,
  type LearnerAssignment,
  type LearnerAssignmentPorts,
  type LoadCompletionsForAssignments,
  type LoadLearnerEnrollments,
  type LoadPublishedAssignments,
  type MarkAssignmentDonePorts,
} from './features/assignments/learner-assignments.service';
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
export { tutorCellFor, TUTOR_CAPABILITIES } from './features/tutor/tutor-capabilities';

/*
  S27's eraser. Exported beside the tutoring ports because it is the other end of
  the same loop: `LoadBlockedTags` is what distillation reads, and
  `EraseFactAndBlockTag` is what writes it. Splitting them across two barrels
  would let one land without the other, which is the state this feature was
  already in.
*/
export {
  eraseMemoryLine,
  eraseMemoryTranscript,
  forgetEverything,
  type ErasedLine,
  type ErasedTranscript,
  type ErasedMedia,
  type ForgottenRecord,
  type EraseFactAndBlockTag,
  type EraseTranscriptCascade,
  type EraseLearnerMedia,
  type ForgetLearnerRecord,
  type ForgetSessionSummaries,
  type ForgetEverythingPorts,
} from './features/memory/memory.service';

/*
  Doc 34 — the session-summary domain: §4's pipeline for the job handler, §5's
  guardian and queue reads for their routes, §3's teacher share for both ends
  of the link. Values and port types together, the tutoring-service idiom; the
  repository names the row shapes through this barrel and never a deep path.
*/
export {
  approveSummaryDraft,
  closeSession,
  createTeacherShare,
  generateSessionSummary,
  guardianSummaries,
  guardianSummariesFrom,
  guardianSummaryFrom,
  guardianSummaryReport,
  revokeTeacherShare,
  sharedSummaryView,
  summaryQueue,
  suppressSummary,
  TEACHER_SHARE_TTL_DAYS,
  type CloseTutorSession,
  type DraftActionPorts,
  type EnqueueSummaryJob,
  type GenerateSummaryPorts,
  type GenerateSummaryResult,
  type GuardianReportPorts,
  type GuardianSummaryCard,
  type GuardianSummaryPorts,
  type GuardianSummaryView,
  type LoadEvidenceTurns,
  type LoadGuardianSummaries,
  type LoadGuardianWards,
  type LoadSessionForSummary,
  type LoadSummaryBySession,
  type LoadSummaryQueue,
  type MarkGuardianViewed,
  type NarrativeModel,
  type ResolveCaptureCrop,
  type ResolvedProblemRow,
  type SaveSummaryReport,
  type SharedSummaryPorts,
  type SubjectGroup,
  type SummaryQueuePorts,
  type SummaryQueueRow,
  type SummarySessionRow,
  type TeacherShareGrant,
  type TeacherSharePorts,
  type TeacherShareView,
} from './features/summary/summary.service';
export { extractEvidence, type EvidencedTurn, type MasteryFactEvidence } from './features/summary/evidence';
export type {
  EvidenceRef,
  MasteryMovement,
  ProblemRow,
  SessionSummaryReport,
  SummaryBand,
  SummaryFacts,
  SummaryStatus,
  TeacherShare,
} from './features/summary/summary.types';

export {
  coachTutorTurn,
  type CoachTurnInput,
  type CoachEvent,
  type CoachPorts,
  type LoadGradeBand,
  type LoadLearnerFlags,
} from './features/tutor/coach.service';
/*
  Doc 31 §2.1's band reader, re-exported for the same reason `DerivedFact` is:
  the repository that reads the column has to name what the column means, and
  `apps/web` reaching past this barrel into `@acme/student-model` for it would be
  the app package importing prompt assembly to decode a string. The mapping of
  the two pre-doc-31 values is part of the read, so it travels with it.
*/
export { asVoiceBand, VOICE_BANDS, type VoiceBand } from '@acme/student-model';
/*
  Doc 32's voice turn. Exported beside the coach service because they are two
  halves of one wire: the coach route mints the utterance tag each chunk frame
  carries, and this service is the only thing that will render audio for it.
  The egress itself (`@acme/voice`) is NOT re-exported — it arrives through the
  `SpeakSentence`/`ResolveBakedClip` ports, and `tooling/check-voice-egress.mjs`
  keeps it that way.
*/
export {
  speakTutorSentence,
  voiceOutcome,
  bakedTutorVoice,
  type SpokenSentenceInput,
  type VerifyUtterance,
  type SpeakResult,
  type SpeakSentence,
  type BakedClipResult,
  type ResolveBakedClip,
  type VoicePorts,
  type BakedVoicePorts,
  type VoiceTurnOutcome,
} from './features/tutor/voice.service';
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
/*
  Doc 31 §4 — the incident system's server surface.

  It sits beside the safety-status export above because they are the two halves
  of what an adult is told: the status line is doc 12 §5's "is the tutor running
  right now", and an incident is "something crossed a line and here is what
  happens next". A screen gets these shapes; it never gets the query.

  The `IncidentReport` type travels through this barrel for the same reason
  `SafetyEvent` does two exports up — `apps/web` does not depend on
  `@acme/safety` and must not start, but the repository that writes the row has
  to be able to name what a row is.
*/
export {
  acknowledgeGuardianIncident,
  appendStaffIncidentNote,
  appendTutorIncidentNote,
  guardianIncidents,
  guardianIncidentsFrom,
  incidentStaffRoster,
  incidentTriageQueue,
  submitIncident,
  submitTutorIncident,
  triageIncident,
  triageQueueFrom,
  tutorEngagedLearners,
  tutorIncidents,
  tutorIncidentsFrom,
  CONVERSATION_STARTERS,
  TUTOR_REPORTABLE,
  type EngagedLearner,
  type FanOutIncident,
  type GuardianIncidentPorts,
  type GuardianIncidentView,
  type IncidentStaffMember,
  type LoadGuardianIncidents,
  type LoadIncident,
  type LoadIncidentQueue,
  type LoadIncidentStaff,
  type LoadTutorEngagements,
  type LoadTutorIncidents,
  type SaveIncident,
  type StaffRosterEntry,
  type SubmitIncidentInput,
  type SubmitIncidentPorts,
  type SubmitTutorIncidentInput,
  type SubmitTutorIncidentPorts,
  type TriagePorts,
  type TriageQueue,
  type TriageRow,
  type TutorEngagementPorts,
  type TutorIncidentPorts,
  type TutorIncidentView,
} from './features/safety/incidents.service';
export type {
  IncidentCategory,
  IncidentReport,
  IncidentStatus,
  IncidentTimelineEntry,
  SafetyTier,
} from '@acme/safety';
/*
  The ladder's pure half, re-exported for the same reason the types above are.

  `apps/web` has `@acme/safety` on its dependency list, so this is a convention
  rather than a resolution problem — and the convention is the point: the plane
  is server-side and a repository reaching into it directly is how a classifier
  ends up called from somewhere that is not the boundary. What crosses here is
  arithmetic — a rolling-window climb, a rung's policy, an incident constructor
  — and it crosses through the barrel that already hands the app the ports that
  move those values.
*/
export {
  escalate,
  escalatedSafetyEvent,
  incidentFromSafetyEvent,
  markFannedOut,
  LADDER,
  REPETITION_WINDOW_MINUTES,
} from '@acme/safety';
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
  getLead,
  createLead,
  listFamilies,
  commitStageChange,
  type ListLeadsInput,
  type ListLeadsResult,
  type LeadSortField,
  type LeadStagePatch,
  type LoadLeads,
  type LoadLead,
  type CreateLeadRecord,
  type SaveLeadStage,
  type FamilyGroup,
  type NewLeadInput,
} from './features/ops/ops.service';
// Pure validation floor for the create route — same reasoning as stage-change.
export { parseNewLead, NEW_LEAD_STAGE } from './features/ops/lead-create';
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
  loadLearnerProfile,
  type SaveGradeBand,
} from './features/onboarding/learner-profile.service';
export {
  issueHandoffCode,
  type HandoffDeps,
} from './features/onboarding/handoff/handoff.service';
