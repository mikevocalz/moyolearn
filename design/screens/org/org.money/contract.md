# Flow Contract — org.money

```yaml
screen_id: org.money
role: owner (owner-gated; finance organizationRole authorizes plan/billing writes server-side — the one place organizationRole is read, E matrix)
tenant: [org]
band: n/a
shell: org (web-first by design — Money rail group `Payouts · Invoices` per doc 36 §3.4; NO mobile tab)
entry_points:
  - "rail: Money group (web — Payouts / Invoices items; ✱ split from the /ops billing blob per G §3.2)"
  - "push: from org.overview 'money' rail jump"
  - "push: from org.crm 'enrolled_invoice' (newly enrolled family arrives ready to invoice)"
  - "push: from org.inbox 'billing_notice' (payment failure / invoice question lands on the affected record)"
answers_within_5s:
  - "What went out and what came in this period (payouts vs invoices)?"
  - "Which invoices are unpaid or failing?"
  - "What will the next payout run pay each tutor?"
primary_action: "Review and approve the current payout run (Stripe Connect execution — the J6 payroll node)"
secondary_actions:
  - "Create/send an invoice to a client family"
  - "Open an invoice or payout's detail (line items link back to sessions and approved reports)"
  - "Retry/chase a failed payment (dunning action on an invoice)"
exits:
  payout_approved: org.money           # run executes; ledger updates in place
  invoice_family_record: org.crm       # the business-side family record (contacts, billing linkage) — business data only
  session_behind_line_item: org.schedule   # a disputed line item opens the session record on the calendar
  back_overview: org.overview
completion_returns_to: self (ledger — approved runs and sent invoices reflect in place)
back_behavior: "Detail → Payouts/Invoices list → previous rail destination (browser history)."
failure_paths:
  offline: "ledger read-only with staleness label; money actions never fire offline"
  no_data: "no billable activity → honest empty state explaining the pipeline (sessions → approved reports → payable work) with a live exit to org.schedule"
  permission: "staff without owner/finance authorization get read-denied on this group (rail item hidden or a 'needs an owner' state — mirror the org.safety permission-denied pattern); plan changes are PW-05/PW-08 territory, not this screen"
  payout_run_failed: "run stays unexecuted with per-line Stripe errors; partial execution is forbidden — all-or-nothing per run"
  payment_failed: "invoice enters dunning state with the retry/chase affordance; past_due never locks the org out of its calendar (entitlements.ts comment law)"
cross_role_propagation:
  - "tutor.notes approval → payable line items here (approved report = payable work; the J5→J6 money join)"
  - "payout execution → tutor.earnings (tutor's read-only ledger shows the payout)"
  - "invoices → client guardian's billing surface — UNMODELED today (gap G-9: org-billed vs self-paid family plan has no representation); until modeled, invoices are org-side records only and the guardian-side rendering is out of contract"
  - "NEVER prices/tiers to any guardian consumer surface (business tiers structurally invisible to guardians, doc 33/FR-11.2) and never anything to learner surfaces"
cross_device_continuity: "All money state is server truth (Stripe is the ledger — FR-11.3); web-only surface, so no mobile reconciliation. Mobile sees money only as inbox notices routing here."
max_interactions_to_primary: 2 (open payout run → approve)
state_owner: "[add] money queries (payout-run + invoice projections over Stripe Connect objects joined to sessions/approved summaries) — nothing exists (J6: 'zero earnings/payroll surfaces'; no invoice object). Chrome via existing useOpsChrome; list prefs via createOpsPrefsStore. Stripe stays the ledger — client stores never own money state."
```

**Status:** PARTIAL, mostly MISSING in depth (D: `org.money` PARTIAL — `/ops` billing section exists; D's action "verify payouts/invoices depth vs doc 36"; J6 marks invoice [M], payment [M], payroll [M]). This contract covers the whole Money group — Payouts (= J6 payroll) and Invoices (= J6 invoice→payment) — as one screen with two rail items; no separate inventory rows exist and none are needed.

**Notes:**
- This is J6's missing money half and J5's org-side counterpart: approved reports (tutor.notes) become payable work here, and payout execution feeds tutor.earnings (PROPOSED-NEW). Without this screen both journeys terminate.
- Consumer subscription billing (family plans) is NOT this screen — that is the PW-* rail (RevenueCat/Stripe consumer) contracted in doc 38. This screen is org revenue (client invoices) and org outflow (tutor payouts) on Stripe Connect.
- The solo tutor sees this surface under the owner hat via ContextSwitcher; the same Stripe account's tutor-side projection is tutor.earnings.
