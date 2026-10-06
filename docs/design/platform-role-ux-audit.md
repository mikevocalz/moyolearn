# Platform Role UX Audit

SOT: role-to-experience inventory, mobile + web
SOT-KEYWORDS: platform audit role route experience mobile web

This audit inventories the current route-to-experience mapping for the Moyo universal app (Expo + Next.js App Router). It does not modify code; all facts below were verified against the working tree.

---

## 1. Repository facts verified

### 1.1 Mobile `apps/mobile/app` route groups and shells

- Route group folders: `(learner)`, `(guardian)`, `(tutor)`, `(org)`.
- `apps/mobile/app/index.tsx:30-52` is the dispatcher. It resolves `bootRole` from `resolveBootRole(session, getLastShellRole())`, swaps `activeContext` in an effect, and redirects to `SHELL_ROOTS[shell]`.
- `apps/mobile/app/_layout.tsx:27-74` mounts providers (`SessionProvider`, `AppQueryProvider`, `BottomSheetModalProvider`, `BookingSheet`, `AttachSheet`, `AudioRecorderSheet`, `VideoNoteSheet`, `UploadQueueProvider`, `UrlSheet`, `Toaster`).
- `apps/mobile/app/+not-found.tsx:11-13` silently redirects to `/` for role-mismatched deep links (doc 36 §4.4).

### 1.2 Web `apps/web/app` Next.js App Router route groups

- `(site)` — public + authenticated role pages. `apps/web/app/(site)/layout.tsx:19-40` wraps `SiteHeader`, `SiteFooter`, `SessionProvider`, `AppQueryProvider`.
- `(auth)` — `/login`, `/login/[org]`, `/onboarding`, `/onboarding/[flow]`, `/handoff`. No `SiteHeader`/`SiteFooter` (`apps/web/app/(auth)/layout.tsx:13-28`).
- `(session)` — `/tutor` live session. Chrome-free (`apps/web/app/(session)/layout.tsx:7-29`).
- `(share)` — `/share/report/[token]` tokened teacher view. No auth providers (`apps/web/app/(share)/layout.tsx:6-22`).
- `(ops)` — `/ops` business dashboard. Own root layout, no `SiteHeader`/`SiteFooter` (`apps/web/app/(ops)/layout.tsx:7-39`).
- `(payload)` — Payload admin catch-all at `/admin/[[...segments]]` and `/payload-api`.

### 1.3 `packages/app/features` universal screen organization

- Solito pattern: each feature has `screen.tsx` (anchor), `screen.native.tsx`, `screen.web.tsx`.
- Shared business logic lives in `.data.ts`, `.store.ts`, `.service.ts` files in the same feature folder.
- Barrel re-exports in `packages/app/index.ts:7-354`.
- Meaningful universal screens: `home`, `explore`, `capture`, `tutor`, `progress`, `practice`, `plan`, `schedule`, `session-prep`, `notifications`, `settings`, `profile`, `ai-activity`, `memory`, `family-calendar`, `reports`, `report`, `summary/draft-queue`, `onboarding`, `safety`, `ops`.

### 1.4 `packages/ui` `AdaptivePanes` / `TwoPaneShell` / `SplitView` status

- `TwoPaneShell` lives in `packages/ui/TwoPaneShell.tsx:142-186` and is the auth/marketing split shell (login/onboarding). It is layout-only, not navigation.
- `AdaptivePanes` is the shared list-detail navigator in `packages/ui/adaptive-panes/index.tsx:72-254`. It supports one or two columns plus an inspector drawer. It is exported from `packages/ui/index.ts:118-123`.
- `SplitView` is not directly used; `AdaptivePanes` replaced the former `expo-router` `unstable-split-view` because it is still alpha (`packages/ui/adaptive-panes/index.tsx:3-12`).
- `useAdaptivePaneSelection` is null-safe outside a host (`packages/app/features/summary/reports-content.tsx:45-47`).

