# Mobile / Tablet Role UX Audit

Audit for the mobile/tablet UX architecture build. Facts were verified against the repo under `/Users/mikevocalz/MoyoLearn` on 30 Aug 2026.

---

## 1. Skills installed

These skills are recorded in `skills-lock.json` and present in `.agents/skills/`.

| Skill | Source package | SKILL.md | Version / hash | Notes |
|---|---|---|---|---|
| `expo-overview` | `expo/skills` | `plugins/expo/skills/expo-overview/SKILL.md` | v1.0.0, hash `266daf…cdcdc0c` |  |
| `expo-router` | `expo/skills` | `plugins/expo/skills/expo-router/SKILL.md` | v1.0.1, hash `b5baa6…523361c` |  |
| `expo-design-system` | `expo/skills` | `plugins/expo/skills/expo-design-system/SKILL.md` | v1.0.0, hash `926d79…9cd1aba` |  |
| `expo-native-ui` | `expo/skills` | `plugins/expo/skills/expo-native-ui/SKILL.md` | v1.1.1, hash `3bebac…6addd75` |  |
| `expo-animation` | `expo/skills` | `plugins/expo/skills/expo-animation/SKILL.md` | v1.0.0, hash `55d68c…3ceb077` |  |
| `expo-data-fetching` | `expo/skills` | `plugins/expo/skills/expo-data-fetching/SKILL.md` | v1.0.0, hash `422197…5fa8977` |  |
| `react-navigation` | `callstackincubator/agent-skills` | `skills/react-navigation/SKILL.md` | no version in front matter, hash `f09111…4d1ced60` |  |
| `react-native-best-practices` | `callstackincubator/agent-skills` | `skills/react-native-best-practices/SKILL.md` | no version in front matter, hash `4b2b95…cbcb2bfb` |  |
| `react-native-testing` | `callstack/react-native-testing-library` | `skills/react-native-testing/SKILL.md` | no version in front matter, hash `bb30ad…52fd649` |  |
| `agent-device` | `callstack/agent-device` | `skills/agent-device/SKILL.md` | no version in front matter, hash `0a673f…3f97d231` |  |
| `dogfood` | `callstack/agent-device` | `skills/dogfood/SKILL.md` | no version in front matter, hash `8e6dfb…4526b6b` |  |

**Not installed / skipped:** None of the requested skills are missing. The `skills-lock.json` hashes are the only commit-like identifiers available; the source type is `github` and no explicit tag or commit is stored.

---

## 2. Repository facts verified

### 2.1 `apps/mobile/app` route structure and group layouts

- **Root layout** `apps/mobile/app/_layout.tsx` mounts providers (Gesture, Keyboard, SafeArea, BottomSheet, AppQuery, Session, global sheets, Toaster). Every modal/sheet is hoisted here because nested Gorhom modals do not render inside split layouts.
- **Dispatcher** `apps/mobile/app/index.tsx` reads `useAppSession`, resolves `bootRole` from `resolveBootRole` / `getLastShellRole`, swaps `activeContext` in an effect, and redirects to one of the `SHELL_ROOTS` defined in `packages/app/providers/session/shell.ts:34`.
- **Shell groups (Expo Router groups):**
  - `(learner)/_layout.tsx` — `RoleScope role="learner"` + `Stack.Protected guard={isLearner}` + `(tabs)` `Stack.Screen`, plus `plan` and `tutor` stack routes.
  - `(guardian)/_layout.tsx` — `RoleScope role="guardian"` + `Stack.Protected guard={isGuardian}` + `(tabs)` and `memory`, `ai-activity`, `family-calendar`, `reports/[sessionId]`.
  - `(tutor)/_layout.tsx` — `RoleScope role="tutor"` + `Stack.Protected guard={isEducator}` where `kind === 'tutor' || kind === 'teacher'`, plus `(tabs)`.
  - `(org)/_layout.tsx` — `RoleScope role="org"` + `Stack.Protected guard={isOwner}` (`activeContext.kind === 'owner'`) plus `(tabs)`.
- **Onboarding / public-adjacent routes (not protected, outside the role groups):**
  - `onboarding/index.tsx` → `OnboardingScreen`
  - `onboarding/[flow].tsx` → `OnboardingFlowScreen`
  - `handoff.tsx` → `HandoffRedeemContent`
  - `settings.tsx` → `SettingsScreen`, redirects to `/` when `status === "anon"`
  - `editor-settings/index.tsx` → `EditorSettingsScreen`
  - `+not-found.tsx` → silent redirect to `/` (doc 36 §4.4)
