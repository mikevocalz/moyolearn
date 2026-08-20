# Architectural Guardrails — Moyo (stack-native, no new dependencies)
**Doc 11 (v2) · Moyo platform pack · Date:** Aug 20, 2026
**Decision: no tRPC.** The guardrail methodology is adopted as *discipline and enforcement*, implemented with the stack already in the repo. §2 explains why nothing is lost.
**Grounded in the repo** (read this session): `tooling/generators/gen.mjs`, `packages/app/eslint.config.mjs`, `packages/app/features/*`, `packages/payload/src/collections/*`, `packages/ui/Button.tsx`, `packages/theme/tokens.ts`.

---

## 1. The finding that shapes this doc: the architecture is already in your generator
`pnpm gen domain <name>` emits, today, exactly the layered shape the methodology prescribes:

| Emitted path | Its own header comment | Guardrail concept |
|---|---|---|
| `repository/<name>.repository.ts` | *"The ONLY code in this domain that touches @acme/payload"* | **database isolation** |
| `services/<name>.service.ts` | *"Orchestration, cross-repo composition, business rules"* | **service layer** |
| `permissions/<name>.permissions.ts` | *"Uses packages/app/permissions core; no inline role checks"* | **the registry / one permission source** |
| `queries/<name>.keys.ts` | *"single source of truth for keys"* | globalization, client cache |
| `index.ts` | *"Public API — nothing deep-imported from outside"* | module boundary |

Plus the generator **refuses to overwrite an existing file**. So the pattern isn't documented-and-hoped-for; it's *emitted*, which is stronger than any CLAUDE.md sentence.

**Therefore this doc adds three things only:** (a) the missing shared primitive every service calls, (b) lint rules that turn those header comments from requests into build errors, (c) the working discipline that keeps quality from decaying across sessions. No new architecture, no new dependencies.

## 2. End-to-end types without tRPC
tRPC's real product is typed server→client inference across a network boundary. In this monorepo that's already available:
1. Services declare explicit input/output types (doc 10 §2.3: exported functions carry explicit return types).
2. The client imports those types **type-only** — `import type { ListSessionsOutput } from '@acme/app/scheduling'`. `verbatimModuleSyntax` (doc 10 §2.1) guarantees the import is erased at build, so **no server code can reach the bundle**.
3. A thin typed fetch wrapper carries them over HTTP for native (which has no server-action path), generic over the operation's declared types.
4. TanStack Query — already installed, with the generator's key factory — is the client cache layer.
Result: one type definition, checked on both ends by `turbo typecheck`, zero runtime dependency. If a boundary ever drifts, the build breaks, which is the whole thesis.

## 3. The Block — a plain function, no framework
Lives in `packages/app/core` (new, tiny) beside the existing permissions core. Every service operation is wrapped in it; nothing else reaches a repository.

```ts
// core/protected-operation.ts — the ONE gate. Services call this; nothing calls a repository directly.
export function protectedOperation<TInput, TOutput>(config: {
  resource: ResourceKey                 // from the registry — not a string literal
  action: PermissionAction
  input: Schema<TInput>
  rateLimit?: RateLimitPolicy
  handler: (args: { ctx: OperationContext; input: TInput }) => Promise<TOutput>
}): (raw: unknown) => Promise<TOutput>
```
Gate order inside it — the list the agent no longer has to remember, because the types demand it:
**session → activeContext → relationship scope (§4) → membership/role → permission (registry) → plan & entitlement (registry) → rate limit → input validation → [Safety Plane branch for learner AI ops] → handler → audit + usage → typed error mapping.**

`OperationContext` is constructed server-side only. Payload's own collection/field `access` functions stay as the **second** layer — defence in depth, not the primary gate (the repo's current `Users.ts` has no access config yet; PR-25 adds it).

## 4. Relationship scoping — identity is never a parameter
The methodology's org-scoping rule, in its Moyo form — and this one is child safety, not tenancy:
- `learnerId` / `orgId` / `userId` are read from `ctx`, **never** from client input, a route param, or an AI tool argument.
- AI tools exposed to the model take **no identity argument at all**; identity is closed over when the tool is constructed for that session. There is no field for a prompt-injection to land in.
- Viewer→subject reads resolve the **relationship edge** (guardianship, active session, class enrollment) and build the query from the resolved edge, never from a requested id.
- Enforcement: the tool types have no identity field (type error), and the doc-07 red-team suite tests the attempt.

## 5. The Registry — `packages/app/permissions` becomes the source of truth
The generator already points every domain at a permissions core. Build it as the registry that owns **plans, entitlements, permissions, nav gating, and upgrade copy**, with types derived (`as const satisfies`, doc 10 §2.3 rule 4) — never hand-written. One object drives the block's permission and plan gates (server), `PermissionGate` + nav visibility (client), and paywall copy. Doc 05's pricing ($11 early bird / $15.99 regular; payouts gated at Studio) stops living in prose and starts living in code; a typo in a resource key fails the build.