### 1.5 Onboarding, capture, upload, and safety infrastructure

- Onboarding: `packages/app/features/onboarding` with flows for `learner`, `guardian`, `tutor`, `teacher`, `business`, plus consent and handoff code redemption.
- Capture: `packages/app/features/capture` with photo, file, text, voice entry modes, age-band labels, OCR review, privacy strip EXIF, and `capture.store.ts`.
- Upload: `packages/app/features/media` with TUS/Bunny upload, queued uploader, `UploadQueueProvider`, voice/video recording, and presign rules.
- Safety: `packages/app/features/safety` with incident queue (`SafetyQueueScreen`) and safety-status service; `packages/safety` domain also exists.

---

## 2. Route-to-experience inventory

| role/permission | mobile route + source component | web route + source component | intended user job | current phone navigation entry | current tablet navigation / pane behavior | current web navigation / layout | state coverage | production status | exact action | a11y / child-safety concerns |
|-----------------|--------------------------------|------------------------------|-------------------|-------------------------------|------------------------------------------|--------------------------------|----------------|-------------------|--------------|------------------------------|
| `anon` | `app/onboarding/index.tsx` → `OnboardingScreen` (`packages/app/features/onboarding/screen.tsx`) | `(auth)/onboarding/page.tsx` → `OnboardingScreen` (`packages/app/features/onboarding/screen.tsx`) | Begin account creation / role selection | None (pre-auth) | Same single-column onboarding | `(auth)` layout, no site chrome | loading, empty, error | partial | **complete** real role gating | Public surface; no child-safety risk, but must not leak profile data |
| `anon` | `app/handoff.tsx` → `HandoffRedeemContent` | `(auth)/handoff/page.tsx` → `HandoffRedeemContent` | Redeem a learner handoff code | Modal / front-door route | Same | `(auth)` layout, no chrome | loading, success, error | partial | **polish** error and offline states | Handoff code must not be guessable; redeem flow verified before session creation |
| `anon` | `app/onboarding/[flow].tsx` → `OnboardingFlowScreen` | `(auth)/onboarding/[flow]/page.tsx` → `OnboardingFlowScreen` | Role-specific onboarding (learner, guardian, tutor, teacher, business) | Stack within onboarding | Same | `(auth)` layout | loading, populated, error | partial | **complete** missing `staff`/`admin` flows | Consent and KBA are present; verify COPPA inputs |
| `learner` (all bands) | `(learner)/(tabs)/today.tsx` → `LearnerTodayScreen` (`packages/app/features/home/learner-today-screen.tsx`) | `(site)/page.tsx` → `HomeScreen` → `HomeContent` (`packages/app/features/home/screen.web.tsx`) | Begin / resume learning; see today’s plan | `Today` tab (label varies by band) | Same tabs, no split view | `SiteHeader` role nav `Today` | loading, populated, empty | partial | **polish** unify landing copy | Learner surface: no paywalls, no marketing in content |
| `learner` K–2 / 3–5 / 6–12 | `(learner)/(tabs)/subjects.tsx` → `ExploreScreen` | `(site)/explore/page.tsx` → `ExploreScreen` (`packages/app/features/explore/screen.tsx`) | Browse subjects and assignments | `Subjects` tab (off-band for K–2) | Same | `SiteHeader` nav `Subjects` | loading, populated, empty | partial | **polish** age-band gating | K–2 tab is hidden but web route is reachable; needs 404/permission fallback |
| `learner` (all bands) | `(learner)/(tabs)/capture.tsx` → `CaptureScreen` | `(site)/capture/page.tsx` → `CaptureScreen` (`packages/app/features/capture/capture-screen.tsx`) | Upload / capture homework | `Snap` tab (raised center) | Same, full-screen camera | `SiteHeader` nav `Snap` | loading, populated, error, success | partial | **polish** offline queue and EXIF review | Privacy strip in `privacy-process.ts`; photo capture needs child-guard consent on first use |
| `learner` (all bands) | `(learner)/tutor.tsx` → `TutorScreen` | `(session)/tutor/page.tsx` → `TutorScreen` (`packages/app/features/tutor/tutor-screen.tsx`) | Start AI tutor on captured problem | Stack push from capture/today | Same, immersive | `(session)` chrome-free layout | loading, populated, error, success | partial | **complete** resume and offline turns | AI safety plane must gate every turn; no direct model calls from feature |
| `learner` (all bands) | `(learner)/(tabs)/stuff.tsx` → `PracticeScreen` (K–2 label) | `(site)/practice/page.tsx` → `PracticeScreen` | Practice / review | `My Stuff` tab for K–2 | Same | `SiteHeader` nav not present by default for `learner`; via `/practice`? | loading, populated, empty | partial | **polish** K–2 content vs. teen content | Same practice engine across bands; ensure scaffolding matches grade |
| `learner` 6–12 | `(learner)/(tabs)/progress.tsx` → `ProgressScreen` | `(site)/progress/page.tsx` → `ProgressScreen` (`packages/app/features/progress/progress-screen.tsx`) | View progress / mastery | `Progress` tab (off-band for K–2/3–5) | Same | `SiteHeader` nav `Progress` | loading, populated, empty, error | partial | **complete** live data hook (`useProgress` is wired; `SEED` is fixture only in stories) | Progress visible to learner only; guardian has reports instead |
| `learner` 6–12 | `(learner)/plan.tsx` → `PlanScreen` | `(site)/plan/page.tsx` → `PlanScreen` (`packages/app/features/plan/screen.tsx`) | View / manage learning plan | Stack from `Today` | Same | `SiteHeader` nav not directly exposed for learner | loading, populated, empty | partial | **polish** navigation entry | Plan surface exists but no web top-nav entry for learner |
| `learner` | `(learner)/(tabs)/you.tsx` → `ProfileScreen` | `(site)/profile/page.tsx` → `ProfileScreen` (`packages/app/features/profile/screen.tsx`) | Manage profile, switch hats | `You` tab | Same | Avatar slot in `SiteHeader` links to `/profile` | loading, populated, empty, error | partial | **polish** role switcher visibility | Profile must expose role switcher (doc 36 §4.3) |
| `guardian` | `(guardian)/(tabs)/family-home.tsx` → `GuardianHomeScreen` | `(site)/page.tsx` → `HomeScreen` → `ParentHomeContent` | Family home / quick status | `Home` tab | Same | `SiteHeader` nav `Home` | loading, populated, empty | partial | **polish** home feed | Guardian surface; no child-facing content |
| `guardian` | `(guardian)/(tabs)/reports.tsx` → `ReportsPaneScreen` | `(site)/reports/page.tsx` → `ReportsScreen`; `(site)/reports/[sessionId]/page.tsx` → `SessionReportScreen` | View session reports | `Reports` tab with AdaptivePanes list→detail | Tablet: `ReportsScreen` + `SessionReportScreen` side by side via `AdaptivePanes` (`packages/app/features/summary/reports-pane-content.tsx`) | `SiteHeader` nav `Reports`; separate detail route on web | loading, empty, populated, error | partial | **polish** web detail-in-pane | Shared report token is `(share)/share/report/[token]`; keep tokened view chrome-free |
| `guardian` | `(guardian)/(tabs)/alerts.tsx` → `NotificationsScreen` | `(site)/notifications/page.tsx` → `NotificationsScreen` (`packages/app/features/notifications/screen.tsx`) | View alerts and incidents | `Alerts` tab | Same | `SiteHeader` nav `Alerts` (label `Notifications` for marketing) | loading, empty, populated, error | partial | **polish** label alignment (`Alerts` vs `Notifications`) | Incident content must not be visible to learners |
| `guardian` | `(guardian)/(tabs)/family.tsx` → `SettingsScreen` | `(site)/settings/page.tsx` → `SettingsScreen` (`packages/app/features/settings/screen.tsx`) | Manage children / permissions / plan | `Family` tab | Same | `SiteHeader` nav `Family` (points `/settings`) | loading, populated, empty | partial | **move** to a dedicated `FamilyScreen`; `Settings` is not `Family` | Children/permissions need their own screen; current tab name is misleading |
| `guardian` | `(guardian)/memory.tsx` → `MemoryScreen` | `(site)/memory/page.tsx` → `MemoryScreen` (`packages/app/features/memory/screen.tsx`) | View memory & data | Stack from `Family`? (not in tabs) | Same, stack | `SiteHeader` nav not directly present | loading, populated, empty, error | partial | **polish** add nav entry | Memory/erasure UI; ensure S27 erasure controls per child |
| `guardian` | `(guardian)/ai-activity.tsx` → `AiActivityScreen` | `(site)/ai-activity/page.tsx` → `AiActivityScreen` (`packages/app/features/ai-activity/screen.tsx`) | Review AI activity and safety | Stack | Same | `SiteHeader` nav not directly present | loading, populated, empty, error | partial | **polish** add nav entry | Child-safety: activity log must be guardian-facing only |
| `guardian` | `(guardian)/family-calendar.tsx` → `FamilyCalendarScreen` | `(site)/family-calendar/page.tsx` → `FamilyCalendarScreen` (`packages/app/features/family-calendar/screen.tsx`) | View family calendar | Stack | Same | `SiteHeader` nav not directly present | loading, populated, empty, error | partial | **polish** add nav entry | Shared family schedule; ensure child privacy of other members |
| `guardian` | `app/settings.tsx` → `SettingsScreen` | `(site)/settings/page.tsx` → `SettingsScreen` | Preferences, account, billing | `/settings` route from profile | Same | `SiteHeader` nav `Family` → `/settings` | loading, populated, empty, error | partial | **keep** but reconcile with `Family` tab | Local prefs only on mobile; ensure no server-sensitive forms leak to anon |
| `tutor` / `teacher` | `(tutor)/(tabs)/tutor-today.tsx` → `TutorTodayScreen` | `(site)/page.tsx` → `HomeScreen` → `TutorTodayContent` (`packages/app/features/home/tutor-today-content.tsx`) | Today’s sessions / tasks | `Today` tab | Same | `SiteHeader` nav `Today` | loading, populated, empty, error | partial | **polish** split teacher vs. tutor | `teacher` and `tutor` share the tutor shell (`packages/app/providers/session/shell.ts:19-26`) |
| `tutor` / `teacher` | `(tutor)/(tabs)/session-prep.tsx` → `SessionPrepScreen` | `(site)/session-prep/page.tsx` → `SessionPrepScreen` (`packages/app/features/session-prep/screen.tsx`) | Teach / manage classes; prep per learner | `Learners` tab | Same | `SiteHeader` nav `Learners` | loading, populated, empty, error | partial | **complete** real learner roster data | Session-prep reads learner observations; guard by `teacher`/`tutor` role |
| `tutor` / `teacher` | `(tutor)/(tabs)/notes.tsx` → `SummaryQueuePaneScreen` | `(site)/report-queue/page.tsx` → `SummaryQueueScreen` | Review draft session summaries | `Notes` tab, AdaptivePanes list→detail | Tablet: `SummaryQueueScreen` + report detail side by side | `SiteHeader` nav `Notes` | loading, populated, empty, error | partial | **polish** role gate (staff `write` capability on server) | Draft suppression requires logged reason; no silent delete |
| `tutor` / `teacher` | `(tutor)/(tabs)/tutor-profile.tsx` → `ProfileScreen` | `(site)/profile/page.tsx` → `ProfileScreen` | Tutor profile / role switcher | `You` tab | Same | Avatar slot in `SiteHeader` | loading, populated, empty, error | partial | **keep** | Credentials and availability live here |
| `tutor` / `teacher` | `app/editor-settings/index.tsx` → `EditorSettingsScreen` | n/a (modal on web?) | Rich-note editor settings | Stack | Same | n/a | populated | partial | **polish** web equivalent | Editor drag-to-reorder; ensure touch targets for children are not exposed here |
| `owner` (org) | `(org)/(tabs)/overview.tsx` → `OpsScreen` | `(ops)/ops/page.tsx` → `OpsScreen` (`packages/app/features/ops/screen.shared.tsx`) | Operate business / school; pipeline | `Overview` tab | Same | `SiteHeader` nav `Overview` (when `owner`) | loading, populated, empty, error | partial | **complete** staff/scheduler/school admin shells | Only `owner` role has an org shell; `staff`/`admin` missing |
| `owner` (org) | `(org)/(tabs)/schedule.tsx` → `ScheduleScreen` | `(site)/schedule/page.tsx` → `ScheduleScreen` (`packages/app/features/schedule/screen.tsx`) | View / manage schedule | `Schedule` tab | Same | `SiteHeader` nav `Schedule` | loading, populated, empty (fixtures) | partial | **complete** replace `DEMO_DAY` with real data (`packages/app/features/schedule/screen.tsx:31`) | Booking creation exists; ensure age-appropriate view for learners |
| `owner` (org) | `(org)/(tabs)/inbox.tsx` | n/a? (not found in mobile tree) | Staff inbox | `Inbox` tab | Same | n/a | n/a | **missing** | **complete** | No source file for `inbox.tsx` (`ls` did not list it; route is declared but file is absent) |
| `owner` (org) | `(org)/(tabs)/safety.tsx` → `SafetyQueueScreen` | n/a? (ops?) | Safety triage queue | `Safety` tab | Same | n/a | loading, populated, empty, error | partial | **complete** web ops safety view | Incident queue for owners; unassigned S4 is the only interrupt (org tabs layout comment) |
| `owner` (org) | `n/a` | `(site)/schedule/page.tsx` → `ScheduleScreen` | Find / book human tutor | Web nav `Schedule` for `owner` | n/a | `SiteHeader` nav `Schedule` | loading, populated, empty | partial | **complete** booking flow | Schedule is shared across roles with demo data |
| `teacher` (tokened) | n/a | `(share)/share/report/[token]/page.tsx` → `ShareReportContent` | View shared session report | n/a | n/a | `(share)` layout, no providers, robots `noindex` | loaded, not-found, error | partial | **keep** | Teacher has no session; token-based access only |
| `payload admin` | n/a | `(payload)/admin/[[...segments]]/page.tsx` + `payload-api` | CMS / back-office | n/a | n/a | Payload root layout, custom fonts | populated | production-ready | **keep** | Admin-only; gate via Payload access control |

