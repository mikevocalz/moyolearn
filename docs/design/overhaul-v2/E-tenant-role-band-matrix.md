# Overhaul v2 — Deliverable E: Tenant × Role × Band Matrix

What it is: the canonical tenant list, the tenant×role matrix (bands, entitlement, devices, shell, tasks, screens, boundaries), multi-context rules, and the honest gap ledger.
Why it exists: §17.1 D/E was PARTIAL — role×task existed twice (role-UX audits §4) but the tenant axis lived only in code (`packages/theme/tenant.ts`); this file adds it.
Source of truth: this file for the matrix; PRD §5/FR-10/FR-11 (`docs/pack/33-moyo-learn-prd.md`), doc 36, doc 38 §5B, and the cited code for the underlying facts.
SOT-KEYWORDS: overhaul, tenant, role, band, matrix, entitlement, shell, multi-context, k-anon

Status: DONE (2026-09-01). Branch: `overhaul/phase1-audit`.
Screen IDs: `D-screen-inventory` does not exist yet (B-deliverable-status: PARTIAL) — key screens use FD-*/PW-* IDs from doc 38 §3 plus `role.screen` route names from the repo.

---

## §1 · Canonical tenant list

One tenant object: `Organizations` (`packages/payload/src/collections/Organizations.ts`) with `kind ∈ tutoring | school | district` — doc 01's rule, quoted in the collection header: "organization = tutoring company / school / district; teams = locations / departments." `slug` IS the tenant key (`ctx.orgId`, the `<slug>.moyolearn.com` hostname). There is no Tenants collection and no District collection — a district is an org whose `kind` says so; a school points at its district via the `district` relationship field.

| # | Tenant | Repo representation | Verdict |
|---|---|---|---|
| 1 | **Family** | No Organizations row. `Guardianships` (guardian↔learner pair rows, two-guardian support) + family plan on the guardian **user** (`billing-plans.ts` `customerType: 'user'`) | Real; deliberately org-less |
| 2 | **Independent learner** | **Absent.** FD-03 has exactly 4 cards (child / students / business / me—I-tutor), consent checkbox is "I'm 18 or older," and the card footer says "Kids don't sign up here." `AgeBand 'adult'` is the 9–12 band (`age-band.ts`), not adult self-learners | **Not a tenant — do not build a cell for it** |
| 3 | **Independent tutor** | Doc 38 FD-03 `[decision: solo tutor = organization of one]`; FD-20 `solo=true` skips FD-21; plan `ops-solo` | Real; = org of one, `kind: 'tutoring'` |
| 4 | **Tutoring business** | `kind: 'tutoring'` (default); Membership `{role, organizationRole}`; plans `ops-studio`/`ops-scale` | Real |
| 5 | **School** | `kind: 'school'` + `district` relationship; `Enrollments` roster bridge (`learnerAuthId → orgId + districtId`) | Real |
| 6 | **Campus** | **Absent as a tenant.** Only three copy-level hits: `school-home-screen.tsx` ("will list campuses"), `district-home-screen.tsx`, and a tokens.ts comment calling school the "campus-operating shell." Doc 01's planned home for it is "teams = locations / departments" — a sub-unit of a school org, no collection, no slug, no shell | **Not a tenant — do not invent it** |
| 7 | **District** | `kind: 'district'`; Phase 3 (PRD non-goal 6: no district/LTI sales motion v1) | Real; IA-now/build-later |
| 8 | **Moyo platform** | Internal; `apps/admin-vite` themed Payload at admin.moyolearn.com (ADR-004) | Real; not a consumer shell |

### Hierarchy (text)

```
Moyo platform (internal Payload admin — no tenant slug, no accent)
│
├── Family ····················· no org row; Guardianships link guardian↔learner;
│                                family plan hangs on the guardian user id
│
├── Organization kind='tutoring'
│     ├── independent tutor ···· org of one (solo=true path, ops-solo)
│     └── tutoring business ···· Memberships {role: RoleKind,
│                                organizationRole?: owner|manager|scheduler|finance}
│
└── Organization kind='district'  (Phase 3)
      └── Organization kind='school'   (district relationship field)
            ├── (campus) ········ NOT modeled — future "teams/locations", copy-only today
            └── Enrollments ····· learnerAuthId → orgId(school) + districtId
                                   (the only learner→institution bridge)
```