- **No `(public)` group exists yet** for the auth screens described in `docs/38-front-door-and-flow.md` §2. Onboarding is the only non-shell route currently wired.

### 2.2 `packages/app/features` screen/flow organization

`packages/app/index.ts` is the public barrel. Shared screens are organized by feature:

- `home` — `LearnerTodayScreen`, `GuardianHomeScreen`, `TutorTodayScreen`, `ParentHomeContent`, `LearnerHubContent`, `StudentHomeContent`.
- `capture` — `CaptureScreen` with native/web/anchor forks; `capture-screen.tsx` orchestrates camera/photo/file/type/voice entry, OCR, crop, preview.
- `tutor` — `TutorScreen` (the AI session), `tutor-screen.tsx:32-450` handles `start`, `hydrate`, `coach`, `recordAttempt`, voice/photo/document attachments, offline arithmetic fallback.
- `plan` — `PlanScreen` with `PlanContent` week strip + day agenda.
- `progress` — `ProgressScreen` with `useProgress`, live mastery + seeded data.
- `practice` — `PracticeScreen` / `PracticeContent` multiple-choice player.
- `explore` — `ExploreScreen` / `ExploreContent` template resources.
- `profile` / `settings` — `ProfileScreen` (with `ContextSwitcher`), `SettingsScreen`.
- `notifications` — `NotificationsScreen` / `NotificationsContent`.
- `ai-activity` — `AiActivityScreen` / `AiActivityContent` guardian safety/permissions/observations.
- `memory` — `MemoryScreen` / `MemoryContent` S27 erasure transparency.
- `family-calendar` — `FamilyCalendarScreen` / `FamilyCalendarContent`.
- `session-prep` — `SessionPrepScreen` / `SessionPrepContent` for human tutors.
- `summary` — `ReportsScreen`, `ReportsPaneScreen`, `SessionReportScreen`, `SummaryQueueScreen`, `SummaryQueuePaneScreen`, `ShareReportContent`.
- `ops` — `OpsScreen`, `OpsDashboardContent`, `useLeads`, pipeline tables, `useStageAction`.
- `safety` — `SafetyQueueScreen` / `IncidentQueueContent`.
- `onboarding` — `OnboardingScreen`, `OnboardingFlowScreen`, per-role flow stores (`guardian`, `learner`, `tutor`, `business`, `teacher`).
- `editor`, `media`, `trial`, `paywall`, `error` — supporting surfaces.

### 2.3 Role shells and how guards are applied

- `packages/app/providers/session/types.ts:7` defines `RoleKind = 'learner' | 'guardian' | 'tutor' | 'teacher' | 'owner'`.
- `shellForRole` in `packages/app/providers/session/shell.ts:17` maps `teacher` → `tutor` shell, `owner` → `org` shell; `anon` → `null`.
- `SHELL_ROOTS` (`shell.ts:34`): learner `/today`, guardian `/family-home`, tutor `/tutor-today`, org `/overview`.
- Guards are applied in two layers:
  1. **Shell chrome colour** — `RoleScope` in each group `_layout.tsx` scopes the role accent CSS custom property.
  2. **Navigational protection** — `Stack.Protected` from `expo-router` with a boolean guard. If the guard becomes false, the route is purged from history and deep links drop to `+not-found` (silent redirect to `/`).
- **Dispatcher/boot logic** lives in `apps/mobile/app/index.tsx`; it never shows a picker wall; it uses `last-used` role and falls back to first available.

### 2.4 Onboarding and adaptive pane / SplitView work

