// @acme/app — universal business/domain logic and shared screens.
// Screens live in features/* (Solito pattern); add domains alongside them.
// A feature that owns an index.ts is re-exported through it, never past it —
// deep paths make the sub-barrel invisible to search, which is how duplicates start.
// SOT: CLAUDE.md ("Features import a domain's index.ts — never a deep path")
// SOT-KEYWORDS: app package index barrel public-api screens features
export { HomeScreen } from './features/home/screen';
export { LearnerTodayScreen } from './features/home/learner-today-screen';
export { LearnerHubContent } from './features/home/learner-hub-content';
export { GuardianHomeScreen } from './features/home/guardian-home-screen';
export { FamilyScreen } from './features/home/family-screen';
// Family seam (G-8 fix): the store every per-child guardian surface reads, and
// the chip row that writes it (J §2 row 10).
export { ChildSwitcher } from './features/family/child-switcher';
export {
  useFamilyStore,
  useActiveLearnerId,
  type ChildSummary,
} from './features/family/family.store';
// FD-24 family-device switch — ADR-106: a different mechanism from the
// AvatarSheet, never conflated (J §2 row 8).
export {
  ProfileSwitcher,
  type ProfileSwitcherProps,
  type GrownUpsAuth,
} from './features/switch-profile/profile-switcher';
export {
  useProfileSwitcherStore,
  type GrownUpsGate,
} from './features/switch-profile/profile-switcher.store';
// The root-mounted host for the same switcher, plus the store its trigger
// (ShellHeader's avatar, on the K–2/3–5 bands) writes.
export { SwitchProfileSheet } from './features/switch-profile/switch-profile-sheet';
export { useSwitchProfileSheet } from './features/switch-profile/switch-profile-sheet.store';
export { TutorTodayScreen } from './features/home/tutor-today-screen';
export { TeacherHomeScreen } from './features/home/teacher-home-screen';
export { SchoolHomeScreen } from './features/home/school-home-screen';
export { DistrictHomeScreen } from './features/home/district-home-screen';
export { ExploreScreen } from './features/explore/screen';
export { NotificationsScreen } from './features/notifications/screen';
export { InboxScreen } from './features/notifications/inbox-screen';
export { ProfileScreen } from './features/profile/screen';
export { SettingsScreen } from './features/settings/screen';
export { OrgSettingsScreen } from './features/org-settings/screen';
export { useProfile, AVATAR_URI, type ThemePreference } from './features/profile/profile.store';
// ADR-106: the AvatarSheet's app-side content + the store its per-shell
// trigger (ShellHeader's avatar) writes. Root-mounted like every sheet.
export { AccountSheet } from './features/profile/account-sheet-content';
export { useAccountSheet } from './features/profile/account-sheet.store';
export { ScheduleScreen } from './features/schedule/screen';
export { MenuButton } from './features/home/menu-button';
export {
  DEMO_RESOURCES,
  DEMO_DAY,
  DEMO_NOW,
  useScheduleStore,
  MiniCalendar,
  BookingForm,
  type BookingFormProps,
  formatTimeRange,
  type ScheduleEvent,
  type Resource,
} from './features/schedule';
export { CaptureScreen, useCaptureStore, CameraSheet, useCameraStore } from './features/capture';
export { TutorScreen } from './features/tutor/screen';
export { useTutorStore } from './features/tutor/tutor.store';
export type {
  StoredAttachment,
  StoredMessage,
  TutorSessionSnapshot,
} from './features/tutor/session.types';
export { SessionPrepScreen } from './features/session-prep/screen';
export { PlanScreen } from './features/plan/screen';
export { ProgressScreen } from './features/progress/screen';
export { useProgress } from './features/progress/use-progress';
// Doc 34's surfaces: the guardian feed and report (Hot), the tutor queue
// (Cool), and the teacher's tokened read. Screens and their read hooks only —
// the pipeline, the share minting and every port live in `server.ts`.
export { ReportsScreen } from './features/summary/reports-content';
export { SessionReportScreen } from './features/summary/report-content';
export { SummaryQueueScreen } from './features/summary/draft-queue-content';
// Doc 37 §3.3's pane hosts: the same screens inside AdaptivePanes — tutor
// Notes queue|draft and guardian Reports|report on expanded widths, exactly
// the single-column screens on compact.
export { ReportsPaneScreen } from './features/summary/reports-pane-content';
export { SummaryQueuePaneScreen } from './features/summary/draft-queue-pane-content';
export { ShareReportContent } from './features/summary/share-report-content';
export { ReportBody, LEVEL_LABEL, type ReportBodyProps } from './features/summary/report-blocks';
export {
  reportQueryKey,
  reportsQueryKey,
  summaryQueueQueryKey,
  useGuardianReport,
  useGuardianReports,
  useSummaryQueue,
  useTeacherShare,
} from './features/summary/use-reports';
// teacher.classes — ADR-102's Classes tab: the list (pane host on expanded
// widths), the class detail with its roster, and the folded teacher.students
// detail. Screens and their read/write hooks only — the service and its ports
// live in `server.ts`.
export { ClassesScreen, bandLabel } from './features/classes/classes-content';
export { ClassDetailScreen } from './features/classes/class-detail-content';
export { StudentDetailScreen } from './features/classes/student-detail-content';
export { ClassesPaneScreen } from './features/classes/classes-pane-content';
export {
  classRosterQueryKey,
  teacherClassesQueryKey,
  useClassRoster,
  useCreateClass,
  useTeacherClasses,
} from './features/classes/use-classes';
export type {
  CreateClassInput,
  TeacherClass,
  TeacherClassDetail,
} from './features/classes/classes.types';
// teacher.assign — ADR-102's Assign tab: the tracking list, the create form
// (draft in assign.store, per-device by contract), and the assignment detail
// with its lifecycle actions. Screens, hooks, the draft store, and the shared
// display copy — the service and its ports live in `server.ts`.
export { AssignScreen } from './features/assignments/assign-content';
export { AssignmentFormScreen } from './features/assignments/assignment-form-content';
export { AssignmentDetailScreen } from './features/assignments/assignment-detail-content';
export {
  useAssignStore,
  EMPTY_ASSIGN_DRAFT,
  type AssignDraft,
  type AssignStatusFilter,
} from './features/assignments/assign.store';
export { dueLabel, STATUS_BADGE } from './features/assignments/assign-copy';
export {
  assignmentQueryKey,
  teacherAssignmentsQueryKey,
  useAssignment,
  useAssignmentAction,
  useCreateAssignment,
  useEditAssignment,
  useTeacherAssignments,
} from './features/assignments/use-assignments';
export type {
  Assignment,
  AssignmentStatus,
  AssignmentWithCounts,
  AssignmentWorkItem,
  CreateAssignmentInput,
  EditAssignmentInput,
} from './features/assignments/assignments.types';
// The learner's read of the same domain — the J1 arrival signal — plus the
// one write back: the self-reported "mark done". The shape is type-only from
// the server file (erased at build; the use-reports precedent), so the client
// names what arrived without touching the service wall.
export {
  learnerAssignmentsQueryKey,
  useLearnerAssignments,
  useMarkAssignmentDone,
} from './features/assignments/use-learner-assignments';
export type { LearnerAssignment } from './features/assignments/learner-assignments.service';
export { PracticeScreen } from './features/practice/screen';
export { AiActivityScreen } from './features/ai-activity/screen';
export { MemoryScreen } from './features/memory/screen';
export { MemoryContent } from './features/memory/memory-content';
export { useMemoryStore, pendingCascade } from './features/memory/memory.store';
export { MEMORY_FACTS, MEMORY_TRANSCRIPTS, GROUPS as MEMORY_GROUPS, provenanceLabel } from './features/memory/memory.data';
export type { TranscriptLine } from './features/memory/memory.data';
export { FamilyCalendarScreen } from './features/family-calendar/screen';
export { OnboardingScreen } from './features/onboarding/screen';
export { PublicEntryContent } from './features/onboarding/public-entry-content';
export { SignInContent } from './features/onboarding/sign-in-content';
export { DevPersonaSwitch } from './features/onboarding/dev-persona-switch';
export { OnboardingFlowScreen } from './features/onboarding/flow/screen';
export { OnboardingFlowContent } from './features/onboarding/flow/flow-content';
export {
  isOnboardingFlow,
  onboardingPath,
  ONBOARDING_FLOWS,
} from './features/onboarding/flow/flow';
export type { OnboardingFlow } from './features/onboarding/flow/flow';
export { GuardianOnboardingContent } from './features/onboarding/guardian/guardian-onboarding-content';
export { useGuardianOnboarding } from './features/onboarding/guardian/store';
export {
  canAdvance,
  childProblems,
  consentRegime,
  isChildComplete,
  isValidDob,
  nextStep,
  previousStep,
  stepProgress,
  GUARDIAN_STEPS,
  CONSENT_POLICY_VERSION,
} from './features/onboarding/guardian/steps';
export type {
  ChildDraft,
  ChildProblems,
  GuardianDraft,
  GuardianStep,
} from './features/onboarding/guardian/steps';
export { ConsentFlowContent, type ConsentFlowProps } from './features/onboarding/consent/consent-flow-content';
export { useConsentFlow, type ConsentStage } from './features/onboarding/consent/consent.store';
export { demoKbaProvider, type KbaProvider } from './features/onboarding/consent/kba.data';
export {
  createDevConsentChannel,
  type ConsentChannel,
  type DevConsentChannel,
} from './features/onboarding/consent/consent-channel';
export { LearnerFirstRunContent } from './features/onboarding/learner/learner-first-run-content';
export { useLearnerFirstRun } from './features/onboarding/learner/store';
export { HandoffCodePanel, type HandoffCodePanelProps } from './features/onboarding/handoff/handoff-code-panel';
export { HandoffRedeemContent, type HandoffRedeemContentProps } from './features/onboarding/handoff/redeem-content';
export {
  mintHandoffCode,
  redeemHandoffCode,
  createLearnerOnServer,
  type HandoffMintResult,
  type HandoffRedeemResult,
  type CreateLearnerResult,
} from './features/onboarding/handoff/handoff.client';
// Aliased: the guardian machine already owns the unprefixed step-machine names,
// and two `canAdvance` exports from one barrel is how the wrong one gets imported.
export {
  canAdvance as learnerCanAdvance,
  nextStep as learnerNextStep,
  previousStep as learnerPreviousStep,
  stepProgress as learnerStepProgress,
  toggleSubject,
  winItem,
  LEARNER_STEPS,
  MAX_SUBJECTS,
  SUBJECT_TILES,
  FIRST_WIN,
} from './features/onboarding/learner/steps';
export type {
  LearnerDraft,
  LearnerStep,
  SubjectId,
  SubjectTile,
  WinItem,
  WinResult,
} from './features/onboarding/learner/steps';
export { TutorOnboardingContent } from './features/onboarding/tutor/tutor-onboarding-content';
export { useTutorOnboarding } from './features/onboarding/tutor/store';
export {
  canAdvance as tutorCanAdvance,
  nextStep as tutorNextStep,
  previousStep as tutorPreviousStep,
  stepProgress as tutorStepProgress,
  slot,
  summariseSlots,
  toggleSlot,
  BLOCKS,
  DAYS,
  DEFAULT_SLOTS,
  MAX_TEACHABLE,
  OPTIONAL_STEPS,
  STEP_DESTINATION,
  TEACHABLE_SUBJECTS,
  TUTOR_STEPS,
} from './features/onboarding/tutor/steps';
export type {
  Block,
  Credential,
  Day,
  Slot,
  TeachableSubject,
  TutorDraft,
  TutorStep,
} from './features/onboarding/tutor/steps';
export {
  BusinessOnboardingContent,
  type BusinessOnboardingProps,
} from './features/onboarding/business/business-onboarding-content';
export { useBusinessOnboarding } from './features/onboarding/business/store';
export {
  canAdvance as businessCanAdvance,
  nextStep as businessNextStep,
  previousStep as businessPreviousStep,
  stepProgress as businessStepProgress,
  parseInvitees,
  toggleService,
  BUSINESS_STEPS,
  SERVICES,
  SKIP_LABEL,
} from './features/onboarding/business/steps';
export type { BusinessDraft, BusinessStep } from './features/onboarding/business/steps';
// The milestone engine (doc 06 §8 PR-16) — S24 pins it, S17 will sell against it.
export {
  milestoneProgress,
  trialChip,
  EMPTY_ACTIVATION,
  MILESTONES,
} from './features/trial/milestones';
export type {
  ActivationState,
  Milestone,
  MilestoneId,
  MilestoneProgress,
} from './features/trial/milestones';
export {
  guessMapping,
  importRoster,
  parseCsv,
  ROLE_LABELS,
} from './features/onboarding/business/roster-csv';
export type {
  ColumnRole,
  RosterImport,
  RosterRow,
} from './features/onboarding/business/roster-csv';
export { readText } from './features/onboarding/business/read-text';
export type { ReadText } from './features/onboarding/business/read-text.types';
export { TeacherOnboardingContent } from './features/onboarding/teacher/teacher-onboarding-content';
export { useTeacherOnboarding } from './features/onboarding/teacher/store';
export {
  canAdvance as teacherCanAdvance,
  nextStep as teacherNextStep,
  previousStep as teacherPreviousStep,
  stepProgress as teacherStepProgress,
  allowsSelfJoin,
  classCode,
  joinOptions,
  ASSIGNMENT_TEMPLATES,
  CODE_LENGTH,
  GRADE_BANDS,
  TEACHER_STEPS,
} from './features/onboarding/teacher/steps';
export type {
  AssignmentTemplate,
  GradeBand,
  JoinMethod,
  JoinOption,
  TeacherDraft,
  TeacherStep,
} from './features/onboarding/teacher/steps';
export {
  EntitlementsSync,
  PermissionGate,
  fetchEntitlements,
  gateDecision,
  useEntitlements,
  useEntitlementStore,
  type EntitlementsResponse,
  type GateInput,
  type GateRender,
  type PermissionGateProps,
  type ResolvedEntitlements,
} from './providers/entitlements';
export { ConvertContent, TrialRailChip, type ConvertProps } from './features/trial/convert-content';
export { tierGateNote, trialSentence, trialStats, type TrialStat } from './features/trial/convert';
export { PaywallContent, type PaywallProps } from './features/paywall/paywall-content';
export { CancelContent, type CancelProps } from './features/paywall/cancel-content';
export { formatTrialDate, PAYWALL_OFFERS, type PaywallOffer } from './features/paywall/paywall.data';
export { ErrorScreen } from './features/error/screen';
export {
  OpsScreen,
  OpsDashboardContent,
  LeadsScreen,
  LeadDetailScreen,
  FamiliesScreen,
  FamilyDetailScreen,
  EnrollmentScreen,
  useLeads,
  useLead,
  useCreateLead,
  useFamilies,
  useFamily,
  useUpdateFamilyContacts,
  leadsQueryKey,
  leadQueryKey,
  familiesQueryKey,
  familyQueryKey,
  useViewParams,
  useStageAction,
  applyStageChange,
  MANUAL_STAGES,
  leadsRootPath,
  leadDetailPath,
  familiesRootPath,
  familyDetailPath,
  enrollmentRootPath,
  useSessions,
  sessionsQueryKey,
  REVENUE_BY_ORG,
  STAGE_TONE,
  MIN_COHORT,
  attendanceCell,
  type OpsDashboardContentProps,
  type FamilyGroup,
  type FamilyContact,
  type FamilyRecord,
  type FamilyDetailPayload,
  type Lead,
  type Session,
  type Stage,
  type LeadsView,
  type LeadsPage,
  type ShareableView,
  type StageChange,
} from './features/ops';
/*
  Doc 31 §4's incident domain, TYPES ONLY — deliberately, and this barrel is the
  wrong place for anything else.

  `@acme/app`'s index is the client-side entry: everything above it is a screen
  or a store. An incident is read behind `protectedOperation` and its service
  opens with `import 'server-only'`, so what a component may hold is the SHAPE it
  renders and never the function that fetches it. The server half is exported
  from `./server.ts` beside the safety-status service it belongs with.
*/
export type { GuardianIncidentView, TriageQueue, TriageRow, TutorIncidentView } from './features/safety';
/*
  …plus the screen that renders them on both platforms. `SafetyQueueScreen` is
  doc 36 §3.4's org Safety tab on mobile (read-only) and §3.4's web rail
  Safety view (`OrgSafetyContent`, where triage lives per org.safety's
  contract) — client surfaces over `/api/safety/incidents`, which keeps
  `protectedOperation`'s owner/manager wall on the server where no route can
  lower it. They read the barrel's projections and never the service.
*/
export {
  SafetyQueueScreen,
  IncidentQueueContent,
  OrgSafetyContent,
  useIncidentQueue,
  useTriageIncident,
  useOrgSafetyStore,
  incidentQueueKey,
  incidentQueueItemsFrom,
  slaClock,
  unassignedS4Line,
  type IncidentQueueItem,
  type IncidentQueueRead,
  type TriageMove,
  type QueueSeverityFilter,
  type QueueStatusFilter,
  type QueueTone,
} from './features/safety';
/*
  …and doc 36 §3.3's tutor surface over the same domain: the reporter's own
  filed-incident lifecycle view, a client surface over `GET
  /api/tutor/incidents`. No membership wall travels with it — the scoping is
  reporter identity, enforced server-side twice (repository + projection).
*/
export {
  TutorIncidentsScreen,
  TutorIncidentsContent,
  useTutorIncidents,
  useAppendIncidentNote,
  tutorIncidentsKey,
  useTutorIncidentsStore,
  type TutorIncidentsRead,
  type TutorIncidentStatusFilter,
} from './features/safety';
/*
  …and doc 36 §3.2's guardian surface over the same domain: guardian.alerts,
  the §5.2 four-section incident view with the acknowledgment write — a
  client surface over `GET/POST /api/guardian/incidents`, wards-scoped
  server-side. Both the mobile Alerts tab and web `/alerts` render it.
*/
export {
  GuardianAlertsScreen,
  GuardianAlertsContent,
  useGuardianIncidents,
  useAcknowledgeIncident,
  guardianIncidentsKey,
  type GuardianIncidentsRead,
} from './features/safety';
export {
  tusUrlStorage,
  useBunnyUpload,
  useVideoUpload,
  useVideoRecorder,
  VIDEO_MAX_SECONDS,
  formatClock,
  uploadVoiceNote,
  MAX_BYTES,
  type TusUrlStorage,
  type MediaKind,
  type PresignResult,
  type UploadPhase,
  type PickedFile,
  UploadQueueProvider,
  useUploadQueue,
  setUploadReporter,
  type QueuedUpload,
  type CompletedUpload,
  type UploadReporter,
} from './features/media';
export { AppQueryProvider, createQueryClient } from './providers/query-provider';
export { SafeAreaProvider } from './providers/safe-area';
export * from './features/conference';
export * from './features/institution';
export {
  SessionProvider,
  useAppSession,
  useSetContext,
  RoleSwitcher,
  ContextSwitcher,
  ScopeSwitcher,
  shellForRole,
  availableRoles,
  resolveBootRole,
  membershipForRole,
  SHELL_ROOTS,
  getLastShellRole,
  setLastShellRole,
  type Shell,
  type AppSession,
  type AppUser,
  type ActiveContext,
  type ActiveContextKind,
  type Membership,
  type RoleKind,
} from './providers/session';
export * from './features/editor';
export {
  AppHeader,
  AppFooter,
  type AppHeaderProps,
  type AppFooterProps,
  type AppHeaderTheme,
  type AppFooterTheme,
} from './features/shell';
export {
  resolveTenantTheme,
  tenantCssVariables,
  type ResolvedTenantTheme,
  type TenantBrand,
} from './core/tenant-theme';
export { ThemeProvider, useResolvedBrand, type ThemeProviderProps } from './providers/theme';
export { type OrgBranding } from './features/org';
