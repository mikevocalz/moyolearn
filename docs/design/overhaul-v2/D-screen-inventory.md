# Overhaul v2 — Deliverable D: Unified Screen Inventory

What it is: one row per product screen — existing AND missing-but-required — across mobile (apps/mobile, 56 route files) and web (apps/web, 35 pages), unified under a single ID scheme.
Why it exists: Phase 2 screen contracts cite these IDs; nothing gets built, moved, or deleted without a row here.
Source of truth: A-repo-audit.md + C-orphans-dead-ends.md for repo state (fresh audit wins over the Aug-30 role-ux audits); docs/38-front-door-and-flow.md §3 for FD-*/PW-* (IDs reused verbatim); docs/pack/36-role-navigation-flows.md §3 for binding tab sets.
SOT-KEYWORDS: overhaul, screen-inventory, phase-1, fd, pw, tab-sets, classification

## Conventions

- **IDs:** `FD-*`/`PW-*` verbatim from doc 38 §3. Product screens: `<role>.<screen>`; band suffix only where a band variant materially differs (`learner.home.k2`).
- **Routes** are what exists today; doc-38 target routes live in the action column. MISSING = no route file/page.
- **Classification** (one per row): COMPLETE · PARTIAL · PLACEHOLDER · MISSING · DUPLICATED · DEAD-ROUTE · ORPHAN · DEAD-END · MISSING-STATE(S) · NEEDS-UX-REWORK.
- **Tenants:** `app` = consumer host (app.moyolearn.com); `org` = tutoring-business tenant; `school`/`district` = institution tenant hosts; `any` = host-independent.
- Verified against the working tree 2026-09-01 (branch `overhaul/phase1-audit`): shells are now seven (`shellForRole` in `packages/app/providers/session/shell.ts` — learner/guardian/tutor/teacher/org/school/district), `RoleKind` includes staff/school_admin/district_admin, and `ONBOARDING_FLOWS` declares S21–S28 (staff/school_admin/district_admin flows have **no content dirs** under `packages/app/features/onboarding/` — declared, unbuilt).

## Front door (FD-01 → FD-26)

Doc 38 §2's `(public)` group does not exist on mobile; auth-adjacent screens live under `/onboarding/*`. FD-10→23 ship as steps inside the per-role `/onboarding/[flow]` sequences (S21–S25), not as addressable routes — doc 38 wants per-step routes with resume-from-`onboarding.step`. Blanket action for the PARTIAL onboarding rows: split into doc-38 step routes or contract-justify the single-route sequence; wire the live `AuthPort` (release with `auth-mock` fails the release job, doc 38).