- **Onboarding** `apps/mobile/app/onboarding/index.tsx` and `[flow].tsx` load `OnboardingScreen` / `OnboardingFlowScreen`. `packages/app/features/onboarding/flow/flow.ts:14` maps `guardian | learner | tutor | owner | teacher` to S21–S25 sequences. The mobile app currently has only the generic persona picker (`OnboardingContent` in `packages/app/features/onboarding/onboarding-content.tsx`) and thin flow wrappers; the actual per-role step content is in `packages/app/features/onboarding/{guardian,learner,tutor,business,teacher}/`.
- **Handoff** `apps/mobile/app/handoff.tsx` is the learner device entry for `moyo://handoff?code=…`; on success it pushes to `/onboarding/learner`.
- **Adaptive panes** are implemented in `packages/ui/adaptive-panes/` (the cross-platform layout, not `expo-router/unstable-split-view`). It is consumed by:
  - `packages/app/features/summary/reports-pane-content.tsx` — guardian `ReportsPaneScreen` (Reports list | Session report detail).
  - `packages/app/features/summary/draft-queue-pane-content.tsx` — tutor `SummaryQueuePaneScreen` (Notes queue | Draft detail).
- `TwoPaneShell` exists in `packages/ui/TwoPaneShell.tsx` for auth/marketing brand+form layout, but it is not used by any `apps/mobile/app` route yet.

### 2.5 Shared components, stores, and services

- **Components index** `packages/ui/index.ts` exposes `RoleScope`, `AdaptivePanes`, `TwoPaneShell`, `TutorStage`, `SessionToolbar`, `DataTable`, `DashboardShell`, `SafeArea`, `BottomSheet`, `CoachMark`, `LoadingSkeleton`, `EmptyState`, etc.
- **Stores** (Zustand) of note:
  - `useSessionStore` (`packages/app/providers/session/store.ts`)
  - `useCaptureStore`, `useTutorStore`, `useProgress`, `usePracticeStore`, `usePlanStore`, `useExplore`, `useProfile`, `useNotifications`, `useAiActivityStore`, `useMemoryStore`, `useFamilyCalendarStore`, `useScheduleStore`, `useOpsChrome`, `useStageAction`, `useIncidentQueue`, `useGuardianReports`, `useSummaryQueue`.
- **Services** (server-only, behind `protectedOperation`):
  - `packages/app/features/summary/summary.service.ts`, `packages/app/features/safety/incidents.service.ts`, `packages/app/features/ops/ops.service.ts`, `packages/app/features/onboarding/handoff/handoff.client.ts`.
- **Query layer** `packages/app/providers/query-provider.ts` uses React Query with `createQueryClient`.

### 2.6 Fixtures or demo-only surfaces

- `packages/app/fixtures/personas.ts` provides `PERSONAS` for dev/test/mock sessions.
- `packages/app/features/home/student-home.data.ts`, `tutor-today.data.ts`, `parent-home.data.ts` supply static demo rows.
- `packages/app/features/schedule/fixtures.ts` (`DEMO_DAY`, `DEMO_RESOURCES`, `DEMO_NOW`) are used by `ScheduleScreen`.
- `packages/app/features/ops/ops.data.ts` still contains `SESSIONS_BY_ORG` and `REVENUE_BY_ORG` fixtures; `EXAMPLE_LEADS` for empty state.
- `packages/app/features/summary/summary.service.ts` has real `protectedOperation` handlers, but the queue screens use real queries now (`useGuardianReports`, `useSummaryQueue`).
- `packages/app/features/memory/memory.data.ts` is an S27 fixture; `packages/app/features/ai-activity/ai-activity.data.ts` has fixture consents/observations/artefacts.

---

## 3. Route-to-experience inventory

