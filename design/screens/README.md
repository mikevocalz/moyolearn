# Screen Flow Contracts — directory convention + template

What it is: Phase-2 Flow Contracts, one directory per product screen, written against the Phase-1 audit (docs/design/overhaul-v2/).
Why it exists: nothing gets designed, built, moved, or deleted without a contract; contracts precede design (MISSING screens get contracts first).
Source of truth: docs/design/overhaul-v2/D-screen-inventory.md for screen IDs and classification; G-navigation-maps.md for reconciled navigation; F-journey-maps.md for the chains each contract must support; E-tenant-role-band-matrix.md §3 for context-switch semantics; docs/design/overhaul-v2/00-binding-decisions.md for the laws.
SOT-KEYWORDS: overhaul, flow-contract, screen-contract, phase-2, contract-template

## Directory convention

```
design/screens/<role>/<screen-id>/contract.md
```

- `<role>` = the shell owner (`learner`, `guardian`, `tutor`, `teacher`, `org`, `school`, `district`, `sys`).
- `<screen-id>` = the D-screen-inventory row ID verbatim (`learner.home`, `guardian.alerts`, …).
- FD-*/PW-* screens have **no directory here** — doc 38 §5's per-screen specs are their contracts (00-binding-decisions §Doc-38: "reuse, don't re-author").
- Band-variant screens get **one contract** with a `## Band variants` section describing what changes per band — never one file per band. `learner.home.k2` lives inside `learner/learner.home/`.
- Rows classified DUPLICATED or slated for removal by G-navigation-maps still get a contract: a **disposition contract** that records where the content migrates and grounds the deletion. Do not design against a disposition contract.

## Contract template

Every `contract.md` opens with exactly this YAML block (all keys present, in this order), then a `Status` line, then `Notes`:

```yaml
screen_id: <D-inventory row ID>
role: <shell role>
tenant: [<app|org|school|district|any>, …]
band: <K-2 | 3-5 | 6-8 | 9-12 | combination | all | n/a>   # n/a = adult role, band axis does not apply
shell: <one of the 7 shells in packages/app/providers/session/shell.ts, or none>
entry_points:            # EVERY real way in, grounded in G's reconciled maps + F's chains
  - "tab: …"             # reconciled tab position
  - "push: from <screen_id> …"
  - "deep_link: …"
  - "back_from: <screen_id>"
  - "flow: <FD-* step> …"
  - "system: …"          # cold launch via sys.dispatch, push notification, etc.
answers_within_5s:       # ≤3 questions a user can answer within 5s of landing
  - "…?"
primary_action: "exactly one"
secondary_actions: []    # ≤3
exits:                   # action → screen_id; every value MUST be a D-inventory ID
  <action>: <screen_id>
completion_returns_to: <screen_id | self (hub)>
back_behavior: "…"
failure_paths:
  offline: "…"
  no_data: "…"
  permission: "…"
cross_role_propagation:  # what state leaving/entering this screen reaches other roles' surfaces
  - "…"
cross_device_continuity: "…"
max_interactions_to_primary: <n>
state_owner: "<existing store from the audit's 33-store list | <name>.store [add] | AdaptivePanes per-instance store (useInstanceStore)>"
```

Below the YAML:

- `**Status:**` — route EXISTS / PARTIAL / MISSING per D-screen-inventory (carry the classification verbatim: COMPLETE, ORPHAN, DUPLICATED, NEEDS-UX-REWORK, …).
- `**Notes:**` — contract-relevant defects only (band bug, orphaned tabs, fixture data, nav collisions), each grounded in an audit doc.
- Optional `## Band variants` — per-band deltas for band-adaptive screens.

## Laws every contract must satisfy

1. **No dead ends** — ≥1 forward exit on every screen (`completion_returns_to` counts).
2. **Exactly one `primary_action`** (disposition contracts mark it `n/a — REMOVED/DUPLICATE` and say where it went).
3. **Learner screens are never panes** (doc 37 §3.3 ban; ADR-g default holds).
4. **K–2: no search, no settings** (doc 36 §3.1); K–2/3–5 keep all settings guardian-side.
5. **Learner surfaces never show prices, purchase controls, or store links** (PW-03b law, doc 38 §5B — learner entitlement column is "nothing" for every paid state).
6. **Guardian Alerts is its own surface, separate from Messages, never under a bell** (doc 36 §3.2).
7. **Camera (Snap) is the raised center tab on every learner band** (doc 36 §3.1).
8. Every `exits` value is a screen ID that exists in D-screen-inventory.
9. `state_owner` names an existing global Zustand store (A-repo-audit: 33 exported stores across packages/app features/providers/ui) where one fits; otherwise a proposed name marked `[add]`; the per-instance `useInstanceStore` pattern (AdaptivePanes selection) is a valid owner for pane selection state.