| ID | Role | Tenant | Bands | Mobile route | Web route | Purpose | Primary task | Nav entry | Class | Proposed action |
|---|---|---|---|---|---|---|---|---|---|---|
| FD-01 | all | app | all | MISSING | MISSING | Say what Moyo is; three doors | Pick Get started / Log in / I have a code | cold launch (anon) | MISSING | Build `(public)/index`; `PublicEntryContent` is exported from `packages/app/index.ts` but unrouted — evaluate as seam |
| FD-02 | adults | app, district (`/login/[org]`) | n/a | `/onboarding/sign-in` | `/login`, `/login/[org]` | Log in | Authenticate | Welcome → Log in | PARTIAL | Move mobile to `(public)/login` behind `status==='anon'` guard group |
| FD-03 | adults | app | n/a | `/onboarding` | `/onboarding` | Who's this for? (role choice) | Choose guardian/tutor/org/teacher | Get started | PARTIAL | Reshape persona picker to doc-38 signup entry; `RoleChoiceCard` is `[add]` per doc 38 §8 |
| FD-04 | adults | app | n/a | MISSING | MISSING | Create account | Email + password signup | FD-03 → | MISSING | Build `(public)/signup/account` (?role=…) |
| FD-05 | adults | app | n/a | MISSING | MISSING | Check your email (OTP) | Verify email | FD-04 → | MISSING | Build `(public)/signup/verify`; `OtpField` `[add]` |
| FD-06 | adults | app | n/a | MISSING | MISSING | Forgot password | Request reset code | FD-02 link | MISSING | Build `(public)/forgot` |
| FD-07 | adults | app | n/a | MISSING | MISSING | Reset password (3-step) | Verify code, set password | FD-06 → | MISSING | Build `(public)/reset`; Better Auth `checkVerificationOtp()` before new password |
| FD-08 | learner | app | all (single-pane at every width) | `/handoff` | `/handoff` | Learner code entry | Redeem guardian's device code | deep link `moyo://handoff?code=`; Welcome "I have a code" | PARTIAL | Kill mock short-circuit (`handoff.client.ts:97`); child never types credentials; delete dup `/onboarding/handoff` (see sys row) |
| FD-09 | tutor, teacher | app, org | n/a | MISSING | MISSING | Invite landing | Accept org/class invite | invite email link | MISSING | Build `(public)/invite/[token]` |
| FD-10 | guardian | app | n/a | `/onboarding/guardian` (step) | `/onboarding/guardian` | COPPA verifiable parental consent | Attest + consent | signup flow | PARTIAL | Per-step route; consent feature dir exists (`onboarding/consent/`) |
| FD-11 | guardian | app | n/a | `/onboarding/guardian` (step) | same | Create family | Name the family | flow | PARTIAL | Per-step route |
| FD-12 | guardian | app | n/a | `/onboarding/guardian` (step) | same | Add learner | Grade → band, optional `readsAt` | flow (?index=n repeats) | PARTIAL | Per-step route |
| FD-13 | guardian | app | n/a | `/onboarding/guardian` (step) | same | Choose plan (= PW-01) | Start trial / pick plan | flow | PARTIAL | `PaywallContent` mounted in `guardian-onboarding-content.tsx`; wire RevenueCat entitlement truth |
| FD-14 | guardian | app | n/a | `/onboarding/guardian` (step) | same | Connect a device (QR/short code) | Hand learner device off | flow | PARTIAL | Guardian side of handoff; feature dir `onboarding/handoff/` |
| FD-15 | guardian | app | n/a | `/onboarding/guardian` (step) | same | You're set | Land on family feed | flow end | PARTIAL | Per-step route |
| FD-16 | learner | app | all (single-pane) | `/onboarding/learner` (step) | same | Pick your buddy (curated avatars) | Choose avatar | post-FD-08 | PARTIAL | No upload — curated set only (doc 33) |
| FD-17 | learner | app | all (single-pane) | `/onboarding/learner` (step) | same | Natalie says hi (baked greeting) | Meet the tutor → Today | flow end | PARTIAL | One action on landing: "Snap your homework" |
| FD-18 | tutor | app, org | n/a | `/onboarding/tutor` (step) | same | Tutor profile | Fill profile | invite/FD-03 | PARTIAL | Per-step route |
| FD-19 | tutor | app, org | n/a | `/onboarding/tutor` (step) | same | Availability | Set availability grid | flow | PARTIAL | Reuses schedule grid |
| FD-20 | org | org | n/a | `/onboarding/owner` (step) | same | Business setup | Org details, Stripe Connect | FD-03 | PARTIAL | 2 TODOs live in business onboarding (`A-repo-audit` debt markers) — clear them |
| FD-21 | org | org | n/a | `/onboarding/owner` (step) | same | Invite your team | Send staff invites | flow | PARTIAL | Depends on FD-09 |
| FD-22 | org | org | n/a | `/onboarding/owner` (step) | same | Plan + payouts (= PW-01) | Pick tier, connect payouts | flow | PARTIAL | Business tiers never rendered to guardians (structural, doc 33) |
| FD-23 | teacher | school | n/a | `/onboarding/teacher` (step) | same | Set up your class | Class roster basics | FD-09 | PARTIAL | District SSO/LTI is Phase 3 |
| FD-24 | all (family devices) | app | all | MISSING | MISSING | Switch profile (sheet) | Swap active profile | Profile/You | MISSING | Build `account/switch`; `ContextSwitcher` (hidden unless ≥2 memberships) is the seam |
| FD-25 | all | any | all | MISSING | MISSING | Session ended | Re-authenticate | session expiry | MISSING | Build `account/signed-out`; needs `status: 'expired'` in session contract |
| FD-26 | adults | app | n/a | MISSING | MISSING | Delete account | Erasure cascade + confirm | Settings | MISSING | Build `account/delete`; `/api/memory/forget-all` exists, no screen; settings sign-out/delete currently unwired |