| role/permission boundary | route path and layout file | source screen/feature component | intended user job | current phone navigation entry | current tablet navigation entry / pane behavior | state coverage | status | recommended action | accessibility / child-safety notes |
|---|---|---|---|---|---|---|---|---|---|
| none (dispatch) | `/` — `apps/mobile/app/index.tsx` | `Dispatcher` from `@acme/app` | role dispatch to landing | n/a (root) | n/a | loading (`View` placeholder) | partial | keep, wire to live onboarding | no permission toasts to children; silent drops via `+not-found` |
| none (not found) | `+not-found` — `apps/mobile/app/+not-found.tsx` | `<Redirect href="/" />` | silent drop for role-mismatched deep links | n/a | n/a | default | production-ready | keep | critical: never shows a "no permission" screen to a child |
| none (onboarding picker) | `/onboarding` — `apps/mobile/app/onboarding/index.tsx` | `OnboardingScreen` (`packages/app/features/onboarding/screen.native.tsx`) | choose persona and consent | root when `anon` | single column | populated; no loading/error/offline | partial | polish / complete per-role flows | consent language is present; no child credentials collected |
| none (per-role onboarding) | `/onboarding/[flow]` — `apps/mobile/app/onboarding/[flow].tsx` | `OnboardingFlowScreen` | guardian/learner/tutor/business/teacher first-run | deep link | single column | populated (fixture-driven) | partial | complete per doc 38 FD-10..FD-23 | needs COPPA verifiable consent UI |
| none (handoff) | `/handoff` — `apps/mobile/app/handoff.tsx` | `HandoffRedeemContent` | learner redeems guardian code | deep link / "I have a code" | single column | populated; no loading/error | partial | complete live handoff client (`handoff.client.ts:97` is mock short-circuit) | child never types email/password; code-only path |
| authed, any role | `/settings` — `apps/mobile/app/settings.tsx` | `SettingsScreen` | preferences, session, theme | from Profile/You | single column | populated | partial | keep, wire sign out/delete | no paywall surfaces on learner |
| editor | `/editor-settings` — `apps/mobile/app/editor-settings/index.tsx` | `EditorSettingsScreen` | note-editor preferences | from editor toolbar | single column | populated | partial | keep | n/a |
| learner | `/(learner)/(tabs)/today` — `apps/mobile/app/(learner)/(tabs)/today.tsx` | `LearnerTodayScreen` (`packages/app/features/home/learner-today-screen.tsx`) | begin/resume learning, landing | Today tab | single column (never split per doc 37 §3.3) | populated; young band hub, teen resume-first; no loading/error | fixture-only | keep, replace fixtures with session data | K–2 hub uses large targets; voice-first prompt |
| learner | `/(learner)/(tabs)/subjects` — `apps/mobile/app/(learner)/(tabs)/subjects.tsx` | `ExploreScreen` (`packages/app/features/explore/screen.native.tsx`) | browse learning resources | Subjects tab (child/teen/adult only) | single column | populated (fixture cards); search works; no loading/error | fixture-only | keep, replace `CARDS` fixture with real catalog | 3–12 only; hidden for `young` via `href: null` |
| learner | `/(learner)/(tabs)/capture` — `apps/mobile/app/(learner)/(tabs)/capture.tsx` | `CaptureScreen` (`packages/app/features/capture/capture-screen.tsx`) | upload/capture homework | Snap tab (raised center, all bands) | single column | entry → capture → preview → review; no global error/offline state | partial | keep, finish camera native fork if missing; wire OCR to live model | child-facing; no paywall; permission asked at first Snap |
| learner | `/(learner)/(tabs)/progress` — `apps/mobile/app/(learner)/(tabs)/progress.tsx` | `ProgressScreen` (`packages/app/features/progress/progress-screen.tsx`) | view progress and evidence | Progress tab (teen/adult only) | single column | loading text, populated, empty (no seeded data); no error/offline | partial | keep, wire to real mastery service; 6–12 only | 6–12 only; hidden for `young`/`child` via `href: null` |
| learner | `/(learner)/(tabs)/stuff` — `apps/mobile/app/(learner)/(tabs)/stuff.tsx` | `PracticeScreen` (`packages/app/features/practice/screen.native.tsx`) | practice / my stuff | My Stuff tab (young) / Me (child) | single column | populated, success (session end); no loading/error | fixture-only | keep, wire practice items from student model | K–5 target copy; no score pressure |
| learner | `/(learner)/(tabs)/you` — `apps/mobile/app/(learner)/(tabs)/you.tsx` | `ProfileScreen` (`packages/app/features/profile/screen.native.tsx`) | profile, role switch | You tab (child/teen/adult) | single column | populated; no loading/error | partial | keep; `ContextSwitcher` already mounted | role switcher lives on You per doc 36 §4.3 |
| learner | `/(learner)/plan` — `apps/mobile/app/(learner)/plan.tsx` | `PlanScreen` (`packages/app/features/plan/plan-content.tsx`) | view assignments and due work | "See all" from Today / deep link | single column | populated, empty (no items day); no loading/error | fixture-only | keep, wire `PLAN_WEEK` to real assignments | plan timeline, not grid (screen-reader order) |
| learner | `/(learner)/tutor` — `apps/mobile/app/(learner)/tutor.tsx` | `TutorScreen` (`packages/app/features/tutor/tutor-screen.tsx`) | start AI tutor session | hub tile "Talk to Natalie" or after capture | single column (never split) | loading (`Finding your next problem…`), populated, offline fallback in `recordAttempt` | partial | keep, harden offline + hydrate race | child-facing; AI routed through Safety Plane; no direct model call |
| guardian | `/(guardian)/(tabs)/family-home` — `apps/mobile/app/(guardian)/(tabs)/family-home.tsx` | `GuardianHomeScreen` (`packages/app/features/home/guardian-home-screen.tsx`) | family feed / landing | Home tab | single column | populated (fixture children/action/upcoming); no loading/error | fixture-only | keep, replace `ParentHomeContent` fixtures with live queries | no paywall/price copy |
| guardian | `/(guardian)/(tabs)/reports` — `apps/mobile/app/(guardian)/(tabs)/reports.tsx` | `ReportsPaneScreen` (`packages/app/features/summary/reports-pane-content.tsx`) | view progress and evidence | Reports tab | **AdaptivePanes** list → detail on expanded widths, compact navigates to `/(guardian)/reports/[sessionId]` | loading, empty, populated (uses `useGuardianReports` live query) | partial | keep; detail pane works, phone detail route exists | guardian can see child transcripts through reports |
| guardian | `/(guardian)/reports/[sessionId]` — `apps/mobile/app/(guardian)/reports/[sessionId].tsx` | `SessionReportScreen` (`packages/app/features/summary/report-content.tsx`) | read one session report | phone detail from reports list | same content rendered inside `ReportsPaneScreen` detail on tablet | populated; no loading shown in route file | partial | keep | same report view for child evidence |
| guardian | `/(guardian)/(tabs)/alerts` — `apps/mobile/app/(guardian)/(tabs)/alerts.tsx` | `NotificationsScreen` (`packages/app/features/notifications/screen.native.tsx`) | view notifications / incidents | Alerts tab | single column | populated, empty (no notifications today/earlier); no loading/error | partial | keep, wire to real notification/inbox API | serious incidents get their own tab per doc 36 §3.2 |
| guardian | `/(guardian)/(tabs)/family` — `apps/mobile/app/(guardian)/(tabs)/family.tsx` | `SettingsScreen` (re-used as Family) | manage children and permissions | Family tab | single column | populated; local toggle states | partial | **move / split** — the name "Family" is wired to `SettingsScreen` rather than family management | needs a real family/children management screen (S14/S21) |
| guardian | `/(guardian)/ai-activity` — `apps/mobile/app/(guardian)/ai-activity.tsx` | `AiActivityScreen` (`packages/app/features/ai-activity/ai-activity-content.tsx`) | manage AI permissions / view what Natalie knows | stack push from family home | single column | populated (fixtures); `SafetySection` loads safety on mount; no error shown | fixture-only | keep, replace `CHILDREN`/`CONSENTS`/`OBSERVATIONS` with live data | consent switches explain effect inline; no dark patterns |
| guardian | `/(guardian)/family-calendar` — `apps/mobile/app/(guardian)/family-calendar.tsx` | `FamilyCalendarScreen` (`packages/app/features/family-calendar/family-calendar-content.tsx`) | view assignments and due work / family schedule | stack push from family home | single column | populated, empty (no events); no loading/error | fixture-only | keep, wire `FAMILY_DAYS` to real events | child chips filter events |
| guardian | `/(guardian)/memory` — `apps/mobile/app/(guardian)/memory.tsx` | `MemoryScreen` (`packages/app/features/memory/memory-content.tsx`) | view/erase child memory | stack push from AI activity | single column | populated, empty, `eraseError` shown, confirmation dialogs | partial | keep, wire `useMemoryStore` to live S27 service | radical transparency; delete is one tap per line; cascade counts before confirm |
| tutor / teacher | `/(tutor)/(tabs)/tutor-today` — `apps/mobile/app/(tutor)/(tabs)/tutor-today.tsx` | `TutorTodayScreen` (`packages/app/features/home/tutor-today-screen.tsx`) | find/book/join/manage human tutor session (landing) | Today tab | single column | populated (fixture sessions); "Start session" and "Prep" actions are no-ops (`/* Wave 3 */`) | partial | keep, wire session start / room join | same shell for `tutor` and `teacher` |
| tutor / teacher | `/(tutor)/(tabs)/session-prep` — `apps/mobile/app/(tutor)/(tabs)/session-prep.tsx` | `SessionPrepScreen` (`packages/app/features/session-prep/session-prep-content.tsx`) | prepare for a human session | Learners tab (label is "Learners") | single column | populated (fixture `SESSION_PREP`); "Generate session plan" no-op | fixture-only | keep, wire to learner model + plan generator | Cool dial surface |
| tutor / teacher | `/(tutor)/(tabs)/notes` — `apps/mobile/app/(tutor)/(tabs)/notes.tsx` | `SummaryQueuePaneScreen` (`packages/app/features/summary/draft-queue-pane-content.tsx`) | review/approve session notes | Notes tab | **AdaptivePanes** queue → draft detail on expanded; compact shows `SummaryQueueScreen` alone | loading, empty, error, populated, success (`act` mutation) | partial | keep, the pane system is implemented | coach mark for tutor notes contextual at first visit |
| tutor / teacher | `/(tutor)/(tabs)/tutor-profile` — `apps/mobile/app/(tutor)/(tabs)/tutor-profile.tsx` | `ProfileScreen` (shared) | profile, role switch | You tab | single column | populated | partial | keep | `ContextSwitcher` available |
| org owner | `/(org)/(tabs)/overview` — `apps/mobile/app/(org)/(tabs)/overview.tsx` | `OpsScreen` (`packages/app/features/ops/screen.shared.tsx`) | operate scheduling/attendance/messages/incidents/billing/staff | Overview tab | `DashboardShell` sidebar collapses; no split view per doc 37 §3.3 | loading, empty (example leads), populated, error (`writeError`); no offline | partial | keep, but phone chrome may be heavy; reduce for companion | `owner` guard only; staff/scheduler has no `RoleKind` |
| org owner | `/(org)/(tabs)/schedule` — `apps/mobile/app/(org)/(tabs)/schedule.tsx` | `ScheduleScreen` (`packages/app/features/schedule/screen.tsx`) | operate scheduling | Schedule tab | single column in tab, booking sheet at root | populated (demo data); no loading/error | fixture-only | keep, replace `DEMO_DAY` with real schedule query; wire `BookingForm` | `BookingSheet` mounted in root `_layout.tsx` |
| org owner | `/(org)/(tabs)/inbox` — `apps/mobile/app/(org)/(tabs)/inbox.tsx` | `NotificationsScreen` (shared) | messages / alerts | Inbox tab | single column | populated, empty | partial | keep, wire org-specific notifications | not to be confused with safety queue |
| org owner | `/(org)/(tabs)/safety` — `apps/mobile/app/(org)/(tabs)/safety.tsx` | `SafetyQueueScreen` (`packages/app/features/safety/screen.native.tsx`) | view incidents / safety queue | Safety tab | single column | loading, empty, populated, error, permission-denied (`denied` card) | partial | keep, read-only triage on phone; assignment stays web | no tab badge (doc 36 §3.4) |

