# Overhaul v2 — Deliverable A: Repository Audit (Phase 1)

What it is: the §5.1 repository audit for the v2 product-experience overhaul, one section per surface.
Why it exists: no screen work starts until this audit and the §17.1 research deliverables exist.
Source of truth: this file for audit findings; docs/pack/* for binding design decisions.
SOT-KEYWORDS: overhaul, repo-audit, drift, phase-1

Status: IN PROGRESS — sections land as audited. Branch: `overhaul/phase1-audit`.

## Baseline

- `pnpm typecheck`: green, 18/18 tasks (2026-09-01).
- Working tree at audit start: one uncommitted change, `apps/web-vite/src/routeTree.gen.ts` (+9 lines, generated).

## Drift and prompt-vs-repo discrepancies

1. **`prompts/ROSTER.md` does not exist** anywhere in the repo. The overhaul prompt names it as a binding input to embed in every sub-prompt. Resolution needed: either author it (from the prompt's §1 roster table) or treat §1 of the overhaul prompt as the roster of record.
2. **`apps/admin-vite` exists and is design-of-record, not drift.** The prompt's premise ("the design of record says there is no separate `apps/admin*`") is stale — reversed by `docs/site/adr-004-admin-app-split.md` (2026-08-28) and deployment-doc rev 4. Rationale: co-hosting Payload admin in web-vite forced RSC on the marketing bundle (155.8 → 245.6 kB gz on `/`), and `moyo-www` held `DATABASE_URL`/`PAYLOAD_SECRET`. Split restored 155.8 kB exactly and isolated secrets. Fully wired: `turbo.json` `admin-vite#build`, CI, own Vercel project `moyo-admin` at `admin.moyolearn.com`.
3. **Real drift is in `apps/web`** (stale seams left from the admin split):
   - `apps/web/app/(payload)/admin/importMap.js` is an orphan — no route consumes it.
   - `apps/web/proxy.ts` still allowlists `/admin` and `/api/payload` as public paths; both dead.
   - ADR-003 §Option B and ADR-004 §Option C cite `apps/web/app/(payload)/admin/[[...segments]]/page.tsx` and `(payload)/layout.tsx` as "installed and working today" — neither exists.
   - `docs/deploy/moyo-district-tenancy.md` §6 gives code for a nonexistent `apps/web/app/(payload)/admin/layout.tsx` (forward-looking guidance reading as current).
4. **`apps/web-vite/src/routes/chapters-lab.tsx`** is self-labelled "TEMPORARY … Delete before handing back" and still ships (with its own `vite.config.chapters-lab.ts`). `/globe-lab` and `/chapters-lab` are internal surfaces on the public marketing origin without confirmed `noindex` (`/motion-lab` is noindex).
5. **Payload REST is served twice** against the same production DB: `apps/web` `/payload-api/[...slug]` (Next handlers) and `apps/admin-vite` `/payload-api/*` (hand-rewritten `handleEndpoints` — the adapter hardcodes `/api`). GraphQL only in `apps/web`; admin-vite documents the asymmetry deliberately. Watch item, not a bug.

## apps/web — product app (Next.js 16, App Router)

Framework: Next App Router, Turbopack-only, React Compiler on, Payload 4 canary via `withPayload`, Better Auth, Sentry, Solito shared navigation with mobile. Boots via `node scripts/next.mjs`. Scale: 35 pages, 41 API routes, 9 route groups.

### Route groups
- `/` — host-aware dispatcher (no tenant slug → `HomeScreen`; district host → `DistrictHomeScreen`; school host → `SchoolHomeScreen`).
- `(auth)` chrome-free: `/login`, `/login/[org]` (district-branded, server component), `/onboarding`, `/onboarding/[flow]` (five closed-set sequences, prerendered), `/handoff` (learner device-code redemption).
- `(learner)` `/learn/today` · `(guardian)` `/family` · `(tutor)` `/tutors/me` · `(teacher)` `/teachers/me` — each behind `RoleShell allowedKinds`.
- `(business)` `/tutoring/[orgSlug]` → redirects `/ops`. `(ops)` `/ops` — CRM/pipeline/scheduling/billing, own root layout, no site chrome, `h-dvh`.
- `(district)` `/districts/[districtSlug]`; `(school)` `/schools`, `/schools/[schoolSlug]`, `/academics` (**`InstitutionPlaceholderScreen` — unbuilt, yet a nav destination in `NAV_BY_ROLE.school_admin`**).
- `(session)` `/tutor` — immersive live-session surface, mounts `AudioRecorderSheet` + `UploadQueueProvider`.
- `(share)` `/share/report/[token]` — tokened teacher-facing session report, noindex, no providers.
- `(site)` 15 thin Solito wrappers under `SiteChrome`: ai-activity, capture, family-calendar, memory, notifications, plan, practice, profile, progress, report-queue, reports/[sessionId], schedule, session-prep, settings, subjects.
- `(payload)` `/payload-api/[...slug]` + `/payload-api/graphql` (only GraphQL endpoint in the monorepo). **No admin panel here** — panel lives in admin-vite.

### Shells
- `apps/web/components/site/SiteChrome.tsx` — anon → `SiteHeader`/`SiteFooter`; authed → `RoleShell`; loading → skeleton; wraps in `TenantScope` CSS vars.
- `apps/web/components/site/RoleShell.tsx` (~500 lines) — **Hot** roles (learner, guardian): sticky pill top-nav desktop, fixed bottom tabs mobile, hamburger sheet with `ContextSwitcher` + `RoleSwitcher`. **Cool** roles (tutor, teacher, owner, staff, school_admin, district_admin): `DashboardShell` from `packages/ui/DashboardShell.tsx` — sidebar collapsing to a 112px labelled rail (`mode: 'auto'|'rail'|'menu'`), `topBarStart={<ScopeSwitcher/>}`, `topBarEnd={<MembershipMenu/>}`. Owns role-accent mapping + tenant theming.
- `nav.ts` — `NAV_BY_ROLE` (4 items/role), zustand `useMobileMenu`.
- No dedicated web utility bar; `DashboardShell` top-bar slots are the closest seam. Hot shell has no utility-bar equivalent.

### Tenancy & guards
- `packages/auth/src/host-tenant.ts` — host→slug parser, rejects nested subdomains/apex/previews, `NON_TENANT_HOSTS=['app','admin','www']`, unit-tested. Slug **is** `orgId` (`Organizations.slug`); no Tenants collection. Server readers registered in `apps/web/lib/tenancy.wiring.ts` from `instrumentation.ts`; fails closed.
- Three guard layers: `proxy.ts` (session redirect, fail-closed, live-mode only) → `RoleShell allowedKinds` (auto-switch to matching membership or `/login`; skeleton while misguarded) → `protectedOperation()` + capability/membership gates; identity never a parameter. `/api/entitlements` intentionally carries no `requires`.

### API surface (41 routes, by domain)
auth · entitlements · family/learners · guardian (incidents, reports, share, safety-status) · handoff (+redeem) · health/jobs · jobs/drain (+cron) · learner/profile · marketing voice · media (presign, sweep+cron, video, view, voice-note) · memory (erase, erase-transcript, forget-all) · ops/leads (+[id]/stage) · progress · retention sweep (+cron) · safety/incidents · share/report/[token] · summary/queue · tutor (coach, evaluate, next, session, message, attachment, voice, baked voice).

## apps/web-vite — marketing site (moyolearn.com)

TanStack Start + Vite, Nitro/Vercel preset, prerendered. No auth, no Payload, no DB (ADR-004 removed the mount; eslint + vite guards forbid reintroducing `rsc()`). Carries R3F/three (globe), GSAP, Lenis, RN-web + `@acme/ui`.

Routes (16): `/`, about, how-it-works, for-parents, for-schools, pricing, faq, contact, safety, privacy, childrens-privacy, terms + three internal labs (`/globe-lab`, `/motion-lab` noindex, `/chapters-lab` TEMPORARY). Copy centralized in `src/copy/content-pages.ts`. Tutor avatar fallback `PlaceholderPlate` in `chapters/natalie-surface.tsx` is a documented tier-C/prerender fallback, not debt.

## apps/admin-vite — Payload super admin (admin.moyolearn.com)

TanStack Start + `@vitejs/plugin-rsc` + `@payloadcms/tanstack-start`, `prerender: false`, port 5174. Routes: `/` → 307 `/admin`; `_payload` pathless layout (no-store, noindex, Payload CSS + `@acme/theme/payload-admin.css`); `/admin`, `/admin/*`; `/payload-api/*` (hand-rewritten REST). Design-of-record per ADR-004.

## apps/storybook — aggregator, zero own stories

69 story files, all co-located in packages. Coverage: `packages/ui` root 55/68 (~81%); primitives 1/1; audio 3/3; **adaptive-panes 2/10 (20%)**; layout 1/1 **but the `ui/layout/*` glob is missing from `.storybook/main.ts` so `Container.stories.tsx` never loads** (same bug class fixed twice before for audio/adaptive-panes); html 0/3; **app features ~7 stories across 29 feature dirs (~24%)**. `react-docgen` deliberately off (RN Flow breaks parse) → no autodocs prop tables. Renderable components missing stories: `TutorThread`, `TrendLine`, `ImageViewer`, `ToastCard`, `MoyoLearnLogo`.

## Unfinished-work indicators (web + web-vite + admin-vite)

TODO/FIXME/HACK/"coming soon"/stub/mock-data: **0 hits** across ~120 source files. `useState(`: 3, all local-ephemeral (menuOpen, caption, muted) — consistent with zustand-only rule. Real unfinished work is structural: `/academics` placeholder screen (a live nav destination), the apps/web admin-seam orphans, the temporary lab routes, the un-globbed Storybook layout dir.

## apps/mobile — thin routing shell (Expo Router)

34 of 56 route files are 3-line re-exports from `@acme/app`; all screen logic lives in `packages/app/features/**`. Zero unfinished-indicator hits in `apps/mobile` itself is a measurement artifact — the debt sits one package over and in the layout files.

### Shell defect: `ShellTabBar` silently drops undeclared tabs
`apps/mobile/components/ShellTabBar.tsx:57-59` — an `ITEMS` entry whose route file doesn't exist renders nothing, no error. Actual tab counts:

| Shell | ITEMS declared | Render | Missing routes |
|---|---|---|---|
| learner | 6 (band-filtered) | 3/4/5 by band ✅ | none |
| guardian | 5 | 5 ✅ | none |
| tutor | 4 | 4 ✅ | none |
| org | 4 | 4 ✅ | none |
| teacher | 6 | **2** | classes, assign, calendar, students |
| school | 5 | **1** | people, academics, calendar, more |
| district | 5 | **1** | schools, programs, calendar, more |

School and district ship a one-item tab bar that cannot navigate.

### Band handling — two live defects
Band type `AgeBand = 'young'|'child'|'teen'|'adult'` (exported from `packages/app/features/capture/age-band.ts` — odd home for a session-wide concept), carried on `ActiveContext.gradeBand`, fallback `'teen'`.
- **(a) Band never populated under live auth.** `providers/session/live.tsx:99-104` calls `setPersona` without `gradeBand`; only mock/persona fixtures set it. In production every child gets the 5-tab teen IA, K–2 never sees `LearnerHubContent`, band-scaled targets never apply.
- **(b) Capture never receives the band even in mock.** `(learner)/(tabs)/capture.tsx` re-exports `CaptureScreen` bare; `CaptureScreen({ ageBand = 'teen' })` never reads the session. The 797-line band-aware capture flow runs at `'teen'` for a six-year-old on every path. One-line wrapper fix.

The band-adaptive learner tab layout itself (`(learner)/(tabs)/_layout.tsx`) is the most complete layout: 3/4/5 tabs by band, raised center `capture` with `raised: true` on every band, `min-h-target-*` per band, off-band routes `href: null` (deep-link-proof).

### Header/chrome gaps
- `ShellHeader` avatar is **dead code** — rendered only when `profileHref` passed; zero call sites pass it.
- No notifications affordance in any mobile header. No tenant identity/switcher in mobile chrome (`ScopeSwitcher` is web-only). Titles come from a `TITLES` path map; teacher/school/district/tutor Stack layouts pass `titles={{}}` so headers show bare fallback.
- **No Drawer anywhere** in apps/mobile despite layout comments promising one for guardian Reports/Alerts.
- Sheets deliberately root-mounted in `app/_layout.tsx` (Gorhom nesting bug, documented).

### Dead / duplicate routes
- `(guardian)/(tabs)/alerts.tsx` — unreachable (not in ITEMS, no push anywhere).
- `(guardian)/family-calendar.tsx` — duplicate of `(tabs)/calendar.tsx`.
- `onboarding/handoff.tsx` — duplicate of `app/handoff.tsx`, no inbound link.
- `apps/mobile/components/EventActionsSheet.tsx` — orphaned, never imported.
- `(guardian)/(tabs)/reports.tsx` near-dead: only entry is family-screen push.
- Declared-but-nonexistent tab routes: `/classes`, `/assign`, `/students`, `/people`, `/academics`, `/programs`, `/schools`, `/more`, `/calendar` (×3 shells).

### Route classification (mobile)
- PLACEHOLDER: teacher-home, school-home, district-home (32-line acknowledged landers).
- PARTIAL (real UI, demo/fixture data, collections unwired): org schedule/overview, conference (both), guardian messages (aliases `NotificationsScreen`; no messaging surface exists), learner capture (band defect).
- COMPLETE: the rest — learner today/capture/tutor/progress/stuff/subjects/plan/you; guardian family/memory/ai-activity/calendar/family-home/reports(+detail)/account; tutor notes/today/session-prep/profile; org overview/safety/schedule/inbox; onboarding set.

### Context switching
- `ContextSwitcher` (packages/app/providers/session/context-switcher.tsx) reachable via profile screens; hidden unless ≥2 memberships (only `dana` persona qualifies). `ScopeSwitcher` + `RoleSwitcher` web-only; mobile QA path is `/onboarding/dev` `DevPersonaSwitch`.
- Shell resolution pure table `providers/session/shell.ts` (`shellForRole`, `SHELL_ROOTS`, `resolveBootRole` — "n roles → last-used, never a picker wall"), last-shell persisted sync via MMKV/localStorage.
- **Child switching does not exist.** `ActiveContext.learnerId` set only for the learner's own id; guardian family screen lists children from hardcoded `parent-home.data.ts` (Maya/Jordan) and never sets `learnerId`.

### packages/app debt markers (where mobile routes resolve)
- `useState(`: 12 files / 21 occurrences — top: capture-screen (4), consent-flow-content (3), tutor-screen (2), sign-in-content (2), crop-preview.native (2).
- TODO/FIXME: 3 (business onboarding ×2 + steps.ts, core/telemetry.ts).
- Honest placeholders (labelled): `institution/placeholder-screen.tsx`, `institution/reports-screen.tsx` `UNAVAILABLE_METRICS`, `institution/screen.{native,web}.tsx` (renders literal "Institution").
- Demo data in production-reachable screens: `conference/hub-screen.tsx`, `ops/screen.shared.tsx`, `schedule/screen.tsx` + `BookingForm.tsx` (`DEMO_DAY`), `home/parent-home.data.ts`.

## Shared packages

### packages/ui — component kit (barrel: `packages/ui/index.ts`, guarded by `pnpm check:barrels`)
Present (sometimes under different names than the overhaul prompt uses): `Container`, `Text`, `Heading`, `Button`, `IconButton`, `Card`, `Dial`, `RoleScope`, `TenantScope`, `Badge`, `MasteryBar`, `ProgressBar`, `ScheduleCard`, `StatCard` (=Metric), `Avatar`, `TutorStage`, `LearningCanvas`, `SessionToolbar`, `MessageBubble`, `StreamedText`, `Composer`, forms set (`TextField`…`DropZone`), `EmptyState`, `LoadingSkeleton` (=Skeleton), `Toast`/`notify`, `CoachMark`, `Dialog`, `Lightbox`, `BottomSheet`+`SheetSurface` (=Sheet), `TabBar`+`TabBarAccessory` (=BottomTabs), `Toolbar`, `VirtualList`, `TrendLine`, `DataTable` (=Table, TanStack, with k-anon `Suppressible`), `DashboardShell` (rail as `SidebarMode 'auto'|'rail'|'menu'`), `Menu`, `useSizeClass`, motion set, `PressScale`, `useInstanceStore`, audio set, `TutorThread`, `ImageViewer`, `AdaptivePanes` (full sub-surface), `TwoPaneShell`.

Absent (must be built or explicitly rejected in the component plan): `AppShell`, `MobileHeader` (app-side `AppHeader` exists in `packages/app/features/shell/`), `WebUtilityBar` (DashboardShell top-bar slots are the seam), `NavigationRail` (mode, not component), `AvatarSheet`, `TenantSwitcher`/`ChildSwitcher` (switchers live in `packages/app/providers/session/`; child-switch state only in `ai-activity.store.ts`), `PageHeader`, `Surface` (token family only), `LearningPath`, `LearningCard`, `AssignmentCard`, `SessionCard` (`ScheduleCard` closest), `StudentCard`, `TutorCard`, `ClassCard`, `ErrorState` (`ErrorMessage` only), `FilterBar`.

**No kanban/board component exists anywhere** (docs/pack/28-crm-spec.md §3 specifies "kanban by stage"; only the DataTable view is built). Build seam for the CRM board: gesture pattern from `packages/app/features/editor/reorder-row.native.tsx` (`ReorderRow` — long-press pan, UI-thread shared values, single commit on release; 1-D only, needs cross-column generalization) + the complete existing pipeline model: `features/ops/ops.data.ts` (`Stage`, `Lead`, `STAGE_TONE`), `stage-change.ts` (`applyStageChange` pure reducer), `use-stage-action.ts` (optimistic write), `ops.service.ts`. `EventDrag` (schedule) is the 2-D snap-drag reference. `DropZone` is OS file-drop only, not in-app DnD.

### packages/theme — tokens (tokens.ts, 939 lines; "no hex outside this file")
- Role accents CONFIRMED per doc 36 — derived in OKLCH, **shipped as hex** (RN can't evaluate `oklch()`): learner `#FFDB33`, guardian `#95EBFF`, tutor `#EDD4FF`, teacher `#FFD5C4` (re-minted 2026-09-01; the audited `#FFC7B2` measured 13.09:1 under ink), org `#FFD7A5`, school `#BFF5C8`, district `#83EFF5`, each with pre-resolved `-underlay` rgba(0.24); ≥14:1 parity bar; `accentRoles` drives `.role-*` scopes; admin mints nothing; `tooling/check-role-accent.mjs` enforces the slot allowlist.
- Tenant accent two-layer: ~22 `tenant-*` semantic defaults + `tenant.ts` (`resolveTenantTheme`, `accessibleForeground` real luminance math, `tenantCssVariables`).
- Spacing tiers are `{cool, hot}` dial pairs (`element/stack/group/section` — token names deliberately unprefixed to avoid `gap-gap-stack`). Age-band targets in `targets`: floor 24 / adult 44 / teen 48 / child 56 / young 72px.
- Typography: Archivo Black display, Space Grotesk sans, Chivo Mono; `uiRamp` is the working ramp (title-lg…data-lg, 12px caption floor); `typeScale` display steps for hero moments only.
- **Trap:** primitive scale names are documented lies (`burgundy`=yellow, `gold`=blue, `ember`=hot pink) — semantic aliases only in feature code.
- Two deliberately separate width systems (documented "do not merge"): `widthClassMinDp` M3 4-band (0/600/840/1200) → AdaptivePanes; `size-class.constants.ts` binary compact|regular @768 → TwoPaneShell/DashboardShell/Text ramp.
- Hex leakage in packages/ui: **one real violation** — `packages/ui/TrendLine.native.tsx:54` `color="#2952D9"` (= `palette.gold[600]`). Logo files' 88 hits are lookup keys, benign.

### packages/app/core — the block
- `protectedOperation()` at `packages/app/core/protected-operation.ts:215` — `(auth, headers, operation, options)`, `ProtectedCtx {learnerId, isLearner, orgId?}`; gate order session → host tenant → membership/role → plan/entitlement → handler (role before plan so a 403 never surfaces as a 402); telemetry in `finally`; `isMockAuth()` single definition; mock branch skips host + mints no membership role.
- **Repositories are app-local, not shared**: `apps/web/lib/*.repository.ts` (student-model, retention, incident, safety-event, enrollment, summary, org). apps/mobile and admin-vite have no path to them. And `packages/app/features/tutor/coach.service.ts` imports `@acme/payload` directly — bypasses the repository rule.
- Services: 19 `<name>.service.ts` colocated per feature (no `services/` dir; feature folder is the domain).

### State
- 33 exported global Zustand stores (5 ui, 2 providers, 26 features) + a deliberate per-instance vanilla pattern (`useInstanceStore`) used by AdaptivePanes, Menu, audio, schedule editors. Persisted-prefs stores use the 4-file fork convention.
- `useState(` in packages/ (excl. stories): 26 across 13 files — hot spots `features/capture` (8/4 files) and onboarding (6/3). 12 of 14 packages at zero.

### AdaptivePanes / TwoPaneShell
- `AdaptivePanes` (`packages/ui/adaptive-panes/`, 58 files): compound API (`Column` max 2, `Inspector` drawer), per-instance store, transform-only collapse animation, panes stay mounted expanded (scroll/state preserved), SplitView adoption seam documented. **Only 2 real consumers** (`SummaryQueuePaneScreen`, `ReportsPaneScreen`) and no app mounts it directly — big surface, thin adoption.
- `TwoPaneShell` (`packages/ui/TwoPaneShell.tsx:142`): brand pane takes **data, never nodes** (doc 37's zero-interactive-content rule made unrepresentable); one tree (column→row at `md`), band inside the scroll view so keyboard never hides the form; CSS width class (not `useSizeClass`) to avoid SSR flash. One consumer: `apps/web/components/auth/LoginContent.tsx:117`.
