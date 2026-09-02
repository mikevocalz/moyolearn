# ADR 109: Family becomes a first-class household object
Status: accepted · Date: 2026-09-02
Accepted: 2026-09-02 — lands with this commit.

<!--
What it is: the household-record decision the /families surface deferred — whether
doc 28 §2's Family (household) object exists as an org-scoped row this codebase
can open, or stays a server-derived grouping of the pipeline by its family text.
Why it exists: family-groups.ts, families-content.tsx, the families route and the
org.crm contract all independently record the same deferral — "a future ADR builds
the household record and makes rows openable." This is that ADR.
SOT: docs/pack/28-crm-spec.md §2 (object model) ·
     design/screens/org/org.crm/contract.md (the wall) ·
     packages/payload/src/collections/Families.ts
SOT-KEYWORDS: adr family household object crm families guardian contact learner
              ref pointer wall org scoped backfill family id stamp
-->

## Context

- **The /families rail destination is a dead end by design.** Doc 28 §2 specifies
  **Org → Family (household) → GuardianContact** and **LearnerRef** as first-class
  objects, and none of them existed as collections. Rather than fake a household
  schema, the surface shipped as a DERIVATION: leads grouped server-side by their
  `family` string (`familiesFrom` in family-groups.ts). Deliberately shallow — a
  group was not openable, because there was no household object behind it to open.
- **The derivation's own limits are structural, not cosmetic.** A grouping key
  that is display text cannot carry contacts, cannot survive a rename without
  splitting the household, cannot exist with zero pipeline rows, and gives the
  org.crm contract's "Open a lead/family record" secondary action nothing to open
  on its family half.
- **The wall bounds what a Family row may be** (doc 23 / doc 31 / PRD principle 9,
  lint-enforced by `tooling/check-crm-wall.mjs`): CRM rows hold relationship,
  scheduling, attendance, and billing context — never learning content. Family
  records are BUSINESS objects. Doc 28 §2 places GuardianContact on the CRM side
  as the household's comms identity — name, relationship, email, phone are
  business contact data and ALLOWED here. LearnerRef is a *pointer* to the
  identity docs, and must stay one.

## Options

| Option | How it works | Verified seam (file:symbol) | Pros | Cons |
|---|---|---|---|---|
| A — `Families` collection + stamped `familyId` on leads | An org-scoped row per household (name unique per org, contacts array, learnerRefs as text); leads gain an indexed `familyId` stamped at create and backfilled | `packages/payload/src/collections/Families.ts` (new, Leads' conventions) · `apps/web/lib/families.repository.ts` | The doc 28 §2 object as data; rows openable; renames stop splitting households; contacts have a home; upsert-by-name keeps the create flow one field | A second CRM collection and a backfill to stamp |
| B — keep the derivation | `/families` stays a grouped read over leads | `packages/app/features/ops/family-groups.ts` | Zero schema | Every limit in Context is permanent; the contract's family record never opens |
| C — Payload `relationship` from families to learner collections | Model LearnerRef as a join | — | "Proper" relational modeling | **Banned by the wall.** A relationship hands every ops query a populated join into learner identity; doc 28 §2 makes LearnerRef a pointer precisely so the CRM cannot traverse it |

## Decision

**Family becomes a first-class org-scoped row (option A), per doc 28 §2.** The
`families` collection carries `orgId` (indexed), `name` (the household label,
unique per org — the upsert key), a `contacts` array of GuardianContact business
records ({name, relationship, email?, phone?}), and `learnerRefs` — text pointers
to the identity docs, never a Payload relationship. `leads` gains an additive,
indexed, nullable `familyId` (a pointer by convention, like every cross-collection
reference in this schema); the display `family` text stays, because the pipeline
grid renders it on every row and a display string is not a join.

**The name-text derivation retires.** `listFamilies` reads family rows and
attaches a stage rollup computed over the family's leads; the pure rollup math in
family-groups.ts survives as the tested helper, its "no household object"
deferral comments becoming descriptions. Lead creation upserts the household by
`(orgId, name)` service-side — ctx-scoped, never client-chosen — and stamps
`familyId` on the new row. The backfill stamps existing pipelines idempotently
(INSERT missing households, then fill NULL `familyId` cells only — additive
stamping of a nullable column, not destructive DML).

**The wall holds structurally:** learner linkage stays text refs; no relationship
fields into learner collections exist on the row; and the new
`families.repository.ts` registers in `check-crm-wall.mjs`'s `CRM_ROOTS` in the
same commit — a CRM file outside the roots is silently unwalled, which the
scoping recorded as exactly how the wall would fail.

## What this deliberately does NOT solve

- **The Activity object** (doc 28 §2's timeline — notes, calls, emails, SMS,
  consent-scoped per doc 14 T4) stays unbuilt. A family record opens with no
  notes and no stage history, and says nothing that pretends otherwise.
- **Consent-scoped comms.** Contacts are inert business records; nothing sends
  to them. The consent check arrives with the Activity/automation work
  (doc 28 §4), not with this row.
- **LearnerRef resolution.** Refs display as refs. There is no supported way to
  render a learner's name, sessions, or anything else from a CRM surface.
- **Household merge/rename tooling.** Two spellings backfill as two households;
  fixing that is an ops edit, not a migration's guess.
- **Health scoring (doc 28 §6)** still writes per-lead `needsAttention`; the
  family rollup only aggregates it.

## Consequences

- Easier: `/families` rows open to a real record; contacts are editable business
  data; the org.crm contract's family half of "Open a lead/family record" goes
  live; a renamed household keeps its stamped leads.
- Harder: two write paths must agree on the stamp (create-time upsert and the
  backfill) — both key on `(orgId, trimmed name)`; a lead written by a stale
  deployment lands unstamped, so the read model keeps a name-match fallback for
  rows the stamp has not reached.
- The migrations are hand-extracted and additive (`families_additive.sql`,
  `leads_family_id_additive.sql`), for the reason every sibling records: no
  migration baseline, so `payload migrate:create` re-emits the world.
- Follow-ups: the Activity object ADR when doc 28 §2's timeline is built; an
  enrollment/billing linkage read when org.money consumes `familyId`.

## Default replaced

The prior default was recorded in four places as "doc 28 §2's Family/
GuardianContact objects remain unbuilt — a future ADR builds the household
record and makes rows openable" — a deferral, not a design. This ADR replaces
that recorded silence with the household row itself; the derivation's decision
comments become descriptions.

## Constraints honored
Identity never a parameter (`orgId` off `ctx` at every seam; upsert ctx-scoped) ·
pointers not FKs or relationships (doc 13 §5, doc 28 §2's LearnerRef) · the wall
lint sees the new root (`CRM_ROOTS` gains the repository in the same commit) ·
no invented APIs (Leads/Classes conventions reused) · doc references (28 §2 ·
23 §2 · 31 §4.2 · 13 §5)