### Teacher, business, school, and district surfaces

- `teacher` is not a separate mobile shell; it folds into the `tutor` shell (`apps/mobile/app/(tutor)/_layout.tsx:14`). A `TeacherOnboardingContent` exists (`packages/app/features/onboarding/teacher/teacher-onboarding-content.tsx`) but there is no `(teacher)` route group in `apps/mobile/app`.
- `owner` is the only org role with a shell; `tutoring-business staff/scheduler`, `school admin`, and `district admin` are **not represented as `RoleKind` values** in `packages/app/providers/session/types.ts` and have no mobile shell routes.
- The `district` surface is web-only per doc 36 §3.5 (Outcomes, Schools, Educators, Compliance) and does not exist in `apps/mobile/app`.

---

## 4. Role × task coverage map

| Role | begin/resume learning | upload/capture homework | start AI tutor session | find/book/join/manage human tutor session | view assignments and due work | view progress and evidence | manage children and permissions | teach/manage classes and learners | operate scheduling/attendance/messages/incidents/billing/staff | view school/district outcomes and interventions |
|---|---|---|---|---|---|---|---|---|---|---|
| **Learner K–2** | Supported — `/(learner)/(tabs)/today` hub | Supported — `/(learner)/(tabs)/capture` + hub Snap | Supported — `/(learner)/tutor` + hub | Missing | Partial — `/(learner)/(tabs)/stuff` only; `/(learner)/plan` reachable but not in K–2 tab bar | Missing (not in K–2 tab bar) | Missing | Missing | Missing | Missing |
| **Learner 3–5** | Supported — `/(learner)/(tabs)/today` | Supported — `/(learner)/(tabs)/capture` | Supported — `/(learner)/tutor` | Missing | Partial — `/(learner)/plan` (not a tab) | Partial — `/(learner)/(tabs)/progress` (not a tab) | Missing | Missing | Missing | Missing |
| **Learner 6–8 / 9–12** | Supported — `/(learner)/(tabs)/today` resume-first | Supported — `/(learner)/(tabs)/capture` | Supported — `/(learner)/tutor` | Missing | Partial — `/(learner)/plan` | Partial — `/(learner)/(tabs)/progress` | Missing | Missing | Missing | Missing |
| **Parent / guardian** | Missing (cannot start learning) | Missing (guardian does not capture) | Missing | Partial — `/(guardian)/family-calendar` shows schedule; no booking flow | Partial — `/(guardian)/family-calendar`, `/(guardian)/(tabs)/family-home` upcoming | Supported — `/(guardian)/(tabs)/reports` + `/(guardian)/reports/[sessionId]` | Partial — `/(guardian)/(tabs)/family` (re-used `SettingsScreen`), `/(guardian)/ai-activity`, `/(guardian)/memory`; no real child CRUD UI yet | Missing | Missing | Missing |
| **Human tutor** | Missing | Missing | Missing | Partial — `/(tutor)/(tabs)/tutor-today` (list), `/(tutor)/(tabs)/session-prep`; start/join not wired | Missing | Partial — `/(tutor)/(tabs)/session-prep` shows mastery/misconceptions | Missing | Missing | Missing | Missing |
| **Classroom teacher** | Missing | Missing | Missing | Missing | Missing | Missing | Missing | Partial — `TeacherOnboardingContent` exists in `packages/app/features/onboarding/teacher`; **no `(teacher)` shell in `apps/mobile/app`** | Missing | Missing |
| **Tutoring-business owner** | Missing | Missing | Missing | Partial — `/(org)/(tabs)/schedule` (demo) + `BookingSheet` at root | Partial — `/(org)/(tabs)/schedule` | Partial — `/(org)/(tabs)/overview` stats | Missing | Missing | Partial — `/(org)/(tabs)/overview` (leads/revenue/sessions), `/(org)/(tabs)/schedule` (demo), `/(org)/(tabs)/inbox`, `/(org)/(tabs)/safety` | Missing |
| **Tutoring-business staff / scheduler** | Missing | Missing | Missing | Missing | Missing | Missing | Missing | Missing | Missing — no `RoleKind` or shell exists | Missing |
| **School admin** | Missing | Missing | Missing | Missing | Missing | Missing | Missing | Missing | Missing — no shell exists | Missing |
| **District admin** | Missing | Missing | Missing | Missing | Missing | Missing | Missing | Missing | Missing — no shell exists | Missing — doc 36 §3.5 web-only, not in mobile |

