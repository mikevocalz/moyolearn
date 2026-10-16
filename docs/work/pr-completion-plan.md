# MoyoLearn PR completion plan

<!-- What: delivery order and evidence gates for the open PR queue. -->
<!-- Why: preserve dependencies and record a handoff and commit after each phase. -->
<!-- SOT: GitHub PRs #99 and #101–#123; their branch contracts; AGENTS.md. -->
<!-- SOT-KEYWORDS: pr completion plan phases handoff merge business homework language -->

## Scope and working copy

Requested on 2026-10-16: finish the open PRs, use the normal skills and the skills
specified in each PR, commit a handoff after each phase, then merge to main.
The inventory contains 24 draft PRs. No PR is complete merely because its current
diff contains documentation.

Worktree: `/Users/mikevocalz/moyolearn-pr-completion`.
Coordination branch: `finish/pr-completion-20261016`.
Starting main: `a6afe6593060b73c8fc7b61d2ee0e0800204f1f3`.
The original `/Users/mikevocalz/MoyoLearn` checkout contains substantial
uncommitted XR/native changes; those changes are outside this worktree.

The user's instruction authorizes merging completed PRs. Existing draft labels
do not waive the acceptance criteria or justify merging incomplete features.
Preserve PR branches and use ordinary merge commits when bringing main forward;
do not rebase, force-push, or overwrite other working copies.

## Phases

| Phase | PRs | Deliverable and exit criteria |
| --- | --- | --- |
| 0 | All | Inventory, dependency order, skills gaps, baseline install/typecheck, committed plan and handoff. |
| 1 | #101 (MB-01), #99 | Verify architecture owners against code; finish adaptive research and its acceptance matrix; distinguish design decisions from implemented behavior. |
| 2 | #102–#106 (MB-02–06) | Business shell/deep links, organization profiles, billing presentation, tenant/role wall, verified CRM/import continuity. Preserve existing prices, children’s surfaces, host policy and read/export after lapse. |
| 3 | #108–#110 (MB-07–09) | Durable scheduling, capacity, agreements, attendance and credit ledger. Prove conflict races, retries, DST, corrections and tenant isolation using real persistence. |
| 4 | #111–#112 (MB-10–11) | Invoices/payment reconciliation and separately approved payables. Verify test-mode payment/refund/payout and duplicate-event behavior. Never equate an invoice with collected cash. |
| 5 | #114–#117 (MB-12–15) | Persisted campaigns/consent, native PhotoCraft, calendar sync, accounting/events. Preserve canonical schedule, dedupe/reconciliation, unsubscribe and no learning-data marketing joins. |
| 6 | #118–#120 (MB-16–18) | Real reports/exports, scoped school/district operations, service-business profile and launch hardening. Reconcile financial quantities; distinguish missing data from zero; verify rollback and imports. |
| 7 | #107, #113 | Review inference candidate admission/fallback and evaluation-only model controls. Keep production routing gated on provider and subject/grade evaluations; enforce deny-by-default admin access and migration consistency. |
| 8 | #121, #122 | Server-owned language enrollment/selection, lessons and speech/transcript review. Verify typed native/web speech APIs, locale propagation, RTL/scripts and human-transcribed samples. Transcription is not pronunciation assessment. |
| 9 | #123 | Complete homework crop metadata, guardian upload/timeline UI, per-question resume/reports, practice print/share and native/browser evidence. Check migrations on isolated data before production changes. |
| 10 | All | Reconcile branches against current main, review final diffs, run required CI and targeted runtime gates, commit final handoff, then merge completed PRs in dependency order and verify GitHub merge SHAs. |

Within a phase, commit each completed PR-sized slice with its evidence and update
the handoff. Later independent slices may proceed while an external prerequisite
blocks an earlier slice, but dependent features cannot be called complete.

## Per-PR procedure

1. Read the complete PR body, review threads, diff, local instructions and linked
   contracts. Record what exists versus what its exit criteria still require.
2. Load relevant installed skills and the PR-specific skill sources. Record
   unavailable named skills explicitly; a similarly named skill is not proof
   that the requested source was read.
3. Before UI implementation, produce the requested task/state spec, component and
   token map, final copy, accessibility requirements and reference research.
   Reuse existing semantic UI, stores, routing and platform adapters.
4. Implement the missing behavior and regression coverage in existing test homes.
   Review authorization, cross-tenant isolation, retries and interrupted flows.
5. Run a frozen install, cold-cache root typecheck, relevant lint/tests/builds,
   and runtime/device scenarios required by the changed surface. Record exact
   commands and results. Separate unit, browser, simulator and physical evidence.
6. Review the diff with CodeRabbit after inspecting for secrets. Address material
   findings and verify again. Attach the evidence and handoff before committing.
7. At the final merge phase, recheck current PR heads/checks, mark completed drafts
   ready, merge without bypassing required checks, and verify merged state.

## Skills and tooling inventory

Loaded at intake: `code-review`, `verification-before-completion`,
`coding-standards`, `expo-overview`, Software Mansion
`react-native-best-practices`, `turborepo`, `no-ai-slop`, and `monid`.
Read the pinned tailored foldable skill from the local
`universal-spatial-starter` Git object at commit
`256a97b132803fd2fb8049f7a120cef9cb641f41`. Moyo's explicit Legend Motion/GSAP
instructions take precedence over that skill's generic motion recommendation.

CodeRabbit CLI 0.7.6 is installed and authenticated. GitHub CLI can read the repo.
Argent MCP is configured and exposes device tools; no device has been used.
Monid discovery found paid generic GitHub endpoints; the authenticated GitHub CLI
already supplies the repository data required here.

Named PR skills `user-research`, `design-handoff`, `design-system`, `ux-copy`,
`accessibility-review`, `design-critique`, `architecture`, `system-design`,
`testing-strategy`, and `deploy-checklist` were not found by the initial project
and common user-skill path searches. Exact source discovery remains necessary.
The PRs explicitly require recording unavailable skills rather than claiming
they were loaded. Existing specialist skills will be loaded as each slice starts.

## Known evidence gaps at intake

- The 18 Business PRs currently contain roadmap contracts; their runtime exit
  criteria include substantial implementation and provider/device checks.
- #123 reports native build/print/share and guardian UI gaps, null crop metadata,
  and a production migration still unapplied. These are claims from the PR,
  pending independent verification.
- #121/#122 require multilingual content/sample and device evidence not supplied
  by a successful typecheck.
- #107 requires model admission/evaluation evidence before production selection.
- Physical-device, payment-provider and production-migration results must never
  be inferred from mocks or documentation.

Progress and commands are recorded in `pr-completion-handoff.md`.
