# CLAUDE.md — Moyo

Rules, not architecture. Specs live in `docs/pack/`; read them when planning, not when coding.

## Finding things (do this first)
- **Grep before you read.** `grep -rl "SOT-KEYWORDS:.*<term>" packages apps` to narrow files, then open only the match. Never read a directory to "get oriented."
- Source-of-truth keywords are in the header block of every significant file. Add them when you create one.
- `packages/ui/index.ts` is the component index. Check it before building any UI.

## Patterns are law
- This codebase runs on established patterns. **Verify the pattern exists before using it; never invent a second way to do something that already has a way.**
- Before creating a type, component, hook, or service: it probably already exists. Search first.
- New shared logic gets globalized into the registry or a service — never copied into a second feature.

## Scaffolding
- Scaffold with `pnpm gen domain|feature|component` — never hand-roll the folder shape. The generator is the pattern.

## The block
- Every server operation goes through `protectedOperation()` in `packages/app/core`. No exceptions, no direct handlers.
- **Only repositories touch `@acme/payload`.** Only services call repositories. Features import a domain's `index.ts` — never a deep path.
- Every repository and service file starts with `import 'server-only'` as its first line.
- Cross-boundary types travel as **type-only imports** (`import type`). No tRPC, no client bundling of server code.
- Identity is **never** a parameter. `learnerId`, `orgId`, and `userId` come from `ctx` at the service boundary — never from client input, never from an AI tool argument, never inferred from a prompt.

## Types
- `strict` everywhere. `any` and `unknown` are banned. No `@ts-expect-error` without a linked issue.
- Types are **derived, never hand-written**: Payload generated types and Better Auth generated types are the source of truth; registry types come from `as const satisfies` maps.
- Invalid prop/state combinations must be unrepresentable — discriminated unions, not optional-prop soup.
- Run `pnpm typecheck` before handing anything back. Green from a cold cache or it isn't done.

## UI
- Tokens only. No raw values — no `p-[13px]`, no hex colors, no hardcoded `text-white`. If a token doesn't exist, add it to `packages/theme/tokens.ts`.
- Check for an existing component before creating one. Extend or compose; never duplicate a near-identical component.
- Spacing uses the named tiers (`gap-stack`, `gap-group`, …). Touch targets come from the age-band token, never a hardcoded size.
- Hierarchy comes from size, weight, and space. Borders are structure, never emphasis. One display moment and one highlighter accent per screen.

## Children's surfaces
- No paywall, price, or upgrade prompt may render on a learner surface. Ever.
- No engagement-pressure mechanics aimed at minors — no shame copy, no guilt notifications, no late-night pushes.
- Learner-facing AI operations must traverse the Safety Plane. Never call a model directly from a feature.

## Comments
- Header block per file: what it is, why it exists, where the source of truth lives, `SOT-KEYWORDS:`.
- Comment **decisions and non-obvious constraints** — why this fallback, why this ordering, why this isn't the obvious approach.
- Do not narrate code. No "// map over the items". No placeholder or TODO-stub comments in delivered work.

## Delivery
- Finish the feature. No stubs, no "next steps" handoffs, no half-wired paths.
- Work on a branch per feature or iteration.
- **Git:** read status and history freely. Never run `reset --hard`, `checkout --force`, `rebase`, `clean`, or force-push unless I name that exact command in the request.
