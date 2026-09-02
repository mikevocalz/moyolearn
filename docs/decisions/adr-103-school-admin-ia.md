# ADR 103: School admin is web-first; mobile parks at Overview-only; no More tab, ever
Status: accepted · Date: 2026-09-01
Accepted: 2026-09-02 — implemented on web; the mobile exists-only re-cut lands in the same push.

<!--
What it is: ADR-c of the G-navigation-maps §6 register — the school-admin IA
for a role doc 36 §3 does not enumerate, and the fate of its mobile shell.
Why it exists: the shipped school layout declares five tabs (including a More
tab) under a citation that actually points at the ORG companion set, renders
one of five, and links a designed dead end (/academics) in live web nav.
SOT: docs/pack/36-role-navigation-flows.md §1 §3.4 ·
     docs/design/overhaul-v2/G-navigation-maps.md §1.6 §3.2 §6 ·
     docs/design/overhaul-v2/E-tenant-role-band-matrix.md §2 §5 G-3/G-5/G-6/G-10 ·
     docs/design/overhaul-v2/C-orphans-dead-ends.md §Web ·
     docs/design/overhaul-v2/H-competitor-mobile-vs-web.md #6 #12 synthesis 4/11
SOT-KEYWORDS: adr school-admin shell tabs overview people academics inbox
              more-tab institution-placeholder fabricated-citation overhaul
-->

## Context

- **Doc 36 §3 enumerates learner/guardian/tutor/org/district/admin — no school role exists in the binding IA at all** (G-navigation-maps §1.6). The repo nonetheless ships a `school` shell (`shell.ts`, 8 RoleKinds — E-matrix G-5) with a 5-tab mobile layout.
- **The shipped mobile layout fails on every axis:** `apps/mobile/app/(school)/(tabs)/_layout.tsx` declares `school-home · people · academics · calendar · more`; its comment cites "doc 36 §3.4" — which is the **org** companion set, another fabricated citation. `More` is the IA failure doc 36 §1 names explicitly ("Overflowing into a 'More' tab is IA failure, not a solution"). It renders **1 of 5** — "a tab bar that cannot navigate" (A-repo-audit; E-matrix G-6).
- **The role has no product ground under it:** no PRD §5 persona (E-matrix G-10 — the weakest-sourced matrix rows), no school plan or school-sponsored entitlement anywhere (`PLANS` = 2 family + 3 ops; G-3), and `school.school-home` is a 32-line placeholder. On web, `/academics` resolves to `InstitutionPlaceholderScreen` — "a designed dead end that is a live nav destination" (C-orphans §Web) — yet sits in `NAV_BY_ROLE.school_admin`.
- **Competitor evidence (H):** school administration is dense web work everywhere it succeeds — PowerSchool's admin SIS is "a dense left-nav web app" with mobile as a guardian/student glance companion (#6); SchoolAI is web-first with a job-organized menu (#12, synthesis #4). H synthesis #11's rejection of crippled mobile applies to *learner and guardian*, whose loop must complete on device — it explicitly permits web-reserving deep institutional surfaces.

## Options

| Option | How it works | Verified seam (file:symbol) | Pros | Cons |
|---|---|---|---|---|
| A — web-first; park mobile at Overview-only | Keep `(school)` route group; ITEMS shrinks to `school-home`; web rail is the role's real home; `/academics` pulled from nav now | `(school)/(tabs)/_layout.tsx:ITEMS` · `apps/web/components/site/nav.ts:NAV_BY_ROLE.school_admin` | Honest about what exists; kills the 1-of-5 defect and the More tab without inventing IA for a persona-less role | Mobile school admin does ~nothing until a later slice |
| B — author a full 4-tab mobile IA now | Derive `Overview · People · Academics · Inbox` from doc 36 §3.4's companion pattern and build the routes | same files | Mobile parity sooner | Builds screens for a role with no PRD persona, no entitlement model (G-3), and placeholder-only content — G-10 says every cell would be guess-sourced |
| C — delete the school shell | Remove the group + RoleKind | `shell.ts` | Purity with doc 36 §3 | FD-23/Enrollments already bridge learners to school orgs (E §1-§2); the tenant is real even if the admin IA isn't ready |

## Decision

**School admin is a web-first role.** The mobile school shell **parks at Overview-only**: the `(school)` route group stays, ITEMS shrinks to `school-home` alone, and no additional tab ships until the role has a PRD persona and an entitlement story (E-matrix G-10/G-3 are the gate, not this ADR). **The web nav pulls `/academics` immediately** — a placeholder screen may not be a live nav destination regardless of any IA decision (C-orphans §Web). The school web rail meanwhile serves only surfaces that exist (`Overview · People · Reports`), grouped through `DashboardShell`'s existing `NavGroup` mechanism like every Cool rail (G §3.2).

**If and when school-admin mobile ships, its IA is bound now to the doc 36 §3.4 companion pattern: four tabs, `Overview · People · Academics · Inbox` — never `More`, never a Calendar tab.** That pre-commitment (G §1.6's proposed target) exists so the next build slice cannot re-improvise a set the way the current one did.

## Consequences

- Easier: the un-navigable 1-of-5 tab bar and the doc-36-§1-condemned More tab die; web nav stops advertising a dead end; the future mobile set is already decided, so no second improvised IA can ship.
- Harder: school admins get a thin mobile experience for at least a phase; authoring the PRD §5 persona and the school-sponsored entitlement model (G-3) becomes the blocking work before any school build slice — this ADR makes that dependency explicit instead of letting screens ship ahead of it again.
- **Required code-comment correction (Phase-2 reconciliation PR):** the header comment in `apps/mobile/app/(school)/(tabs)/_layout.tsx` — "doc 36 §3.4: Overview · People · Academics · Calendar · More" — cites the org companion section as if it defined a school set; it defines no such thing and doc 36 has no school IA. Replace it with a citation of this ADR.
- Follow-ups: shrink ITEMS; remove `/academics` from `NAV_BY_ROLE.school_admin`; pack amendment adding the school role to doc 36 §3 (cite this ADR); persona + entitlement authoring tracked as the gate for any school build slice.

## Default replaced

Register ADR-c's no-ADR default was "park mobile at Overview-only; web rail waits on ADR; `/academics` pulled from nav now." This ADR **adopts the default formally** and closes the part the default left waiting: the future mobile set is fixed to `Overview · People · Academics · Inbox`, and the interim web rail is the exists-only three items.

## Constraints honored
Zustand-only · tokens-only · no invented APIs (`NavGroup` reused for the rail) · doc references (36 §1/§3.4 · G §1.6/§3.2 · E §5 G-3/G-5/G-6/G-10 · C-orphans §Web · H #6/#12, synthesis 4/11)