---

## 3. Role × task coverage map

Legend: `●` full / `◐` partial / `○` missing / `×` not applicable.

| job | Learner K–2 | Learner 3–5 | Learner 6–12 | Parent / guardian | Human tutor | Classroom teacher | Tutoring-business owner | Tutoring-business staff/scheduler | School admin | District admin |
|-----|-------------|-------------|--------------|-------------------|-------------|-------------------|--------------------------|------------------------------------|---------------|----------------|
| 1. Begin / resume learning | ● (Today/Snap) | ● (Today/Subjects/Snap) | ● (Home/Subjects/Snap/Progress) | × | × | × | × | × | × | × |
| 2. Upload / capture | ● (Snap) | ● (Snap) | ● (Snap) | ◐ (can view captured) | × | × | × | × | × | × |
| 3. Start AI tutor | ● (tutor stack) | ● (tutor stack) | ● (tutor stack) | × | × | × | × | × | × | × |
| 4. Find / book human tutor | ◐ (schedule via `/schedule`) | ◐ (schedule via `/schedule`) | ◐ (schedule via `/schedule`) | ◐ (`/schedule`) | ● (`/schedule`) | ◐ (`/schedule`) | ● (`/schedule`, booking form) | ○ | ○ | ○ |
| 5. View assignments | ◐ (Explore) | ◐ (Explore) | ◐ (Explore) | × | ◐ (Session-prep) | ◐ (Session-prep) | × | × | × | × |
| 6. View progress | ○ (off-band) | ○ (off-band) | ● (Progress tab) | ● (Reports) | ◐ (session-prep notes) | ◐ (shared reports) | ● (Ops dashboard) | ○ | ○ | ○ |
| 7. Manage children / permissions | × | × | × | ◐ (Family tab → Settings) | × | × | × | × | × | × |
| 8. Teach / manage classes | × | × | × | × | ● (Session-prep/Notes) | ● (Session-prep + share) | ◐ (Overview/Schedule) | ○ | ○ | ○ |
| 9. Operate business / school | × | × | × | × | × | × | ◐ (`/ops` owner only) | ○ | ○ | ○ |
| 10. View district / school outcomes | × | × | × | × | × | ◐ (share token) | ◐ (Ops reports) | ○ | ○ | ○ |