## Paywalls (PW-01 → PW-08)

Entitlement law (doc 38 §5B): screens read `entitlement.status`, never derive from purchase results. No paywall, price, or store link may ever render on a learner surface.

| ID | Role | Tenant | Bands | Mobile route | Web route | Purpose | Primary task | Nav entry | Class | Proposed action |
|---|---|---|---|---|---|---|---|---|---|---|
| PW-01 | guardian, org | app, org | n/a | = FD-13 / FD-22 | same | Entry paywall: plan + trial | Start trial | onboarding | PARTIAL | Same work as FD-13/FD-22; one surface, two mounts |
| PW-02 | guardian | app | n/a | MISSING | MISSING | Trial-ending T−3 sheet | Convert before lapse | push → sheet | MISSING | Build `(guardian)/billing/trial-ending`; `trial/convert-content.tsx` + `milestones.ts` exist unmounted |
| PW-03a | guardian | app | n/a | MISSING | MISSING | Free-limit upgrade sheet | Upgrade | limit hit (guardian device) | MISSING | Build `(guardian)/billing/upgrade` |
| PW-03b | learner | app | all | MISSING | MISSING | Free-limit stop — band copy only | Tell a grown-up / stop gracefully | limit hit (learner device) | MISSING | Build `(learner)/limit`; **no prices, no purchase controls, no store links, ever** |
| PW-04 | guardian | app | n/a | MISSING | MISSING | Trial ended / plan lapsed (shown once) | Reactivate | first launch after lapse | MISSING | Build `(guardian)/billing/lapsed` |
| PW-05 | guardian, org | app, org | n/a | MISSING | MISSING | Manage plan | Change/renew plan | Family tab / org Settings | MISSING | Build `(guardian)/settings/plan` + `(org)/settings/plan`; `PlanCard` `[add]` |
| PW-06 | guardian, org | app, org | n/a | MISSING | MISSING | Restore purchases (action + result states) | Restore | inside PW-01/PW-05 (mobile) | MISSING | Ship with PW-01/PW-05 |
| PW-07 | guardian, org | app, org | n/a | MISSING | MISSING | Cancel — what happens next | Cancel without a retention maze | PW-05 | MISSING | Build `…/settings/plan/cancel`; `paywall/cancel-content.tsx` exists unmounted |
| PW-08 | guardian, org (web) | app, org | n/a | n/a | MISSING | Web billing (Stripe) | Manage billing on web | web settings | MISSING | Build `settings/billing` page |

## Learner (Hot dial, band-adaptive)

Blocking defect for every band row: `gradeBand` is never populated under live auth (`providers/session/live.tsx:99-104`) — production children all get the teen IA.

