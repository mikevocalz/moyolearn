// @acme/app — universal business/domain logic and shared screens.
// Screens live in features/* (Solito pattern); add domains alongside them.
// A feature that owns an index.ts is re-exported through it, never past it —
// deep paths make the sub-barrel invisible to search, which is how duplicates start.
// SOT: CLAUDE.md ("Features import a domain's index.ts — never a deep path")
// SOT-KEYWORDS: app package index barrel public-api screens features
export { HomeScreen } from './features/home/screen';
export { ExploreScreen } from './features/explore/screen';
export { NotificationsScreen } from './features/notifications/screen';
export { ProfileScreen } from './features/profile/screen';
export { SettingsScreen } from './features/settings/screen';
export { useProfile, AVATAR_URI, type ThemePreference } from './features/profile/profile.store';
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
export { CaptureScreen, useCaptureStore } from './features/capture';
export { TutorScreen } from './features/tutor/screen';
export { SessionPrepScreen } from './features/session-prep/screen';
export { PlanScreen } from './features/plan/screen';
export { PracticeScreen } from './features/practice/screen';
export { AiActivityScreen } from './features/ai-activity/screen';
export { FamilyCalendarScreen } from './features/family-calendar/screen';
export { OnboardingScreen } from './features/onboarding/screen';
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
export { LearnerFirstRunContent } from './features/onboarding/learner/learner-first-run-content';
export { useLearnerFirstRun } from './features/onboarding/learner/store';
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
} from './features/onboarding/business/milestones';
export type {
  ActivationState,
  Milestone,
  MilestoneId,
  MilestoneProgress,
} from './features/onboarding/business/milestones';
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
export { ErrorScreen } from './features/error/screen';
export { AppQueryProvider, createQueryClient } from './providers/query-provider';
export { SafeAreaProvider } from './providers/safe-area';
export {
  SessionProvider,
  useAppSession,
  useSetContext,
  RoleSwitcher,
  ContextSwitcher,
  type AppSession,
  type AppUser,
  type ActiveContext,
  type Membership,
  type RoleKind,
} from './providers/session';
export * from './features/editor';