---

## 5. Findings and next-step recommendations

Ordered by severity / impact on shipping the mobile/tablet UX architecture.

1. **Missing public auth front door (highest severity)** — `apps/mobile/app` has no `(public)` group for `Welcome`, `Log in`, `Create account`, `Verify`, `Forgot/Reset`, `Enter code`, `Invite` per `docs/38-front-door-and-flow.md` §2. The only non-shell routes are `/onboarding`, `/handoff`, `/settings`, and `/editor-settings`. The dispatcher works for an already-signed-in session but a cold launch has no auth screens.
   - **Action:** implement `(public)/_layout.tsx` and the FD-01..FD-09 screens, guarding them with `status === 'anon'`.

2. **Onboarding flows are persona pickers, not per-role first-run sequences** — `OnboardingContent` only picks a persona and consents. The per-role stores and components (`guardian/`, `learner/`, `tutor/`, `business/`, `teacher/`) exist but are not wired to `OnboardingFlowScreen` for all roles, and the handoff client short-circuits in mock mode (`handoff.client.ts:97`).
   - **Action:** wire `OnboardingFlowScreen` to the five `ONBOARDING_FLOWS` step stores and remove the mock-only path for release.

3. **Teacher / school / district / staff-scheduler have no mobile shells** — `RoleKind` stops at `owner`; `teacher` folds into `tutor`. The build prompt explicitly lists `Classroom teacher`, `School admin`, `District admin`, and `Tutoring-business staff/scheduler` as required roles.
   - **Action:** add `RoleKind` values for `staff`/`scheduler`/`school_admin`/`district_admin`, create shell groups, or document which existing shell each maps into before implementation.

