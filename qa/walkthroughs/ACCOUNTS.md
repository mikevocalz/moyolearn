# Walkthrough accounts — the §17.4 tenant × role × band matrix, seeded

What it is: the account roster `pnpm --filter web seed:walkthrough` creates for Argent walkthroughs — one real Better Auth account per matrix cell the product can represent, with linked orgs, guardianships, consents, enrollments, entitlements and CRM data.
Why it exists: E-matrix §2 names the cells; walkthroughs need somebody to sign in as for each one. The seed uses the product's own creation paths (`auth.api.signUpEmail`, `createManagedLearner`), so a walkthrough exercises live auth, not the dev-persona fixtures.
Source of truth: `apps/web/scripts/seed-walkthrough.mts` for the data; `docs/design/overhaul-v2/E-tenant-role-band-matrix.md` for the matrix and the gap ledger every skip below cites. Passwords live in the seed script only — never here.
SOT-KEYWORDS: walkthrough accounts qa matrix tenant role band argent seed credentials

Every adult signs in with `walkthrough+<cell>@moyolearn.test` (RFC 2606 `.test` — undeliverable by definition). Learners sign in with a `wt_*` username, never an email (doc 06 §2). Re-running the seed is safe: everything upserts by these keys.

## Tenants seeded

| Org slug | Name | Kind | Notes |
|---|---|---|---|
| — | (family) | — | Deliberately org-less (E §1 row 1); plans hang on the guardian user |
| `wt-solo-tutoring` | Marchetti Math Tutoring | tutoring | Org of one (E §1 row 3), `ops-solo` active |
| `wt-fresh-tutoring` | Fresh Start Tutoring | tutoring | Empty-schedule tutor — no leads, no students |
| `wt-brightpath` | Brightpath Tutoring | tutoring | `ops-studio` active, 6 seats |
| `wt-lakeview-district` | Lakeview Public Schools | district | 10-row CRM pipeline for drill-down |
| `wt-lakeview-elementary` | Lakeview Elementary | school | `district` → wt-lakeview-district |
| `wt-lakeview-high` | Lakeview High School | school | `district` → wt-lakeview-district |

## The matrix

### Family

| Cell | Sign-in | Carries |
|---|---|---|
| Guardian, paid | `walkthrough+family-guardian@moyolearn.test` | `family` plan **active** (period ends run+23d); two children in different bands — Zuri (3–5) and Eli (6–8) — with guardianships and consents |
| Guardian, free | `walkthrough+family-guardian-free@moyolearn.test` | **No** subscription row (`status: none` is absence); one child, Bo (K–2) |
| Guardian, trial | `walkthrough+family-guardian-trial@moyolearn.test` | `family` plan **trialing** (trial ends run+27d); one child, Mira (3–5) |
| Guardian, lapsed | `walkthrough+family-guardian-lapsed@moyolearn.test` | `family` plan **canceled**, period ended run−14d; one child, Ada (9–12) |
| Learner K–2 | username `wt_bo_k2` (Bo Haddad) | Guardian-managed minor of the free family; consent on record |
| Learner 3–5 | username `wt_zuri_35` (Zuri Carter) | Minor of the paid family |
| Learner 6–8 | username `wt_eli_68` (Eli Carter) | Minor of the paid family |
| Learner 9–12 | username `wt_ada_912` (Ada Osei) | Minor of the lapsed family **and** school-linked: active `enrollments` row at `wt-lakeview-high` (practice floor survives the lapse — doc 05 §1.2) |

### Independent tutor (org of one)

| Cell | Sign-in | Carries |
|---|---|---|
| Solo tutor | `walkthrough+solo-tutor@moyolearn.test` | Owner-role member of `wt-solo-tutoring` with `educationRole: tutor`; 3 students (Ivy 3–5 `wt_ivy_solo`, Noel 6–8 `wt_noel_solo`, Kofi 9–12 `wt_kofi_solo`), each with a guardian account (`solo-family-1..3`), guardianship, consent, and an Enrolled/At-risk lead with `learnerRef` |
| Empty-schedule tutor | `walkthrough+empty-tutor@moyolearn.test` | Owner/tutor of `wt-fresh-tutoring`, `ops-solo` active, zero leads and zero students — the empty-state walk |

### Tutoring business (`wt-brightpath`)

| Cell | Sign-in | Carries |
|---|---|---|
| Owner | `walkthrough+biz-owner@moyolearn.test` | `role: owner`, `ops-studio` active with 6 seats (payout automation unlocked) |
| Staff | `walkthrough+biz-staff@moyolearn.test` | `role: scheduler`, `educationRole: staff` — see G-4 skip below |
| Tutor 1 / Tutor 2 | `walkthrough+biz-tutor-1@…` / `walkthrough+biz-tutor-2@…` | `role: member`, `educationRole: tutor`; each owns leads in the pipeline |
| 3 client families | `walkthrough+biz-family-1..3@moyolearn.test` | Guardians of Luca (3–5 `wt_luca_bp`), Hana (6–8 `wt_hana_bp`), Deniz (9–12 `wt_deniz_bp`); 6-row CRM pipeline (3 enrolled with `learnerRef`, 3 mid-funnel) |

