# ADR-122: local inference routes through the gateway that already exists

Status: proposed. The shape is decided by what is already in the repo; the
task→backend policy inside it needs device measurements that this branch cannot
produce.
Date: 2026-09-17

## Context

The migration brief asks for a `LocalInferenceRouter`: features request a
capability, a pure decision function picks runtime and model variant, and no
feature imports `react-native-executorch` or `runntime` directly.

Half of that already exists, for the cloud. `packages/inference` is a routing
layer with `gateway.ts`, `routing.ts`, `budget.ts`, `provider-policy.ts` and
`pseudonymize.ts`. Its `routing.ts` is a checked-in `as const` table — "which
model does which job (doc 12 §7)" — and its header argues the principle the brief
is reaching for independently:

> It is a checked-in `as const` map rather than config … which model teaches a
> child is a decision that belongs in a reviewed commit, not in a deploy variable.

It also already models cells that route calls nobody makes yet, deliberately,
"because the shape of the table is what makes the day they land a routing change
instead of a design."

The other half — local — has no abstraction at all. Features import ExecuTorch
directly:

| File | Uses it for |
|---|---|
| `packages/app/features/capture/transcribe.native.ts` | speech-to-text |
| `packages/app/features/capture/native-ocr-evidence.ts` | OCR |
| `packages/app/features/capture/read-attachment.native.ts` | attachment reading |
| `apps/mobile/src/executorch.native.ts` / `.ts` | platform-forked bootstrap |

CLAUDE.md is unambiguous about which way this resolves: *"verify the pattern
exists before using it; never invent a second way to do something that already
has a way."* A second router beside `packages/inference` would be exactly that.

## Options

| Option | How it works | Verified seam (file:symbol) | Pros | Cons |
|---|---|---|---|---|
| **A. A new `LocalInferenceRouter` package** | As the brief describes, parallel to `packages/inference` | — (new construction) | Matches the brief literally; local concerns stay out of a cloud-shaped module | Two routers, two policy tables, two places to ask "where does this task run". The cloud escalation path in §14/§23 then has to bridge them anyway |
| **B. Extend `packages/inference`** | Local backends become entries in the existing table; `LocalInferenceTask` joins the capability union; the gateway gains local adapters beside the Anthropic one | `packages/inference/src/routing.ts` (the `as const` table), `gateway.ts`, `provider-policy.ts`, `budget.ts` | One place answers "which model does this job", cloud and local. The escalation the brief wants — OCR confidence low → cloud — becomes a routing cell rather than a cross-module handoff. Inherits pseudonymization and budget, which local work will need the moment it escalates | The module is currently vendor-shaped (`anthropic.ts`); local backends bring device capability and thermal inputs into a layer that has never needed them. `budget.ts` means tokens and money, which is meaningless for a local call |

## Decision

**Proposed: B.** The decision function stays pure and unit-testable as the brief
requires, and it lands as a capability union in `routing.ts` rather than a second
table in a new package.

The one thing not folded in is **admission control**. Deciding *where* a task runs
is routing; deciding *whether it may run right now* against Natalie's frame
budget is scheduling, and it depends on thermal state, frame time and GPU
headroom that have nothing to do with model selection. That belongs in its own
Zustand store, not in `routing.ts`.

## Consequences

- **Easier:** one answer to "which model does this job". Cloud escalation is a
  cell, not a bridge. Local calls inherit pseudonymization and provider policy
  instead of growing their own.
- **Harder:** `packages/inference` currently has no reason to know about devices,
  delegates or thermal state, and it will. `budget.ts` needs a stated position on
  local calls rather than an implicit one — a local inference call costs battery
  and thermal headroom, not tokens, and the table should say so rather than
  leaving a zero.
- **Follow-ups:**
  1. Capability union first, adapters second — the table's shape is the
     deliverable, per its own header.
  2. Move the four direct ExecuTorch import sites behind it. They are the
     regression test for whether the seam is real.
  3. `react-native-executorch` 0.9.3 → 0.10.2 is a ground-up rewrite with a
     `legacy` entry point (`docs/compute/versions.md`); doing it behind the
     adapter is the point of having one.
  4. Admission control as a separate store, with the degradation order from the
     brief's §22 as named states.

## Constraints honored

Zustand-only for the new scheduling state · no invented APIs — every seam cites a
repo file · the existing pattern wins over the brief's parallel structure, per
CLAUDE.md.