Notes:

- `packages/app/providers/session/types.ts:7-9` defines only `RoleKind = 'learner' | 'guardian' | 'tutor' | 'teacher' | 'owner'`. `staff`, `scheduler`, `admin`, and `district` do not exist as active context kinds.
- Age bands are `gradeBand` (`young`/`child`/`teen`/`adult`) inside the `learner` role, not distinct roles.
- `teacher` and `tutor` currently share the same shell.

---

## 4. Findings and recommendations

### 4.1 Top issues (ordered by impact)

1. **SiteFooter on authenticated `(site)` surfaces exposes dev/admin links.** `apps/web/components/site/SiteFooter.tsx:9-13` lists `Storybook`, `Payload admin`, `README`. These appear under learner/guardian/tutor pages and are a trust and child-safety issue.
2. **Role model is missing staff, scheduler, school, and district roles.** `packages/app/providers/session/types.ts:7-9` only has five `RoleKind`s. The 10-role coverage map cannot be implemented without extending `RoleKind` and membership resolution.
3. **`(org)/(tabs)/inbox.tsx` is declared in the tab layout but the file does not exist.** `apps/mobile/app/(org)/(tabs)/_layout.tsx:38-41` registers `inbox`, but `ls` found no `inbox.tsx` in that directory.
4. **`ScheduleScreen` is still using `DEMO_DAY` fixtures.** `packages/app/features/schedule/screen.tsx:31` says it renders against demo data; this makes booking and viewing real availability impossible.
5. **Guardian `Family` tab points at `SettingsScreen`.** `apps/mobile/app/(guardian)/(tabs)/family.tsx:1` imports `SettingsScreen`. The tab is named `Family` but the screen is generic settings, so the “manage children/permissions” job is not actually represented.
6. **`(ops)/ops` is the only org surface; there is no staff/scheduler/admin shell.** `packages/app/providers/session/shell.ts:17-31` maps only `owner` → `org`. Business staff and school/district admins have no navigation tree.
7. **Web reports use a separate detail route; tablet pane behavior is not exposed on web.** `apps/web/app/(site)/reports/page.tsx` uses `ReportsScreen`, and `apps/web/app/(site)/reports/[sessionId]/page.tsx` uses `SessionReportScreen`. `AdaptivePanes` is available but the web route does not use `ReportsPaneScreen`.
8. **`PracticeScreen` is the same `stuff` tab for K–2 as for older learners.** `apps/mobile/app/(learner)/(tabs)/stuff.tsx:1` uses `PracticeScreen` for `young` band. The content scaffolding may not match the K–2 age band without separate fork.
9. **`tutor` and `teacher` share one shell, but teacher needs district/school outcomes and read-only share flows that tutors do not.** `packages/app/providers/session/shell.ts:23-26` collapses them. The web nav also gives them identical items (`apps/web/components/site/nav.ts:41-52`).
10. **Web `(site)/` mixes marketing, learner, guardian, tutor, and owner pages under one layout.** `apps/web/app/(site)/layout.tsx:19-40` wraps all of them with the same `SiteHeader`/`SiteFooter`. Owner `/ops` and live session `/tutor` already broke out; more role-specific layouts may be needed.
11. **Mobile `app/settings.tsx` redirects anon to `/` but web `(site)/settings` has no equivalent anon guard in the table.** `apps/mobile/app/settings.tsx:9-10` shows the guard; web settings relies on `SessionProvider` only.
12. **`family-home` and `home` are named differently across platforms.** Mobile uses `family-home` as the guardian landing; web uses `/` with `HomeContent` picking `ParentHomeContent`. Deep links may diverge.

