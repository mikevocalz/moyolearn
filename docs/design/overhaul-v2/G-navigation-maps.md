# Overhaul v2 — Deliverable G: Reconciled Navigation Maps

What it is: the reconciled navigation maps for the overhaul — mobile tabs per role, account sheet/drawer, web rail + Hot top-nav, utility bar, and tablet panes — each row citing doc-36/37 binding text and the actual layout files.
Why it exists: §17.1 deliverables G/H/I/J/K; `route-audit-36.md` §3 is stale (predates guardian's 7 tab files and the teacher/school/district shells — B-deliverable-status.md row G). Doc 36 and doc 37 WIN over every hypothesis here; every divergence from doc 36 is flagged ADR-NEEDED, never silently adopted.
Source of truth: docs/pack/36-role-navigation-flows.md §3–§5 · docs/pack/37-onboarding-dual-pane.md §3 · this file for the reconciliation; A-repo-audit.md / C-orphans-dead-ends.md for the current-state evidence.
SOT-KEYWORDS: overhaul, navigation-map, tab-map, account-sheet, web-rail, utility-bar, adaptive-panes

Status: Phase-1 deliverable. Branch: `overhaul/phase1-audit`.

Legend: ✅ conforms to doc 36/37 · ✱ new-build · ⚠ ADR-NEEDED (divergence from or silence in doc 36 — decide before Phase-2 wiring).

---

## §1 · Mobile tab map per role

Current-state columns come from A-repo-audit.md ("Shell defect: ShellTabBar silently drops undeclared tabs" table) plus the ITEMS arrays in each `_layout.tsx`. "Renders" differs from "declared" because `apps/mobile/components/ShellTabBar.tsx:58-61` returns `null` for any ITEMS entry whose route file doesn't exist — no error (C-orphans-dead-ends.md: make it fail loudly in dev; that silent drop is the defect that let 1-tab shells ship).

### 1.1 Learner — ✅ conforms (band-adaptive)

| | Value | Source |
|---|---|---|
| Doc 36 binding | K–2: `Today · 📷Snap(raised) · My Stuff` (3) · 3–5: `Today · Subjects · 📷Snap · Me` (4) · 6–8/9–12: `Home · Subjects · 📷Snap · Progress · You` (5). Camera raised center on every band. | doc 36 §3.1 |
| Declared ITEMS | 6 route names (`today, subjects, capture, progress, stuff, you`), band-filtered via `BAND_ITEMS`; off-band routes get `href: null` (deep-link-proof) | `apps/mobile/app/(learner)/(tabs)/_layout.tsx` |
| Renders | 3/4/5 by band, `raised: true` on capture every band, `min-h-target-*` per band | same file; A-repo-audit "most complete layout" |
| Reconciled target | **Keep as-is.** No IA change. | — |

Open defects that gate this map (not IA changes): (a) band never populated under live auth (`providers/session/live.tsx:99-104` omits `gradeBand` → every child gets the 5-tab teen IA in production); (b) `capture.tsx` re-exports `CaptureScreen` bare so the band never reaches the 797-line band-aware capture flow. Both in A-repo-audit "Band handling — two live defects"; fix is Phase-2 P0.

### 1.2 Guardian — ⚠ conflict: 5 declared tabs incl. Messages vs doc 36's 4

| | Value | Source |
|---|---|---|
| Doc 36 binding | **4 tabs: `Home · Reports · Alerts · Family`.** Alerts is its own tab "so serious things never hide under a bell icon". Family holds children + controls (voice default, session budget, `readsAt`, data & erasure, **plan/billing**). No Messages. No Calendar tab. | doc 36 §3.2 |
| Declared ITEMS (5) | `family-home` Home · `family` Children · `calendar` Calendar · `messages` Messages · `account` Account | `apps/mobile/app/(guardian)/(tabs)/_layout.tsx` (its comment claims "doc 36 §3.2: Home · Children · Calendar · Messages · Account" — **doc 36 says no such thing**; the comment is a fabricated citation) |
| Renders | 5/5 (all route files exist) | A-repo-audit table |
| Orphaned routes | `(tabs)/alerts.tsx` unreachable (not in ITEMS, no push anywhere); `(tabs)/reports.tsx` near-dead (one push from family-screen) | C-orphans-dead-ends.md §Mobile |
| Reconciled target | **Doc 36's 4: `Home(family-home) · Reports(reports) · Alerts(alerts) · Family(family)`.** Wire the two orphans as tabs (C-orphans proposed action); drop `calendar`, `messages`, `account` from ITEMS. Calendar stays a stack route pushed from Home/Family (`(guardian)/(tabs)/calendar.tsx` → move out of `(tabs)`; delete duplicate `(guardian)/family-calendar.tsx` per C-orphans). Account content → account sheet (§2) + Family tab (plan/billing lives in Family per doc 36 §3.2 and PW-05's `(guardian)/settings/plan` home, doc 38 §3). | doc 36 §3.2 · C-orphans §Mobile · doc 38 PW-05 row |
| ⚠ ADR-NEEDED | Only if anyone wants to keep Calendar or Messages as a tab. **Messages must go regardless of ADR**: `messages.tsx` aliases `NotificationsScreen` — "a tab whose label lies about its content; no messaging surface exists anywhere" (C-orphans §Cross-cutting). A real messaging tab would need both a product decision and a surface; neither exists. | C-orphans-dead-ends.md |