## 6. Enforcement — turn the generator's comments into errors
Extending the existing `no-restricted-imports` precedent in `packages/app/eslint.config.mjs`:
1. **`import 'server-only'` first line of every `*.repository.ts` and `*.service.ts`** — currently zero files use it. On native the leak risk isn't server actions, it's inference keys and Payload credentials in an app binary.
2. **Only repositories import `@acme/payload`** (the generator says it; lint makes it true).
3. **Only services import repositories**; features/screens import a domain's `index.ts` only — no deep imports.
4. **`@acme/ui` may not import `@acme/app`**; app code may not import `provider/session/mock` (doc 09).
5. **Raw-value ban** in styling (doc 08 §7.1) and **`any` ban** (doc 10).
6. **Generator-emitted SOT header** required at the top of every emitted file — including `SOT-KEYWORDS:` for grep-first.
Every one of these is a *build error*, not a review comment. That is the difference between "AI should" and "AI can't."

## 7. The gap audit — surfaces that bypass the block
Payload admin UI · Stripe hosted Checkout & Billing Portal · Better Auth endpoints · any Expo Router / Next route that renders with no server call and is deep-linkable. Each needs a layout-level guard; the audit is a standing item in the security review (doc 07 §6).

## 8. The discipline layer — how quality survives session 40
**Anti-forgetting** (the agent starts every session blank; these are the memory):
- `CLAUDE.md` — rules only, short, in the repo root. Architecture lives in this pack, not there.
- **SOT header + keywords** in every file; **grep-first** before reading anything (the biggest token saving in the method).
- **The generator** — scaffold, never hand-roll; the pattern can't be mistyped if it's emitted.
- **Lint + `turbo typecheck`** — the rules that survive a context window.
- **Branch per feature**, so the diff is the audit.

**Anti-slop — the banned-output list, each with its mechanical catch:**
| Slop | Caught by |
|---|---|
| Hallucinated API/package | no-invented-APIs rule + `turbo typecheck` + catalog single-version |
| Placeholder / stub / "TODO: implement" | definition of done; delivery rule in CLAUDE.md |
| Narrating comments | review; CLAUDE.md comment policy (decisions only) |
| Duplicate component or type | white-lie prompt (§9) + barrel index + generator refusing to overwrite |
| Raw values / off-token styling | spacing + token lint |
| `any`, `@ts-expect-error` | ESLint + strict base |
| Assertion-free tests | review checklist |
| Unverified "should work" | screenshot per persona in the PR (doc 09 §5) |

**The loop, per unit of work:** session start (rules + grep to the target) → plan (prerequisite chain; architecture before surface) → build (generator → block → screen) → verify (`turbo typecheck`, lint, target-size + hierarchy audits, screenshots per persona) → review (diff on a branch). Prompt templates for each step ship in `PROMPTS.md` alongside this doc.

## 9. Prompting rules that keep the code top-tier
- **Simple feature → one-shot in plain English.** The block and registry mean the prompt is only the feature.
- **Complex feature → prerequisite chain first**, numbered, architecture before surface (state shape before canvas).
- **Red-green, the gap:** deliberately leave the second concern unbuilt with a loud marker so it gets globalized instead of entangled. Moyo example: *"Build guardian invite creation. Do not wire email — create the single source-of-truth notification function and log to console."* One notification service then serves invites, safety alerts (S26), trial reminders, and payout notices.
- **Red-green, the white lie:** open with *"we already have X — use it,"* so the agent's first move is **search**, not **write**. With a 108-component kit and this token system, that one sentence is the strongest defence against duplicates and drift. No downside: if it doesn't exist, it says so.
- **Prompt into the future:** design the data shape for the features you'll have, not just today's. (Already applied — the knowledge graph in doc 07 §4.)
- **Git guardrail:** the agent may read status/history; `reset --hard`, `checkout --force`, `rebase`, `clean`, and force-push require you naming the command.

## 10. PRs (revised — no new framework, no `domain-services` package)
- **PR-26 · Agent surface (Wave 1, first):** `CLAUDE.md`, `PROMPTS.md`, SOT headers across existing modules, grep-first rule, generator emits SOT header + `server-only` + block skeleton, barrel-completeness check.
- **PR-27 · Enforcement (Wave 1):** the six lint rules in §6 on the existing eslint config, wired into `turbo lint`.
- **PR-24 · Core primitives (Wave 3, with real auth):** `packages/app/core/protected-operation.ts`, `OperationContext`, typed error mapping, audit write path, typed fetch wrapper (§2.3).
- **PR-25 · Registry (Wave 3):** `packages/app/permissions` as plans/resources/permissions/nav/copy with derived types; Payload collection + field access as layer two.

## 11. Source
Guardrail-coding methodology transcript supplied by Mike. Stack translation (no tRPC), the generator finding, relationship scoping, the anti-slop table, the comment and git adaptations, and PR sequencing are this pack's.