### 4.2 Proposed implementation sequence (vertical slices)

1. **Slice A — Authenticated chrome clean-up.** Remove dev links from `SiteFooter`; add role-specific footers or hide footer for signed-in users. (Child-safety highest.)
2. **Slice B — Family surface.** Split `Family` tab into a real `FamilyScreen`; keep `Settings` as a separate destination. (Unblocks job 7.)
3. **Slice C — Org roles and permissions.** Add `staff`, `scheduler`, `school_admin`, `district_admin` to `RoleKind` and create dedicated shells. (Unblocks jobs 8–10 for non-owners.)
4. **Slice D — Real schedule data.** Replace `DEMO_DAY` with a query and wire booking creation across web and mobile. (Unblocks job 4 for all roles.)
5. **Slice E — Reports and queue pane parity on web.** Adopt `ReportsPaneScreen` and `SummaryQueuePaneScreen` on web inside `AdaptivePanes`. (Unifies tablet/desktop UX.)
6. **Slice F — Teacher vs. tutor shell split.** Split `teacher` from `tutor` navigation and add district/school outcome views. (Unblocks job 10.)
7. **Slice G — Age-appropriate practice.** Fork `PracticeScreen` content by `gradeBand`. (Unblocks K–2 practice.)

---

## 5. Evidence checklist