4. **Org companion tabs are web-first and overload the phone** — `/(org)/(tabs)/overview` renders `OpsScreen` with a `DashboardShell` sidebar and a full CRM `OpsDashboardContent` including `DataTable`, `TrendLine`, and lead pipeline. This is likely too dense for a phone companion and is not what doc 36 §3.4 describes (Overview · Schedule · Inbox · Safety).
   - **Action:** split the org **companion** mobile Overview into a lighter "today's exceptions" surface; keep the full CRM for web/admin.

5. **Guardian "Family" tab points at `SettingsScreen`** — `/(guardian)/(tabs)/family.tsx` re-exports `SettingsScreen`, which is a generic preferences surface. It does not manage children or permissions.
   - **Action:** create a `FamilyContent` feature for child/permissions management and route the Family tab to it.

6. **Human tutor session find/book/join/manage is largely no-op** — `tutor-today-content.tsx:53-63` "Start session" and `session-prep-content.tsx:73-74` "Generate session plan" are stubbed. There is no booking/joining flow for families or tutors.
   - **Action:** wire `tutor-today` start actions to the session room, and complete `session-prep` plan generation.

7. **Most home/feed/plan/calendar/progress surfaces are still fixture-driven** — `ParentHomeContent`, `LearnerHubContent`, `StudentHomeContent`, `PlanContent`, `FamilyCalendarContent`, `TutorTodayContent`, `ExploreContent` use local static data rather than live queries. This is expected for Wave 2 but blocks production.
   - **Action:** replace fixture imports with the appropriate live service hooks (`useAppSession`-scoped) before the release.