| ID | Role | Tenant | Bands | Mobile route | Web route | Purpose | Primary task | Nav entry | Class | Proposed action |
|---|---|---|---|---|---|---|---|---|---|---|
| learner.home | learner | app | 3–5 · 6–8 · 9–12 | `/(learner)/(tabs)/today` | `/learn/today` (+ `/` dispatch) | Landing; resume-first for 6–12 | Resume where you left off | Today/Home tab | COMPLETE | Fix band population in `live.tsx`; replace remaining fixture data |
| learner.home.k2 | learner | app | K–2 only | same route, `LearnerHubContent` variant | same | Hub-and-spoke Natalie hub, voice-first, giant tiles | One tap to Snap or Natalie | Today tab (3-tab shell) | ORPHAN | Variant unreachable live (band never `'young'`); fixed by the `live.tsx` band fix — verify K–2 shell end-to-end after |
| learner.subjects | learner | app | 3–5 · 6–8 · 9–12 (K–2 `href:null`) | `/(learner)/(tabs)/subjects` | `/subjects` | Browse subjects/resources | Open a subject | Subjects tab | COMPLETE | Web URL reachable by K–2 with no fallback (C §Web) — add guard; replace fixture catalog |
| learner.capture | learner | app | all (band-scaled UI) | `/(learner)/(tabs)/capture` | `/capture` | Snap homework (product signature) | Capture → OCR → review | raised center tab, every band | PARTIAL | Route re-exports `CaptureScreen` bare so `ageBand` defaults `'teen'` on every path — one-line wrapper reads session band |
| learner.tutor | learner | app | all | `/(learner)/tutor` | `/tutor` (`(session)`, chrome-free) | AI tutoring session (Safety Plane) | Work the problem with Natalie | hub tile / post-capture | COMPLETE | Keep; offline fallback already present |
| learner.progress | learner | app | 6–8 · 9–12 (off-band `href:null`) | `/(learner)/(tabs)/progress` | `/progress` | Mastery movement + evidence | See progress | Progress tab | COMPLETE | Keep |
| learner.stuff | learner | app | K–2 · 3–5 | `/(learner)/(tabs)/stuff` | `/practice` | My Stuff / practice | Practice items | My Stuff / Me tab | COMPLETE | Keep; confirm K–2 content fork under real `'young'` band |
| learner.plan | learner | app | 6–8 · 9–12 | `/(learner)/plan` | `/plan` | Assignments and due work | See the week | "See all" from Today; **no web nav entry** | COMPLETE | Add web nav entry or contract-justify stack-only (C §Web) |
| learner.you | learner | app | 3–5 · 6–8 · 9–12 (no K–2 settings) | `/(learner)/(tabs)/you` | `/profile` | Profile + role switch | Switch profile / prefs | You/Me tab | COMPLETE | Keep; FD-24 sheet mounts from here |

## Guardian (Hot dial)

Shell-level conflict: the shipped tab set (Home · Children · Calendar · Messages · Account, `(guardian)/(tabs)/_layout.tsx`) **contradicts binding doc 36 §3.2** (Home · Reports · Alerts · Family) while its header comment claims doc-36 authority. Reconcile the guardian shell contract first; the ORPHAN/NEEDS-UX-REWORK rows below all hang off that decision. Child switching does not exist anywhere (`learnerId` never set; children hardcoded in `parent-home.data.ts`).