- `apps/mobile/app/index.tsx:30-52` — dispatcher.
- `apps/mobile/app/_layout.tsx:27-74` — mobile provider stack.
- `apps/mobile/app/(learner)/(tabs)/_layout.tsx:22-45` — learner age-band tabs.
- `apps/mobile/app/(guardian)/(tabs)/_layout.tsx:11-16` — guardian tabs.
- `apps/mobile/app/(tutor)/(tabs)/_layout.tsx:11-16` — tutor tabs.
- `apps/mobile/app/(org)/(tabs)/_layout.tsx:16-21` — org tabs.
- `packages/app/providers/session/shell.ts:34-39` — `SHELL_ROOTS`.
- `packages/app/providers/session/types.ts:7-9` — `RoleKind` / `ActiveContextKind`.
- `apps/web/app/(site)/layout.tsx:19-40` — web site layout.
- `apps/web/app/(auth)/layout.tsx:13-28` — auth layout.
- `apps/web/app/(session)/layout.tsx:7-29` — session layout.
- `apps/web/app/(ops)/layout.tsx:7-39` — ops layout.
- `apps/web/components/site/nav.ts:27-58` — role-scoped web nav.
- `apps/web/components/site/SiteFooter.tsx:9-13` — footer dev links.
- `packages/ui/adaptive-panes/index.tsx:72-254` — `AdaptivePanes`.
- `packages/ui/TwoPaneShell.tsx:142-186` — `TwoPaneShell`.
- `packages/app/features/schedule/screen.tsx:31` — demo data note.
