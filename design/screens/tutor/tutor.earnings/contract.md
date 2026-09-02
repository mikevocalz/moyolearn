# Flow Contract — tutor.earnings (PROPOSED-NEW)

```yaml
screen_id: tutor.earnings
role: tutor
tenant: [app, org]
band: n/a
shell: tutor (stack route from You + post-approval affordance; NOT a fifth tab — doc 36 §3.3's four-tab set holds)
entry_points:
  - tutor.you "View earnings" row
  - tutor.notes post-approval affordance (approved report → "View earnings"; the J5 payoff link)
  - push "you've been paid" (payout completed; notification layer unbuilt, contract requires it)
answers_within_5s:
  - How much have I earned this period?
  - When is my next payout and how much will it be?
  - Which sessions am I being paid for (and which approved reports back them)?
primary_action: Review the current period's earnings (session-level ledger, approved-report-linked)
secondary_actions:
  - Open a payout's detail (read-only — Stripe is the ledger, FR-11.3)
  - Open the approved report behind a line item (→ tutor.notes approved item)
exits:
  payout_detail: tutor.earnings (detail within the surface; read-only)
  session_report: tutor.notes
  back: tutor.you
completion_returns_to: tutor.you (read-only surface; "completion" is having reviewed)
back_behavior: "Stack route: back pops to tutor.you (or to tutor.notes when entered from the post-approval affordance)."
failure_paths:
  ledger_fetch_failed: inline retry
  no_earnings_yet: "empty state explains the pipeline honestly ('Earnings appear when your approved session reports are processed') with a live exit to tutor.notes"
  payout_discrepancy: "'Something looks wrong?' contact affordance routes to org.inbox (org-employed) — a money question must have a human exit, never a dead end"
cross_role_propagation:
  - tutor.notes approval → this ledger (approved report = payable line item; server-side accrual)
  - org.money payout run → this ledger's payout rows (org executes, tutor reads)
cross_device_continuity: "Ledger is server truth (Stripe Connect via org payouts); read-only everywhere, so no state to reconcile."
max_interactions_to_primary: 0 (the period summary IS the landing content)
state_owner: "[add] earnings ledger query (React Query over a server projection joining approved summaries → payable sessions → Stripe payout objects). Read-only by law (FR-11.3 'payouts read-only; Stripe is the ledger') — no client mutation store, ever."
```

**Status:** PROPOSED-NEW — **no D-screen-inventory row exists for this screen.** J5 names it as the missing terminal ("no earnings/payout screen anywhere in features/ or apps/; approved reports terminate the chain") and D's tutor group has no row. This contract proposes the inventory row `tutor.earnings` (Tutor · app,org · MISSING); it is counted as ungroundable-at-screen-level in the Phase-2 report until D adds the row.

**Notes:**
- This screen exists so J5 has a payoff: today → prep → room → notes → **approved → paid**. Without it, the tutor's workday ends in an approval toast.
- Strictly read-only: the org side (org.money) owns payout execution; the guardian side never sees any of this; no learner surface is touched.
- For the solo tutor, this surface and org.money describe the same Stripe Connect account from two hats — line-item ledger here, payout-run controls there. Same server truth, two projections.