| ID | Role | Tenant | Bands | Mobile route | Web route | Purpose | Primary task | Nav entry | Class | Proposed action |
|---|---|---|---|---|---|---|---|---|---|---|
| guardian.home | guardian | app | n/a | `/(guardian)/(tabs)/family-home` | `/family` (+ `/` dispatch) | Family feed: one card per child + upcoming | Open the newest report | Home tab | COMPLETE | Replace `parent-home.data.ts` fixtures; add child-switcher chips (doc 36 §3.2) |
| guardian.reports | guardian | app | n/a | `/(guardian)/(tabs)/reports` | MISSING (root `/reports` is now institution-scoped and 404s on the app host — but `NAV_BY_ROLE.guardian` still points there) | Doc-34 report trail per child | Read reports | doc 36 says tab; today only a family-screen push | ORPHAN | Wire as tab per doc 36 §3.2; restore a guardian web reports list route and fix the `/reports` nav collision |
| guardian.report-detail | guardian | app | n/a | `/(guardian)/reports/[sessionId]` | `/reports/[sessionId]` | One session report (8 blocks, doc 34) | Read a report | push from list; pane detail on tablet | COMPLETE | Keep; `ReportsPaneScreen` is one of only 2 AdaptivePanes consumers |
| guardian.alerts | guardian | app | n/a | `/(guardian)/(tabs)/alerts` | `/notifications` | Incidents + acknowledgments — never under a bell | Acknowledge an incident | doc 36 says tab; today unreachable (not in ITEMS, no push) | ORPHAN | Wire as tab per doc 36 §3.2 ("serious things never hide under a bell") |
| guardian.family | guardian | app | n/a | `/(guardian)/(tabs)/family` | MISSING (web nav "Family" → `/settings`) | Children + controls: voice default, budget, `readsAt`, erasure, plan | Manage a child | Children tab | COMPLETE | `FamilyScreen` is now real (stale audits' `SettingsScreen` alias is fixed); point web Family nav at a real family page |
| guardian.calendar | guardian | app | n/a | `/(guardian)/(tabs)/calendar` | `/family-calendar` (no web nav entry) | Family schedule | See upcoming | Calendar tab | COMPLETE | Wire fixture `FAMILY_DAYS` to real events; add web nav entry or justify |
| guardian.family-calendar | guardian | app | n/a | `/(guardian)/family-calendar` | n/a | Duplicate of guardian.calendar | — | one family-screen push | DUPLICATED | Delete; repoint push to `/calendar` (C §Mobile) |
| guardian.messages | guardian | app | n/a | `/(guardian)/(tabs)/messages` | MISSING | Tab labelled Messages, renders `NotificationsScreen` — label lies; no messaging surface exists anywhere | — | Messages tab | NEEDS-UX-REWORK | Doc 36 §3.2 has no Messages tab: remove or contract-justify a real messaging surface in the shell contract |
| guardian.account | guardian | app | n/a | `/(guardian)/(tabs)/account` | `/profile` | Profile/account (`ProfileScreen`) | Switch role / prefs | Account tab | NEEDS-UX-REWORK | Not in the binding tab set; doc 36 puts plan/controls under Family — fold or justify in shell contract |
| guardian.ai-activity | guardian | app | n/a | `/(guardian)/ai-activity` | `/ai-activity` (no web nav entry) | AI permissions + what Natalie knows | Toggle consents | push from family home | COMPLETE | Replace fixture consents/observations; add web nav entry or justify |
| guardian.memory | guardian | app | n/a | `/(guardian)/memory` | `/memory` (no web nav entry) | S27 erasure transparency | Erase memory lines | push from ai-activity | COMPLETE | Keep; add web nav entry or justify |

## Tutor (Cool dial)

| ID | Role | Tenant | Bands | Mobile route | Web route | Purpose | Primary task | Nav entry | Class | Proposed action |
|---|---|---|---|---|---|---|---|---|---|---|
| tutor.today | tutor, teacher-as-tutor | app, org | n/a | `/(tutor)/(tabs)/tutor-today` | `/tutors/me` (+ `/` dispatch) | Sessions timeline, landing | Start/prep next session | Today tab | COMPLETE | Verify "Start session"/"Prep" actions are wired (Aug-30 audit flagged Wave-3 no-ops; fresh audit marks screen COMPLETE) |
| tutor.learners | tutor | app, org | n/a | `/(tutor)/(tabs)/session-prep` | `/session-prep` | Roster → per-learner trail + prep | Prep for a learner | Learners tab | COMPLETE | Wire "Generate session plan"; doc 37 pane target (Learners \| detail) |
| tutor.notes | tutor | app, org | n/a | `/(tutor)/(tabs)/notes` | `/report-queue` | Doc-34 draft queue awaiting approval | Approve/suppress drafts | Notes tab | COMPLETE | Keep; the other AdaptivePanes consumer |
| tutor.you | tutor | app, org | n/a | `/(tutor)/(tabs)/tutor-profile` | `/profile` | Profile, credentials, role switch | Manage profile | You tab | COMPLETE | Keep |
| tutor.incidents | tutor | app, org | n/a | n/a (web sidebar item) | MISSING | Incidents — mine + my sessions (doc 36 §3.3 web sidebar) | Review my incidents | web sidebar | MISSING | Build web view scoped to own sessions (doc 31 lifecycle) |
| tutor.resources | tutor | app, org | n/a | n/a (web sidebar item) | MISSING | Resources (doc 36 §3.3 web sidebar) | Open a resource | web sidebar | MISSING | Build or strike from IA with contract note |

## Teacher (Cool dial)

The mobile `(teacher)` shell declares 6 tabs; 4 have no route file, so `ShellTabBar` silently renders **2 of 6** (A-repo-audit §Shell defect). Doc 36 §3.3 folds teachers into the tutor IA + tokened share view — the standalone 6-tab teacher shell exceeds doc 36 and needs its own contract note. `ShellTabBar` must also fail loudly in dev on undeclared routes (C §Entries-with-no-route).

| ID | Role | Tenant | Bands | Mobile route | Web route | Purpose | Primary task | Nav entry | Class | Proposed action |
|---|---|---|---|---|---|---|---|---|---|---|
| teacher.home | teacher | school | n/a | `/(teacher)/(tabs)/teacher-home` | `/teachers/me` | Classroom overview landing | See today's classes | Home tab | PLACEHOLDER | 32-line acknowledged lander — build real classroom overview |
| teacher.classes | teacher | school | n/a | MISSING (tab declared) | MISSING | Class management | Manage a class | Classes tab | MISSING | Build route per reconciled tab map |
| teacher.assign | teacher | school | n/a | MISSING (tab declared) | MISSING | Create/track assignments | Assign work | Assign tab | MISSING | Build route per reconciled tab map |
| teacher.students | teacher | school | n/a | MISSING (tab declared) | MISSING | Student roster → trail | Open a student | Students tab | MISSING | Build route per reconciled tab map |
| teacher.calendar | teacher | school | n/a | MISSING (tab declared) | MISSING | Class calendar | See schedule | Calendar tab | MISSING | Build route per reconciled tab map |
| teacher.conference | teacher | school | n/a | `/(teacher)/(tabs)/conference` | MISSING | Conference hub (guardian conferences) | Run a conference | Conferences tab | PARTIAL | Real UI on demo data (`conference/hub-screen.tsx`); wire collections; add web surface or justify mobile-only |

## Org — tutoring business (Cool dial, web-first; owner + staff share the shell)

| ID | Role | Tenant | Bands | Mobile route | Web route | Purpose | Primary task | Nav entry | Class | Proposed action |
|---|---|---|---|---|---|---|---|---|---|---|
| org.overview | owner, staff | org | n/a | `/(org)/(tabs)/overview` | `/ops` (+ `/tutoring/[orgSlug]` → 307) | Ops landing; today's exceptions | Handle cancellations/unassigned S-items | Overview tab / sidebar | PARTIAL | Demo data (`ops/screen.shared.tsx`); mobile companion renders the full web CRM — slim to an exceptions surface per doc 36 §3.4 |
| org.crm | owner, staff | org | n/a | n/a (web-first by design) | `/ops` (embedded: Leads · Families · Enrollment) | CRM pipeline — never reads learner data (doc 23 wall) | Move a lead through stages | CRM sidebar group | PARTIAL | Kanban board specced (doc 28 §3) but **no board component exists**; table view only. Build seam documented in A-repo-audit (`ReorderRow` + `ops.data.ts`/`stage-change.ts`) |
| org.schedule | owner, staff | org | n/a | `/(org)/(tabs)/schedule` | `/schedule` | Resource-major calendar + booking | Book/move a session | Schedule tab / sidebar | PARTIAL | Replace `DEMO_DAY` fixtures; wire `BookingForm` |
| org.inbox | owner, staff | org | n/a | `/(org)/(tabs)/inbox` | `/notifications` (staff nav) | Staff messages/alerts | Triage inbox | Inbox tab | COMPLETE | Wire org-specific notifications |
| org.safety | owner, staff | org | n/a | `/(org)/(tabs)/safety` | MISSING | Incident triage queue (doc 31 §5.3); unassigned-S4 the only interrupt | Triage incidents | Safety tab (no badge, by design) / sidebar | PARTIAL | Mobile complete (incl. permission-denied state); web Safety sidebar view missing — build it (assignment stays web) |
| org.money | owner | org | n/a | n/a (web-first by design) | `/ops` (billing section) | Payouts · Invoices (doc 36 §3.4) | Review money | Money sidebar group | PARTIAL | Verify payouts/invoices depth vs doc 36; business tiers structurally invisible to guardians |

## School admin (Cool dial)

Mobile `(school)` shell renders **1 of 5** declared tabs — a tab bar that cannot navigate (A-repo-audit). Doc 36 has no school-admin mobile companion at all; decide shell-or-web-only in the contract, then build or delete the declared tabs.

| ID | Role | Tenant | Bands | Mobile route | Web route | Purpose | Primary task | Nav entry | Class | Proposed action |
|---|---|---|---|---|---|---|---|---|---|---|
| school.home | school_admin | school | n/a | `/(school)/(tabs)/school-home` | school host `/` + `/schools/[schoolSlug]` | School overview landing | See school status | Overview tab / nav | PLACEHOLDER | 32-line lander (mobile) + institution screen (web); build real overview |
| school.people | school_admin | school | n/a | MISSING (tab declared) | `/people` (`PeopleListScreen`, live) | Staff + members list | Find a person | People tab / web nav | PARTIAL | Web exists; build the mobile route or drop the tab |
| school.academics | school_admin | school | n/a | MISSING (tab declared) | `/academics` (`InstitutionPlaceholderScreen`) | Subjects/programs | Manage academics | Academics tab / **live web nav destination** | DEAD-END | The designed dead end (C §Web): build it or pull it from `NAV_BY_ROLE.school_admin` until built |
| school.calendar | school_admin | school | n/a | MISSING (tab declared) | MISSING | School calendar | See schedule | Calendar tab | MISSING | Build per reconciled tab map |
| school.more | school_admin | school | n/a | MISSING (tab declared) | n/a | Overflow ("More") | — | More tab | MISSING | Doc 36 §1: a More tab is IA failure — replace with named destinations in the shell contract |
| school.reports | school_admin | school | n/a | MISSING | `/reports` (`InstitutionReportsScreen`) | Enrollment/aggregate reports | Read reports | web nav Reports | PLACEHOLDER | `UNAVAILABLE_METRICS` honest placeholder; wire real k-anon aggregates (Suppressible DataTable exists) |

## District admin (Cool dial)

Doc 36 §3.5 binds district to **web-only, Phase 3** (Outcomes · Schools · Educators · Compliance · Settings) — yet a mobile `(district)` shell ships, rendering **1 of 5** declared tabs. Reconcile in the shell contract (likely: delete the mobile shell, keep web).

| ID | Role | Tenant | Bands | Mobile route | Web route | Purpose | Primary task | Nav entry | Class | Proposed action |
|---|---|---|---|---|---|---|---|---|---|---|
| district.home | district_admin | district | n/a | `/(district)/(tabs)/district-home` | district host `/` + `/districts/[districtSlug]` | Outcomes landing (k-anon aggregates; suppressed cells say "Not shown") | See outcomes | Overview tab / nav | PLACEHOLDER | Build real Outcomes; resolve the web-only contradiction |
| district.schools | district_admin | district | n/a | MISSING (tab declared) | `/schools` (`SchoolListScreen`, live) | Schools in district | Open a school | Schools tab / web nav | PARTIAL | Web exists; mobile per shell decision |
| district.programs | district_admin | district | n/a | MISSING (tab declared) | MISSING | Programs | — | Programs tab | MISSING | Not in doc 36 §3.5 — reconcile against Educators/Compliance before building |
| district.calendar | district_admin | district | n/a | MISSING (tab declared) | MISSING | District calendar | — | Calendar tab | MISSING | Per shell decision |
| district.more | district_admin | district | n/a | MISSING (tab declared) | n/a | Overflow ("More") | — | More tab | MISSING | Same More-tab IA failure as school.more |
| district.people | district_admin | district | n/a | MISSING | `/people` (shared with school) | Educators (doc 36 §3.5 calls this Educators) | Find an educator | web nav People | PARTIAL | Align naming with doc 36; scope to educators |
| district.compliance | district_admin | district | n/a | n/a (web-only) | MISSING | Consent records + incident stats — counts, never contents | Review compliance | doc 36 sidebar | MISSING | Build (Phase 3 per doc 36; IA now) |

## Cross-role / system

| ID | Role | Tenant | Bands | Mobile route | Web route | Purpose | Primary task | Nav entry | Class | Proposed action |
|---|---|---|---|---|---|---|---|---|---|---|
| sys.dispatch | all | any | all | `/` (`index.tsx`) | `/` (host-aware) | Boot dispatch: last-used shell, never a picker wall | Land in the right shell | cold launch | COMPLETE | Keep; `resolveBootRole` + `SHELL_ROOTS` shared table |
| sys.not-found | all | any | all | `+not-found` (silent `/` redirect) | Next `notFound()` | Role-mismatched deep links die silently (doc 36 §4.4) | — | broken/mismatched link | COMPLETE | Verify silent redirect is also right for genuinely broken links (C §Cross-cutting); record in shell contract |
| sys.settings | all authed | any | 3–12 + adults | `/settings` | `/settings` | Preferences, theme, session | Change prefs / sign out | Profile/You | PARTIAL | Sign-out/delete unwired (→ FD-26); guardian web nav mislabels this "Family" |
| sys.editor-settings | tutor, org | app, org | n/a | `/editor-settings` | MISSING | Note-editor preferences | Tune editor | editor toolbar | PARTIAL | Add web equivalent or justify mobile-only |
| sys.onboarding.dev | dev/QA | any | n/a | `/onboarding/dev` (`DevPersonaSwitch`) | n/a | QA persona switching | Swap persona | direct URL | COMPLETE | Gate out of release builds (rides the doc-38 auth-mock release check) |
| sys.onboarding.handoff | learner | app | all | `/onboarding/handoff` | n/a | Duplicate of `/handoff`, no inbound link | — | none | DUPLICATED | Delete; keep `/handoff` as the deep-link target (C §Mobile) |
| share.report | teacher (tokened, no login) | any | n/a | n/a | `/share/report/[token]` | Read-only session report, blocks 1–6+8, noindex | Read a shared report | share link | COMPLETE | Keep; no shell, no providers, by design |
| admin.payload | platform admin | internal | n/a | n/a | `admin.moyolearn.com/admin` (apps/admin-vite) | Themed Payload back office — deliberately not a consumer shell | Operate the platform | direct | COMPLETE | Design-of-record per ADR-004; out of overhaul screen scope |

## Out-of-shell surfaces (apps/web-vite, marketing origin)

| ID | Role | Tenant | Bands | Mobile route | Web route | Purpose | Primary task | Nav entry | Class | Proposed action |
|---|---|---|---|---|---|---|---|---|---|---|
| marketing.chapters-lab | internal | www | n/a | n/a | `/chapters-lab` | Self-labelled "TEMPORARY … Delete before handing back", ships with own vite config | — | none | DEAD-ROUTE | Delete route + `vite.config.chapters-lab.ts` (C §web-vite) |
| marketing.globe-lab | internal | www | n/a | n/a | `/globe-lab` | Internal lab on the public marketing origin; noindex unconfirmed | — | none | ORPHAN | Confirm noindex or gate (C §web-vite) |

## Counts

| Classification | Count |
|---|---|
| COMPLETE | 23 |
| PARTIAL | 30 |
| PLACEHOLDER | 4 |
| MISSING | 29 |
| DUPLICATED | 2 |
| DEAD-ROUTE | 1 |
| ORPHAN | 4 |
| DEAD-END | 1 |
| MISSING-STATE(S) | 0 |
| NEEDS-UX-REWORK | 2 |
| **Total rows** | **96** |

MISSING-STATE(S) carries no rows at this altitude: per-state gaps (doc 38's six-state Storybook rule — `default · loading · error · empty · success · offline`) are folded into each PARTIAL row and re-open per screen at the Phase-2 contract gate.

Per group: FD 26 (17 PARTIAL · 9 MISSING) · PW 9 rows / 8 surfaces (1 PARTIAL · 8 MISSING) · Learner 9 · Guardian 11 · Tutor 6 · Teacher 6 · Org 6 · School 6 · District 7 · Cross-role 8 · Marketing 2.