### 1.3 Tutor — ✅ conforms

| | Value | Source |
|---|---|---|
| Doc 36 binding | 4 tabs: `Today · Learners · Notes · You` | doc 36 §3.3 |
| Declared ITEMS (4) | `tutor-today` Today · `session-prep` Learners · `notes` Notes · `tutor-profile` You | `apps/mobile/app/(tutor)/(tabs)/_layout.tsx` |
| Renders | 4/4 ✅ | A-repo-audit table |
| Reconciled target | **Keep as-is.** (`notes.tsx` already mounts `SummaryQueuePaneScreen` — see §5.) | — |

### 1.4 Org staff (companion) — ✅ conforms

| | Value | Source |
|---|---|---|
| Doc 36 binding | 4 tabs: `Overview · Schedule · Inbox · Safety`; primary action = today's exceptions | doc 36 §3.4 |
| Declared ITEMS (4) | `overview · schedule · inbox · safety` — Safety last, deliberately unbadged (layout comment grounds it in doc 31 §5.3's single-interrupt rule) | `apps/mobile/app/(org)/(tabs)/_layout.tsx` |
| Renders | 4/4 ✅ | A-repo-audit table |
| Reconciled target | **Keep as-is.** | — |

### 1.5 Teacher — ⚠ ADR-NEEDED: doc 36 defines no teacher tab set at all

| | Value | Source |
|---|---|---|
| Doc 36 binding | **None.** §3.3's only teacher mention: "School-teacher variant (share-link viewer, doc 34) is a tokened read-only page — no shell, no login." A teacher *shell* is already a divergence — legitimized outside doc 36 by doc 37's PR-145 amendment ("the teacher (S25) flow … exists and ships: account → class → roster → assignment") and doc 38 FD-23, but never given an IA. | doc 36 §3.3 · doc 37 §2 amendment · doc 38 §3 |
| Declared ITEMS (6) | `teacher-home` Home · `classes` · `assign` · `calendar` · `conference` Conferences · `students` — layout comment cites "doc 36 §3.3: Home · Classes · Assign · Calendar · Students", **a fabricated citation** (and 6 items would break §4.1's ≤5 law anyway) | `apps/mobile/app/(teacher)/(tabs)/_layout.tsx` |
| Renders | **2 of 6** (`teacher-home`, `conference`); `/classes /assign /calendar /students` have no route files | A-repo-audit table · C-orphans §Entries-with-no-route |
| Proposed target (⚠ ADR-NEEDED) | **4 tabs, Cool dial, tutor pattern: `Home · Classes · Assign · You`.** Derivation from doc 36 principles: ≤5 with visible labels (§4.1); land on the thing you came to do (§4.2 — a teacher's Home leads with today's classes/assignments due); the Cool-role 4th slot is You, which hosts the role switcher (§4.3) and the account sheet anchor (§2). Students fold into Classes as list→detail (doc 37 §3.3 pane pattern, §5.4 below); Conferences and Calendar become stack routes reachable from Home — neither is a daily-loop destination that earns a top-level slot over the class/assignment loop doc 37's teacher onboarding establishes. | doc 36 §4 · doc 37 §2 |
| ADR must decide | (1) teacher shell exists at all vs doc 36's "no shell, no login"; (2) the 4-tab set above vs any alternative; (3) fate of `conference.tsx` (built and rendering today — demoted to stack route under this proposal). | — |

### 1.6 School admin — ⚠ ADR-NEEDED: role absent from doc 36 §3 entirely

| | Value | Source |
|---|---|---|
| Doc 36 binding | **None.** §3 enumerates learner/guardian/tutor/org/district/admin; no school role. Code has 8 RoleKinds and a school shell (B-deliverable-status "Known-stale claims": the shells exist now). | doc 36 §3 · A-repo-audit |
| Declared ITEMS (5) | `school-home` Overview · `people` · `academics` · `calendar` · `more` — comment cites "doc 36 §3.4", which is actually the **org** companion set; another fabricated citation. `More` is the IA failure doc 36 §1 names explicitly ("Overflowing into a 'More' tab is IA failure, not a solution"). | `apps/mobile/app/(school)/(tabs)/_layout.tsx` |
| Renders | **1 of 5** — "a tab bar that cannot navigate" | A-repo-audit table · C-orphans |
| Proposed target (⚠ ADR-NEEDED) | **Park the mobile school shell** (keep the route group, ship no tab bar beyond Overview) until the ADR defines the school-admin IA — school admin is web-first like org (§3 below gives it a rail). If mobile ships, derive 4 tabs from doc 36 §3.4's companion pattern: `Overview · People · Academics · Inbox` — never `More`. | doc 36 §1 §3.4 |

### 1.7 District — ⚠ conflict: doc 36 says web-only Phase 3; a mobile shell exists

| | Value | Source |
|---|---|---|
| Doc 36 binding | "**Web only**, Cool sidebar: Outcomes · Schools · Educators · Compliance · Settings" — and Phase 3 ("IA now, build later"). A district *mobile* shell contradicts the doc twice over. | doc 36 §3.5 |
| Declared ITEMS (5) | `district-home` Overview · `schools` · `programs` · `calendar` · `more` (no doc citation in this layout — honest, at least) | `apps/mobile/app/(district)/(tabs)/_layout.tsx` |
| Renders | **1 of 5** | A-repo-audit table |
| Reconciled target | **Retire the mobile district tab bar** (keep the group as a redirect-to-web lander or delete; decide in the shell contract). Do NOT build `/schools /programs /calendar /more` routes — C-orphans' "build the routes per the reconciled tab map" resolves to zero routes for this shell. District IA lives in the web rail only (§3.3 below). | doc 36 §3.5 |
| ⚠ ADR-NEEDED | Only if district mobile is to exist at all. Silence keeps doc 36's web-only ruling. | — |

### 1.8 Cross-shell fixes carried into Phase 2

- `ShellTabBar` fail-loud in dev on ITEMS-without-route (`apps/mobile/components/ShellTabBar.tsx:58-61`; C-orphans action).
- Delete the fabricated doc-36 citations in the guardian/teacher/school layout comments when the layouts are reconciled — a wrong SOT citation is worse than none.
- Labels always visible + ≤5 destinations audited per shell after reconciliation (doc 36 §4.1).

---

## §2 · Account sheet map — ✱ new-build (currently ABSENT)

Current state: **there is no account sheet, drawer, or avatar surface on mobile.** `ShellHeader`'s avatar branch requires `profileHref` and zero call sites pass it — dead code (C-orphans §Dead-code-in-chrome; `apps/mobile/components/ShellHeader.tsx:39-49`). No Drawer exists despite guardian layout comments promising one (A-repo-audit §Header/chrome gaps). `AvatarSheet` is on packages/ui's absent list (A-repo-audit §packages/ui). B-deliverable-status row H: **ABSENT**.

Target: one `AvatarSheet` (build in `packages/ui`, content from `packages/app`), opened from the `ShellHeader` avatar once `profileHref`/an `onAvatarPress` is actually wired in every shell layout. It is chrome, not navigation — nothing in it may duplicate a tab (§4's no-duplication law applies to it too). Contents per role, grounded only in surfaces that exist or are doc-mandated:

| Row | Learner | Guardian | Tutor | Org staff | Exists today? | Source |
|---|---|---|---|---|---|---|
| Identity header (avatar, name, role noun) | ✅ (band-gated: K–2 gets avatar+name only) | ✅ | ✅ | ✅ | `Avatar` + `useProfile` exist (`packages/app/features/profile/profile.store.ts`) | overhaul prompt §9.2 · C-orphans §9.1 note |
| Context/role switcher | — (a child never switches) | ✅ if ≥2 memberships | ✅ | ✅ | `ContextSwitcher` (`packages/app/providers/session/context-switcher.tsx`), today buried in profile screens, hidden unless ≥2 memberships | doc 36 §4.3 "role switcher lives in Profile/You"; sheet is that surface's mobile form |
| Profile & settings | via You tab only (not sheet) | ✅ → `/settings` + account screen | ✅ → `tutor-profile` + `/settings` | ✅ → `/settings` | `apps/mobile/app/settings.tsx` (root-level, shared across shells by design) | that file's comment |
| Plan & billing (PW-05) | **never** (learner column is "nothing" for every paid state) | ✅ → `(guardian)/settings/plan` | — | ✅ (owner only) → `(org)/settings/plan` | ✱ routes do not exist yet; doc 38 assigns them | doc 38 §3 PW-05 row + §PW-05 spec · 00-binding-decisions §Doc-38 |
| Notifications prefs | — | ✅ | ✅ | ✅ | ✱ no mobile notifications affordance exists anywhere (A-repo-audit §Header/chrome gaps) | — |
| Sign out | — (guardian-managed device; K–2 has "no settings", doc 36 §3.1) | ✅ | ✅ | ✅ | ⚠ scaffolded dead: `packages/app/features/settings/settings-content.tsx:83` — `<Button title="Sign out" … onPress={() => {}} />`. Wire to the live AuthPort. | doc 38 §AuthPort |

Rules: the sheet is root-mounted like every other sheet (Gorhom nesting bug, A-repo-audit §Header/chrome gaps); role accent may appear only as the avatar ring (doc 36 §5 allowlist); the learner sheet, if it exists at all, is 6–8/9–12 only — K–2/3–5 keep everything guardian-side (doc 36 §3.1 "no settings (guardian-side only)").

⚠ ADR-NEEDED (small): doc 36 never specifies an account *sheet* — it specifies the switcher in Profile/You. Sheet-vs-You-screen is an overhaul-prompt (§9.2) addition; the ADR just needs to record that the sheet is the mobile chrome form of the same Profile/You surface, not a sixth destination.

---

## §3 · Web nav — Hot top-nav + Cool rail

Current state: `NAV_BY_ROLE` (`apps/web/components/site/nav.ts:26-75`) gives every role a flat 3–4-item list; `RoleShell` (`apps/web/components/site/RoleShell.tsx:405-450`) feeds it to `DashboardShell` as **one unlabelled group** — no grouped sections exist anywhere on web. Doc 36 §3.4/§3.5 mandate grouped sidebars (Neon pattern, §1); the rail *mechanism* is decided and shipped (`DashboardShell` `mode: 'auto'|'rail'|'menu'`, 112px labelled rail — decision record `docs/design/mobbin/web-role-shells.md`: grouped labeled sections per Docusign; one-level rail per the Google Workspace refusal).

### 3.1 Hot top-nav (learner, guardian) — same IA as mobile tabs, no sidebar (doc 36 §3.1/§3.2 "Web: identical IA as top-nav")

| Role | Doc 36 target | Current `NAV_BY_ROLE` | Reconciled target | Delta |
|---|---|---|---|---|
| Learner | band IA: Today/Home · Subjects · Snap · (Progress) (+ You via avatar) | `Today / Subjects / Snap / Progress` (4, band-blind) | Band-adaptive like mobile: K–2 `Today · Snap · My Stuff`; 3–5 drop Progress; 6–8/9–12 keep current 4 + avatar-as-You (`PROFILE` slot, nav.ts:83) | ⚠ web nav is band-blind today; C-orphans flags `(site)/subjects` reachable by URL for K–2 (`href:null` has no web equivalent — needs a permission fallback) |
| Guardian | `Home · Reports · Alerts · Family` | `Home / Reports / Alerts(→/notifications) / Family(→/settings)` ✅ labels match | Keep labels; re-point `Family` at the real family surface (`/family` exists per A-repo-audit route groups) not `/settings`; Alerts keeps its own item, never a bell (doc 36 §3.2) | href fixes only |

### 3.2 Cool rails — reconciled grouped targets

**Tutor (doc 36 §3.3 web sidebar, verbatim):**

| Group | Items | Current nav.ts (flat 4) | Delta |
|---|---|---|---|
| — (unlabelled first group) | Today · My learners · Session notes | `Today / Learners(/session-prep) / Notes(/report-queue)` ✅ | keep hrefs |
| — | Incidents (mine + my sessions) · Resources | absent; nav.ts has `Schedule` instead — **not in doc 36's tutor set** | ✱ add Incidents + Resources rows; ⚠ keeping Schedule needs an ADR (or fold it into Today, which is the sessions timeline) |

**Teacher (web):** currently duplicates the tutor set (nav.ts:46-51). Doc 36 gives teachers a tokened read-only page, not a shell (§3.3). Same ADR as §1.5 governs; until it lands, the teacher rail inherits the teacher ADR's tab set, not the tutor's.

**Org — owner/staff (doc 36 §3.4, verbatim; the doc 23 wall visible in the IA — nothing under CRM opens learner content):**

| Group | Items | Current nav.ts | Delta |
|---|---|---|---|
| — | Overview | owner: `Overview(/ops) / Schedule / Reports` · staff: `Today / Schedule / Clients(/ops) / Inbox` | collapse both flat lists into one grouped rail |
| **CRM** | Leads · Families · Enrollment | `/ops` is one blob (CRM/pipeline/scheduling/billing per A-repo-audit `(ops)` row) | ✱ split into rail items |
| **Scheduling** | Calendar (resource-major) | `Schedule` | move under group |
| **Money** | Payouts · Invoices | absent | ✱ |
| **Safety** | Incident queue (doc 31 §5.3) | absent from web nav | ✱ |
| **Settings** | Org settings · Plan (PW-05/PW-08) | absent | ✱ |

**School admin:** ⚠ same ADR as §1.6 — doc 36 has no school IA. Current `Overview / Academics / People / Reports` includes `/academics` = `InstitutionPlaceholderScreen`, **a designed dead end that is a live nav destination** (C-orphans §Web) — pull it from nav until built regardless of the ADR.

**District (doc 36 §3.5, verbatim — web-only Phase 3):**

| Group | Items | Current nav.ts | Delta |
|---|---|---|---|
| — | Outcomes (k-anonymous, suppressed cells say "Not shown") | `Outcomes` ✅ | — |
| — | Schools · Educators · Compliance (counts, never contents) · Settings | `Schools / People / Reports` | rename People→Educators; **Reports is not in the doc set** — replace with Compliance; ✱ add Settings. `DataTable`'s k-anon `Suppressible` already exists (A-repo-audit §packages/ui) |

Rail grouping ships through `DashboardShell`'s existing `NavGroup.title` (small-caps section labels, `packages/ui/DashboardShell.tsx:49-53,192-193`) — the component is ready; only `nav.ts`'s shape (flat `NavItem[]` → grouped) and `RoleShell`'s single-group adapter (`RoleShell.tsx:420-433`) change.

---

## §4 · Utility bar (web top bar)

Current: `DashboardShell` `topBarStart`/`topBarEnd` slots; `RoleShell` passes `topBarStart={<ScopeSwitcher/>}` `topBarEnd={<MembershipMenu/>}` (`RoleShell.tsx:444-445`). That is the whole current utility bar; "no dedicated web utility bar; DashboardShell top-bar slots are the closest seam. Hot shell has no utility-bar equivalent" (A-repo-audit §Shells; B-deliverable-status row I/J: no utility-bar map existed until this section).

Target contents (Cool shells; pattern = Google Workspace adoption in `docs/design/mobbin/web-role-shells.md`: "Keep the top bar minimal (search, notifications, account) and let the left rail own the role hierarchy"):

| Slot | Content | Exists today | Notes |
|---|---|---|---|
| Start | **Tenant switcher** (org/scope identity — the ClassDojo-refusal rule: active role/tenant visible in the shell itself, not hidden in a menu) | `ScopeSwitcher` (`packages/app/providers/session/scope-switcher.tsx`) ✅ | evolves toward the absent `TenantSwitcher` named in A-repo-audit §packages/ui |
| Center/start-2 | **Search / command** (⌘K) | ✱ absent — no search surface anywhere | Cool shells only; doc 36 §3.1 bans search for K–2 and the learner shell has no utility bar at all |
| End | **Notifications** | ✱ absent (no notifications affordance in any chrome, A-repo-audit) | never carries safety counts — org Safety stays unbadged for the doc 31 §5.3 reason recorded in `(org)/(tabs)/_layout.tsx` |
| End | **Avatar → account menu** (same contents as §2's sheet, per role) | `MembershipMenu` (`RoleShell.tsx:142-197`: Profile & settings + membership switch) ✅ partial | grows the §2 rows (plan/billing, sign out) |

**No-duplication law (binding for Phase 2):** an item lives in the rail XOR the utility bar, never both — the rail owns *destinations* (role hierarchy), the utility bar owns *cross-cutting utilities* (tenant, search, notifications, account). Concretely: Settings is a rail group (§3.2), so the avatar menu deep-links into it rather than duplicating it as a second Settings list; the tenant switcher never reappears inside the avatar menu (today `MembershipMenu` duplicates `ScopeSwitcher`'s membership-switching — resolve by keeping role/tenant switching in the start slot and account actions in the end slot). Hot shells get no utility bar; their header is logo + top-nav + avatar only (`RoleShell.tsx` HotShell, conforming to doc 36 §3.1's "no sidebar — learners don't get dashboards").

---

## §5 · Tablet / pane map (doc 37 §3)

Binding designations (doc 37 §3.3, restated in 00-binding-decisions §Doc-37): tutor `Learners|detail` and `Notes queue|draft` · guardian tablet `Reports|report` · ops = web sidebar app, **no SplitView** · district = web grid, not SplitView · **learner: never** — "a split learner UI is attention arbitrage"; lifting the ban even for 9–12 requires an ADR (00-binding-decisions §Doc-37). Collapse by width class, never device type; primary pane wins on collapse; selection survives the fold in a scoped Zustand store (doc 37 §3.2). `AdaptivePanes` is the default renderer on every platform; `unstable-split-view` stays behind the same API until it exits alpha (doc 37 §3.2).

| Pane surface | Doc 37 §3.3 designation | Status | Evidence |
|---|---|---|---|
| Tutor `Notes queue \| draft` | mandated | **EXISTS** — `SummaryQueuePaneScreen` mounted at `apps/mobile/app/(tutor)/(tabs)/notes.tsx` (`packages/app/features/summary/draft-queue-pane-content.tsx`) | grep, this audit; A-repo-audit's "no app mounts it directly" is overtaken for these two routes |
| Guardian tablet `Reports \| report` | mandated | **EXISTS** — `ReportsPaneScreen` mounted at `apps/mobile/app/(guardian)/(tabs)/reports.tsx` (`packages/app/features/summary/reports-pane-content.tsx`) — and becomes tab-reachable when §1.2 wires the Reports tab | same |
| Tutor `Learners \| detail` | mandated | ✱ **TO ADD** — `session-prep` (the Learners tab) is single-pane today | doc 37 §3.3 · `(tutor)/(tabs)/_layout.tsx` |
| Teacher `Classes \| detail` | not in doc 37 | ✱ future, **gated on the §1.5 teacher ADR** — it's the pane form of folding Students into Classes | §1.5 proposal |
| Org, district | banned from panes (sidebar / web grid) | conforming — neither mounts AdaptivePanes | doc 37 §3.3 |
| **Learner — any band** | **BANNED** | conforming — no learner pane exists; keep it that way. Restated: single-focus by design (doc 08 Hot dial ≥40% canvas); an ADR is required even to discuss 9–12. | doc 37 §3.3 · 00-binding-decisions §Doc-37 |

Adoption note: `AdaptivePanes` is a 58-file surface with 2 consumers and 2/10 Storybook coverage (A-repo-audit §AdaptivePanes, §Storybook) — adding tutor `Learners|detail` is the third consumer and should reuse the compound API as-is, not fork it.

---

## §6 · ADR register (decisions this file cannot make)

| # | Decision | Sections | Default if no ADR |
|---|---|---|---|
| ADR-a | Guardian keeps any 5th tab (Calendar) vs doc 36's 4 | §1.2 | doc 36's 4 tabs; Calendar = stack route |
| ADR-b | Teacher shell existence + 4-tab set `Home · Classes · Assign · You`; fate of Conferences | §1.5, §3.2, §5 | shell stays (doc 37 amendment precedent), proposed set adopted |
| ADR-c | School-admin IA (role absent from doc 36) + mobile school shell | §1.6, §3.2 | park mobile at Overview-only; web rail waits on ADR; `/academics` pulled from nav now |
| ADR-d | District mobile shell existence vs doc 36 §3.5 web-only | §1.7 | retire mobile district tab bar |
| ADR-e | Tutor web `Schedule` item (not in doc 36's sidebar set) | §3.2 | fold into Today; doc set adopted |
| ADR-f | Account sheet as mobile chrome form of Profile/You (record-keeping) | §2 | build the sheet |
| ADR-g | (standing, from 00-binding-decisions) any learner pane, ever | §5 | ban holds |