8. **AdaptivePanes are only used for two screens** — Guardian `ReportsPaneScreen` and tutor `SummaryQueuePaneScreen` are the only tablet dual-pane surfaces. `TwoPaneShell` is not used by any mobile auth route yet.
   - **Action:** use `TwoPaneShell` for the public auth screens and expand `AdaptivePanes` to `Learners | detail` for tutors if needed; keep learner screens single-pane.

9. **No explicit offline state for most surfaces** — Only `TutorScreen` (`tutor-screen.tsx:83-98`) and `IncidentQueueContent`/`SummaryQueueScreen`/`OpsDashboardContent` handle error/loading. Most screens will show stale or blank data when offline.
   - **Action:** add `Query` error/offline wrappers and `EmptyState` for every shell tab.

10. **Child-safety a11y review needed for the capture/tutor hand-off** — `CaptureScreen` already hides camera if handler missing, but the tutor `TutorStage` fallback for `problem == null` only prints text. K–2 hub targets use `min-h-target-young` and `aria-label`; verify that every learner tab is reachable with screen readers and that no paywall/upgrade prompt can render on a learner surface.
    - **Action:** run an accessibility pass on `(learner)` routes and add `VoiceOver/TalkBack` labels to the `Snap` and `Tutor` flows.

### Recommended implementation sequence

1. **Public auth front door** `(public)` routes + live `AuthPort` double.
2. **Per-role onboarding sequences** `OnboardingFlowScreen` wiring for all five flows.
3. **Role kind + shell expansion** decide whether `teacher`/`staff`/`school`/`district` get new shells or fold into `tutor`/`org`; update `packages/app/providers/session/types.ts` and `shellForRole`.
4. **Data replacement** move `home`, `plan`, `calendar`, `tutor-today`, `explore` off fixtures onto live queries.
5. **Family tab + guardian management** build the real Family screen and child/permissions surfaces.
6. **Tutor session operations** wire `Start session`, `Generate session plan`, and human-tutor booking.
7. **Org phone companion** create a lean `Overview` distinct from the web CRM.
8. **Adaptive pane / auth dual-pane** adopt `TwoPaneShell` for auth and verify tablet `AdaptivePanes`.
9. **Offline/error/empty states** wrap every shell tab.
10. **A11y / child-safety audit** run on learner paths before release.