Tenant theming: every tenant resolves through `resolveTenantTheme()` (`packages/theme/tenant.ts`) to one CSS-variable shape (`tenantCssVariables`, ~22 `tenant-*` slots); brand accent is a curated token pick (`ember|gold|forest|sky|rose`), never a hex — contrast pre-verified. Role accent is the orthogonal layer: 7 `accentRoles` in `tokens.ts:276` (admin mints nothing on purpose).

---

## §2 · The matrix — tenant × role

Shells are the 7 of `packages/app/providers/session/shell.ts` (`learner · guardian · tutor · teacher · org · school · district`); `owner` and `staff` share `org`. Bands map `AgeBand young/child/teen/adult` ↔ K–2/3–5/6–8/9–12. Primary tasks are PRD §5 "Primary jobs" verbatim-condensed.

| Tenant | Role | Bands applicable | Entitlement source (§4 states) | Device expectations | Shell (of 7) | Primary tasks (PRD §5) | Key screens | Permission boundaries |
|---|---|---|---|---|---|---|---|---|
| Family | Guardian | n/a (sets band-from-grade + `readsAt` per child) | **Family plan buyer** — `family-early-bird` $11 / `family` $15.99, 30-day trial, RevenueCat mobile / Stripe web | Own phone + web; family tablet via FD-24 grown-ups PIN row | guardian | Know the child is safe and learning; visibility without surveillance theater; incident awareness; simple controls; pays | FD-01→05, FD-10→15 (consent→family→learner→plan→handoff→done); `guardian.family-home` · `guardian.reports`(+`[sessionId]`) · `guardian.alerts` · `guardian.family` · `ai-activity` · `memory`; PW-01…PW-08 | **Never sees business tiers** (FR-11.2 structural; FD-22 is the only route rendering them, role-guarded). No secret tutor↔child channel (FR-9.2). Sees own children only (Guardianships). Incident view fixed order, no red frames (doc 31) |
| Family | Learner K–2 (`young`) | K–2 only | Nothing rendered, ever — rides guardian's plan; free floor `canPractise: true` on every status (`entitlements.ts`) | Guardian's device / family tablet (PRD §5); device handoff FD-08 code — **child never types credentials** | learner (3 tabs: Today · Snap · My Stuff) | Get unstuck on homework; hear the tutor (voice-first); feel encouraged, never judged | FD-08/16/17; `learner.today` (hub) · `learner.capture` (raised center) · `learner.stuff`; PW-03b (band copy, **no prices**) | No search, no settings, no prices/purchase controls/store links (PW-03b law); voice-on default + captions (FR-4.5); Safety Plane on every turn; 72px targets |
| Family | Learner 3–5 (`child`) | 3–5 | same as K–2 | First personal device common (PRD §5) | learner (4 tabs: Today · Subjects · Snap · Me) | Homework coaching; visible progress; light gamified mastery | FD-08/16/17; + `learner.subjects`; PW-03b | Same as K–2; 56px targets; progress visible but no engagement mechanics (metric law) |
| Family | Learner 6–8 (`teen`) | 6–8 | same | Own device | learner (5 tabs: Home · Subjects · Snap · Progress · You; resume-first Home) | Real help without condescension; fast capture-to-coaching | + `learner.progress` · `learner.you` (ContextSwitcher mount) · `learner.tutor` · `learner.plan` | Same; 48px targets; FK 6–7 voice gate |
| Family | Learner 9–12 (`adult`) | 9–12 | same | Own device | learner (5 tabs) | Efficient, respectful coaching; subject depth; no cringe | same as 6–8 | Same; no artificial simplification (doc 31); anti-condescension human check (FR-3.3) |
| Independent tutor | Owner+Tutor (one person, two hats) | n/a (serves all four; sees learner band context) | **Org plan** `ops-solo` (org-of-one is the reference; `authorize` requires owner/finance) | Web-first + mobile companion | org **and** tutor (ContextSwitcher between hats) | Session tools, learner context, file incidents, get paid — plus solo CRM/scheduling | FD-03 card 4 → FD-18/19 → FD-20(`solo=true`, skips FD-21) → FD-22; `tutor.tutor-today` · `tutor.notes` (draft queue) · `tutor.session-prep` · `org.overview` · `org.schedule` | Sees own roster/sessions only; tutor drafts need `tutorApprovedBy` (doc 34); CRM wall applies even at n=1 |
| Tutoring business | Owner | n/a | **Org plan** `ops-studio`/`ops-scale` (Studio unlocks `payoutAutomation`); only owner/finance may change plan (`billing-plans.ts authorize`) | Web-first (Cool sidebar); mobile companion 4 tabs | org | CRM, scheduling, payouts, org-scoped safety queues | `org.overview` · ops CRM (Leads/Families/Enrollment) · `org.schedule` · `org.inbox` · `org.safety`; FD-20/21/22; PW-05/07/08 (org variant, seats + Stripe Connect payouts) | **CRM never reads learner data** (PRD principle 9, FR-13.2 LearnerRef wall, lint-enforced) and **never reads incidents** (doc 31); safety queue is org-scoped |
| Tutoring business | Staff (`organizationRole` manager/scheduler/finance) | n/a | Org plan seat | Web-first; mobile companion | org (same shell as owner — `shellForRole`) | (Not a distinct PRD §5 persona — inherits "org staff (ops)" jobs) | Same org surfaces; guard `(org)/_layout.tsx:14` admits `owner \|\| staff` | Same walls as owner. **No UI reads `organizationRole`** — scheduler/finance/manager are indistinguishable on screen today; plan-change authz is the one server-side use |
| Tutoring business | Tutor (employed) | n/a (band context per learner) | Org seat (no personal plan) | Mobile 4 tabs + web grouped sidebar | tutor | Session tools, learner context, file incidents, get paid | FD-09 invite → FD-18/19; `tutor.tutor-today` · `tutor.session-prep` · `tutor.notes` (AdaptivePanes) · `tutor.tutor-profile` | Incidents "mine + my sessions" only (doc 36 §3.3); payouts read-only (Stripe is ledger, FR-11.3) |
| Tutoring business | Guardian (client family) | n/a | **Unmodeled** — family plan vs org-billed is not represented (gap G-9) | Phone + web | guardian | Same guardian jobs | Same guardian surfaces | Same guardian walls; business tiers still never rendered |
| Tutoring business | Learner (client child) | all four | Rides whichever entitlement resolves (see G-9) | As Family learner rows | learner | Same learner jobs | Same learner surfaces | Same learner walls |
| School | School admin | n/a | **Absent** — no school plan exists in `PLANS`; no school-sponsored entitlement (gap G-3) | Web (mobile `(school)` shell ships a 1-tab bar — defect, A-audit) | school | (Not in PRD §5 — no persona row exists; repo shell predates its spec) | `school.school-home` (32-line placeholder) · web `/schools/[slug]`, `/academics` (**InstitutionPlaceholderScreen**, yet in `NAV_BY_ROLE.school_admin`) | k-anon suppression on any aggregate (FR-6.3, `DataTable` `Suppressible` — "Not shown", never zero); FERPA-aligned handling (NFR) |
| School | Teacher | n/a (class grade set at FD-23) | School-sponsored — **absent** (G-3); teacher accounts are free-standing today | Phone + web | teacher (own tree per `shell.ts` — supersedes doc 36 §3.3's "no shell, tokened page only"; delta G-5) | (PRD §5 has no classroom-teacher row; doc 34 gives the share-viewer job) | FD-23 (class + roster via class code = FD-08 `LearnerCodeEntry`); `teacher.teacher-home` (placeholder); web `/teachers/me`; share page `/share/report/[token]` (read-only, blocks 1–6+8, noindex) | Share link is tokened + read-only; no safety content in reports (doc 34); district SSO/LTI is Phase 3 (FD-23 note) |
| School | Learner (enrolled) | all four | School-sponsored — **absent** (G-3); `Enrollments` gives roster, not entitlement | School/home devices | learner | Same learner jobs | Same learner surfaces; joins via class code (FD-08) | Same learner walls; learning data reportable to school/district only through k-anon aggregates |
| District (Phase 3) | District admin | n/a | No sales motion v1 (PRD non-goal 6); no plan exists | **Web only** (doc 36 §3.5); mobile `(district)` group exists anyway with 1-tab defect | district | Outcomes reporting, rostering, compliance answers | `district.district-home` (placeholder); target IA: Outcomes · Schools · Educators · Compliance · Settings; web `/districts/[districtSlug]` | **k-anon suppression** ("Not shown" cells, doc 21/36); Compliance shows incident **counts, never contents** (doc 36 §3.5); default-deny RLS (doc 12) |
| Moyo platform | Platform admin | n/a | Internal | Desktop web | none (themed Payload, graphite, no accent — `tokens.ts` mints no `role-admin`) | Back-office CMS, scoped visibility, canary/version dashboards | `admin-vite` `/admin`, `/admin/*` | Internal roles scoped (FR-14.1); deliberately not a consumer shell (doc 36 §3.6) |

---

## §3 · Multi-context rules

**Model.** `AppSession = { user: AppUser(kind: RoleKind), memberships: Membership[], activeContext }` (`providers/session/types.ts`). A person's wearable roles = own `kind` + each membership's `role`, deduped (`availableRoles`, `shell.ts:62`). Boot: 1 role → its shell; n roles → **last-used shell, never a picker wall** (`resolveBootRole`), persisted sync via MMKV (native) / localStorage (web) in `last-shell.*.ts`; a revoked/stale remembered role falls back to `roles[0]`.

**Combinations one person can hold** (any adult `kind` + memberships): guardian+teacher, guardian+tutor, tutor+business staff (tutor at org A, staff/owner at org B — or both hats at one org, the solo-tutor case), teacher+school_admin, etc. **Learners never multi-hat**: a learner is an account `kind` reached only by code redemption (FD-08), never by membership; multiple learners on one family device are handled by FD-24 profile switch, not by memberships.

**Two distinct switchers, do not conflate:**
- **ContextSwitcher** (`providers/session/context-switcher.tsx`) — hat switch between memberships. Lives in Profile/You (doc 36 §4.3); hidden below 2 memberships (only the `dana` persona qualifies in fixtures). On press it (1) writes `setLastShellRole(membership.role)` *at the moment of choice*, then (2) `setContext({ kind, orgId })` — a **full shell swap**: the guard tree (`Stack.Protected` per group layout) purges the old shell's routes; navigation restarts at the new `SHELL_ROOTS` entry. Labels are human hats ("Maya's parent", "Bright Minds · Tutor"), never db rows.
- **FD-24 Switch profile** (family device) — learner-avatar sheet + PIN/biometric-locked "Grown-ups" row; kid-proof exit. Different mechanism, different threat model; **not built** (no drawer/avatar sheet exists — B-status row H).

**What survives a switch:**
- Survives: the session (`user`, `memberships`), all 33 global Zustand feature stores (in-memory), MMKV-persisted prefs, the last-shell memory, React Query cache.
- Does not survive: navigation state (guard purge + re-dispatch), per-instance vanilla stores (AdaptivePanes selection, Menu, audio — they unmount with the tree), and **`learnerId`/`gradeBand` on ActiveContext** — `setContext` replaces the whole object with `{ kind, orgId }`, dropping both. That is correct for hat switches (a guardian hat has no band) but note band is *already* never populated under live auth (A-audit defect (a)).
- Web extras: `RoleSwitcher` + `ScopeSwitcher` (tenant scope, `DashboardShell` `topBarStart`) are web-only; mobile has no tenant identity/switcher in chrome.
- Deep links: resolve in the correct shell or die silently (`+not-found` → `/`); an incident link opened as a learner goes nowhere (doc 36 §2/§4.4).

---

## §4 · Entitlement states (doc 38 §5B — what every matrix cell's entitlement column reads)

Server truth via RevenueCat/Stripe webhooks → Payload; screens **read** `entitlement.status`, never derive from purchase results. One entitlement id per tier (`family`, `business_*`), mirrored across rails.

| `status` (doc 38 §5B) | Guardian surface | Org surface | **Learner surface** |
|---|---|---|---|
| `none` | Free-tier limits; PW-03a on limit; PW-01 from Settings/Home card | FD-22 entry paywall | Free limits; **PW-03b — no prices, ever** |
| `trialing` | Home card "Free month ends {date}"; PW-02 at T−3 (push+in-app+email) | trial countdown | **Nothing** |
| `active` | PW-05 in Settings; nothing else | PW-05 (+seats, payouts) | **Nothing** |
| `past_due` | Non-blocking banner → PW-05; grace window continues | same (keeps writing — `entitlements.ts` comment: Stripe retries; don't lock a business out of its calendar) | **Nothing** |
| `canceled` (to period end) | PW-05 "Ends {date} · Resume"; no nagging | same | **Nothing** |
| `expired` | PW-04 once (dismissable to free) | lapsed state | Free-tier state |

The learner column is "nothing" for every paid state — binding (00-binding-decisions, doc 38).

**Repo reconciliation:** `packages/auth/src/entitlements.ts` `SubscriptionStatus = none | trialing | active | past_due | canceled | incomplete` — the repo has **`incomplete`** (Stripe's never-started state) and **no `expired`**; doc 38's `expired` (post-period-end, PW-04 trigger) is currently indistinguishable from `canceled` in code. One-state delta to resolve before PW-04 can fire correctly (gap G-7). Invariants the projection already keeps: `canPractise: true` on **every** status (the child's free floor — a lapsed card never takes practice away) and `canExport: true` forever (doc 05 §6 read-only grace).

---

## §5 · Gaps — matrix cells with no repo representation

- **G-1 · Campus is not a tenant.** Three copy/comment hits only (§1 row 6). If campuses ship, they are doc 01 "teams = locations / departments" under a school org — new collection, no new shell. Nothing to design against today.
- **G-2 · Independent (adult self-serve) learner does not exist.** No FD-03 card, no persona in PRD §5, adults attest "18 or older" into guardian/teacher/org/tutor accounts only. `AgeBand 'adult'` = the 9–12 band. If the prompt's tenant list implies this tenant, it is net-new product scope, not a drift fix.
- **G-3 · School-sponsored entitlement has zero representation.** `PLANS` = 2 family + 3 ops; `SubscriptionState.referenceId` is "a guardian's user id or an organisation id"; no school/district plan, no sponsored-seat concept, no "school pays" doc hit anywhere. Consistent with PRD non-goal 6 for districts, but the school shell/teacher FD-23 lane already exists without any entitlement story under it.
- **G-4 · Role-count delta: overhaul 10-role list vs RoleKind's 8.** The overhaul roster (the mobile-role-ux-audit §4 rows): Learner K–2 · Learner 3–5 · Learner 6–8/9–12 · Guardian · Human tutor · Classroom teacher · Business owner · Business **staff/scheduler** · School admin · District admin. `RoleKind` (`types.ts:8`) = `learner, guardian, tutor, teacher, owner, staff, school_admin, district_admin`. Deltas, honestly:
  - The 3 learner rows collapse into one `RoleKind` + `ActiveContext.gradeBand` — by design, **but band is never populated under live auth** (A-audit: `live.tsx:99-104` omits it; capture never reads it), so the band axis of this matrix is currently fictional in production.
  - **Scheduler is not a RoleKind** — it is `MembershipRole` (`owner|manager|scheduler|finance`, `packages/auth/src/membership.ts:16`) on the orthogonal `organizationRole` axis; the only code that reads it is plan-change `authorize`. No screen distinguishes scheduler/finance/manager. **Receptionist appears nowhere** in the repo or pack.
  - Platform admin is intentionally not a RoleKind (Payload, not a shell).
- **G-5 · Shell-count drift across sources.** PRD FR-10.1: "five shells (learner/guardian/tutor/org/admin)." Doc 36: five doors + district (web-only) + admin, teacher = "tokened read-only page — no shell, no login." Repo: **7 shells** (`shell.ts`), including a full `teacher` tree (contradicting doc 36 §3.3) and a `school` shell no pack doc defines. `accentRoles` already mints all 7. The matrix above follows the repo's 7; the pack needs an amendment or the shells need an ADR.
- **G-6 · School and district mobile shells cannot navigate.** `ShellTabBar` silently drops undeclared tabs (A-audit): school renders 1/5, district 1/5, teacher 2/6. District mobile also contradicts doc 36 §3.5 web-only.
- **G-7 · Entitlement status mismatch** — doc 38 `expired` vs repo `incomplete`, no `expired` (§4).
- **G-8 · Child switching does not exist.** Guardian `learnerId` is never set; family screen lists hardcoded Maya/Jordan; FD-24 unbuilt; child-switch state lives only in `ai-activity.store.ts`. The guardian rows' "per child" cells all route through this missing seam.
- **G-9 · Org-client families are unmodeled.** A tutoring business's guardian/learner cells have no entitlement path (org-billed vs self-paid family plan) — no doc, no code.
- **G-10 · No PRD §5 persona for school admin or classroom teacher.** Their matrix rows borrow jobs from doc 34/36 and repo placeholders (`InstitutionPlaceholderScreen`, 32-line landers); primary-task cells for these rows are the weakest-sourced in this file.