### School (`wt-lakeview-elementary` / `wt-lakeview-high`)

| Cell | Sign-in | Carries |
|---|---|---|
| School admin | `walkthrough+school-admin@moyolearn.test` | `role: owner`, `educationRole: school_admin` at the elementary |
| Teacher 1 | `walkthrough+teacher-1@moyolearn.test` | `educationRole: teacher` at the elementary |
| Teacher 2 = multi-context | `walkthrough+multi-context@moyolearn.test` | Teacher membership at the elementary **and** guardian of Sofia (`wt_sofia_elem`) — the guardian+teacher person, see skip below |
| Students + guardians | `wt_sofia_elem` (3–5), `wt_tomas_elem` (K–2) at the elementary; `wt_jun_high` (9–12) at the high school | Active `enrollments` rows with `districtId`; linked guardians `multi-context`, `school-family-1`, `school-family-2` |

### District (`wt-lakeview-district`)

| Cell | Sign-in | Carries |
|---|---|---|
| District admin | `walkthrough+district-admin@moyolearn.test` | `role: owner`, `educationRole: district_admin`; drill-down data: two schools with rosters (4 enrollments carrying `districtId`) and a 10-row district pipeline whose cohorts straddle the k-anon threshold so both suppression branches render |

### Moyo platform

| Cell | Sign-in | Carries |
|---|---|---|
| Platform admin | `walkthrough+platform-admin@moyolearn.test` | A Payload `users` doc — signs into the Payload admin (internal shell, no consumer accent), which is the intended representation (E §1 row 8) |

## Skipped cells — the honest ledger (E-matrix §5 references)

| Skip | E ref | Why |
|---|---|---|
| Campus tenant | **G-1** | Not modeled — copy-level mentions only; no collection, no slug, no shell |
| Independent adult self-serve learner | **G-2** | Not a tenant; FD-03 has no card for it and `AgeBand 'adult'` is the 9–12 band |
| School-sponsored entitlement | **G-3** | No school/district plan exists in `PLANS`; school and district orgs are seeded with **no** subscription rows and teachers are free-standing accounts |
| `expired` entitlement state | **G-7** | `SubscriptionStatus` has no `expired`; the lapsed family is seeded `canceled` with a past `periodEnd`, which is the closest state the repo can express |
| Org-billed client families | **G-9** | Brightpath's families carry **no** plan — family-plan-vs-org-billed is unmodeled, so their learners ride the free floor |
| Distinct scheduler/finance/manager surfaces | **G-4** | `biz-staff` is seeded `role: scheduler`, but no UI reads `organizationRole` — on screen they are generic staff; plan-change authz is the one server-side use |
| Stored learner band | **G-4** (band bullet) / A-audit defect (a) | The live band write path keys `payload.users` by a Better Auth text id against numeric Payload ids, so a band cannot be stored where the live read succeeds. The band axis is carried by one account per band (names + this doc), not by data |
| Guardian hat on the multi-context person | E §3 | Dana's guardianship and teacher membership are both real rows, but live auth derives `kind` from member rows and guardian is only the zero-membership default — the UI boots her as teacher, and ContextSwitcher stays hidden below 2 memberships. Fixture-only today (`dana` persona) |
| Solo tutor's second hat | E §3 / §2 row 3 | One member row carries one `educationRole`; seeded as `tutor` (with `role: owner` keeping the billing gate). The org-owner shell for the same person needs the same multi-membership seam as above |
| Scheduler as a sign-in role of its own | **G-4** | `scheduler` is a `MembershipRole`, not a `RoleKind` — no shell exists to walk |
| District mobile shell | **G-6** | The district admin account exists and web works; the mobile `(district)` group renders 1 of 5 tabs (known defect), so walk district on web |

## Prerequisites and mechanics

- The `member.educationRole` column must exist; the seed applies the additive statement itself (it IS `packages/payload/migrations/member_education_role_additive.sql`, safe to repeat). Production applies the migration file through the normal channel.
- Guard: the seed refuses `NODE_ENV`/`VERCEL_ENV` production, any Vercel/CI runtime, and an auth base URL under `moyolearn.com`.
- `pnpm --filter web seed:walkthrough -- --dry-run` prints this roster without connecting.
- Learner usernames use underscores because Better Auth's username validator rejects hyphens (`[a-zA-Z0-9_.]` only).
