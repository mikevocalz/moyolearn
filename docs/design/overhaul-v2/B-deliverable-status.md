# Overhaul v2 — Deliverable B: §17.1 Deliverable Status & Reconciliation

What it is: verdict per overhaul deliverable against artifacts already in the repo, so nothing is redone and nothing stale is trusted.
Why it exists: the repo carries substantial prior audit/design work (Aug 26–30); some is authoritative, some is materially overtaken.
Source of truth: this file for status; the cited artifact for content.
SOT-KEYWORDS: overhaul, deliverable-status, reconciliation, do-not-redo, staleness

## Verdicts

| §17.1 deliverable | Verdict | Where / gap |
|---|---|---|
| A Repo audit | **DONE (fresh)** | `overhaul-v2/A-repo-audit.md` (2026-09-01). Prior: `docs/38-audit.md`, `docs/design/{mobile,platform}-role-ux-audit.md` — overtaken in ≥5 top findings (see Staleness) |
| B Screen inventory | **PARTIAL** | Front door DONE with IDs: doc 38 §3 (26 FD + 8 PW). Rest: route-level tables in role-UX audits, pre-date new shells; no unified ID scheme across FD-*/PW-*/S-numbers |
| C Orphan/dead-end report | **DONE (fresh)** | `overhaul-v2/C-orphans-dead-ends.md` |
| D/E Tenant×role(×platform) matrix | **PARTIAL** | Role×task DONE ×2 (both role-UX audits §4). **Tenant axis absent from every doc** (code has it: `packages/theme/tenant.ts`) |
| F Role×band matrix | **PARTIAL** | Bands as learner rows in §4 tables; `tutor-session-qa-matrix.md` §2 pins band→label→presence→voice→target |
| G Mobile tab map | **DONE but stale** | `route-audit-36.md` §3 (Mobbin-referenced) — predates guardian's 7 tab files and teacher/school/district shells. Reconcile against doc 36 §3 + the actual layouts |
| H Account sheet / drawer map | **ABSENT** | No drawer exists in apps/mobile; no avatar sheet; header avatar is dead code |
| I/J Web rail + utility bar map | **PARTIAL** | `docs/design/mobbin/web-role-shells.md` (rail decision record); no utility-bar map; DashboardShell slots are the seam |
| K Tablet/AdaptivePanes map | **DONE (doc-level)** | doc 37 §3.3 + `pane-audit-37.md` (§B historical — subject dir deleted, module promoted). Adoption gap: 2 consumers, no app mounts |
| L Journey maps | **PARTIAL** | Front door only (doc 38 §1). The five `seq-*.md` files are service sequences, not user journeys. Core learner loop / guardian weekly / tutor day / org ops absent |
| M Flow Contracts per screen | **DONE (fresh)** | `design/screens/` — 63 contracts: 61 covering every D-inventory product row (commits c2d470b + 0ec080f) + the 2 marketing disposition rows (2026-09-02). FD-*/PW-* screens have no directory by design — doc 38 §5's per-screen specs are their contracts (design/screens/README.md line 16; 00-binding-decisions "reuse, don't re-author") |
| N Mobbin research matrix | **PARTIAL** | DONE adopt/refuse for 3 app surfaces (`docs/design/mobbin/`: capture-flow, ocr-review, web-role-shells) + 9 marketing passes (`docs/site/mobbin/`). Front door is link-level only. **8 flows explicitly deferred** (never inspected — plugin was down): Khan ×2, Duolingo ×2, Google homework, Quizlet scan, ChatGPT Voice ×2 (`tutor-session-research.md` §4) |
| O Competitor mobile-vs-web summary | **ABSENT** | — |
| P Design-system audit | **DONE — authoritative** | `ui-inventory.md`, `ui-drift-report.md` (+addenda), `ui-migration-plan.md`, `ui-promotions.md`; regenerable via `pnpm ui:sweep`. Headline numbers superseded by addenda |
| Q Token system doc | **PARTIAL** | `docs/site/tokens.md` marketing-scoped; app tokens defined in code only. Doc 38 §5 Phase 0 acknowledges the missing token-role mapping |
| R Component plan | **PARTIAL** | Front door: doc 38 §8. Marketing: `docs/site/component-inventory.md`. Absent for the app at large |
| S Implementation plan w/ phase gates | **ABSENT** (this overhaul's §17.2 is the frame) | — |

## Do not redo (authoritative prior work)

- `pnpm ui:sweep` measurements — script checked in, self-invalidating; if a doc number disagrees with the script, the doc is wrong.
- The identifier-vs-import-edge correction (`ui-inventory.md`): the "33 unused exports" all have internal importers; **count import edges, not identifiers**. Nothing in ui is dead.
- The Heading/Text drift split (`ui-drift-report.md`): Heading = real drift (top string `size="title"` retyped, 92% in six strings); Text finding mostly retracted (two components share the name; post-Phase-3 real numbers 13 and 46).
- The three Mobbin adopt/refuse passes (capture-flow, ocr-review, web-role-shells) and doc 38's 34-screen inventory + per-screen specs.
- Both role×task coverage maps — re-run against the new shells, don't rebuild the method.
- Non-actions deliberately preserved: don't delete the 33 internal exports (propose `./internal` subpath), don't touch `tv.ts`, `gap-N` Phase 4 stays report-only.

## Known-stale claims (verified overtaken)

- `38-audit.md` "doc 38 absent / audit blocked" → doc 38 exists (97KB, Aug 29).
- `pane-audit-37.md` §B analyses a deleted directory → module promoted to `packages/ui/adaptive-panes/`.
- "Teacher/school/district have no mobile shells; RoleKind stops at owner" → fixed; 8 RoleKinds, 7 shells.
- "SiteFooter exposes Storybook/Payload/README links" → fixed.
- "web (site) mixes all roles under one layout" → restructured into per-role groups.
- Guardian tabs "Home·Reports·Alerts·Family" → guardian now has 7 tab files (and Alerts is currently unreachable).
- Still true: `DEMO_DAY` fixtures in schedule/conference; handoff mock short-circuit; hardcoded `parent-home.data.ts` children.

## Highest-value unclaimed work (Phase-1/2 queue)

1. ~~Live WCAG failure~~ **FIXED (2026-09-01)**: selected schedule events now ink-on-accent (`text-on-accent` on `bg-{accent}-400`; worst pair forest 5.80:1, was ember 3.44 white-on-500). `check-contrast.mjs` now derives its pairs (`on-*` × fills, `accentRoles` × ink at 14:1, `resourceAccents` × the schedule's real classes) — derivation also caught and fixed `role-teacher` at 13.09:1 (re-minted `#FFD5C4`, 14.45:1; the old hand list stopped at five roles).
2. Unified screen inventory with one ID scheme (extend FD-*/PW-* convention product-wide).
3. Tenant axis → full tenant×role×band matrix.
4. Journey maps beyond the front door (chained contracts, §4.4 of the overhaul prompt).
5. The 8 deferred Mobbin flow inspections.
6. ~~Band population fix~~ **FIXED (2026-09-01/02)**: `4dcdbdb` — live auth now reads `users.gradeBand` via `GET /api/learner/profile` in `providers/session/live.tsx` and passes it to `setPersona`; mobile capture route wraps `CaptureScreen` with the session band. `8fb2b78` — web capture reads the session band; context/scope switchers preserve `gradeBand` across switches. (A-repo-audit "Band handling" defects (a)+(b), both closed — resolution note appended there.)
