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

---

# Harness — toolchain migration investigation

Added 2026-10-02 by `STEP-1-configuration-and-environment.md`. Everything above is the
standing project rulebook and still applies. This section orients a session that has no
memory of how the investigation is set up.

**What this project is.** MoyoLearn is an AI tutoring platform for children — a pnpm +
Turborepo monorepo of 25 workspaces spanning Expo/React Native mobile, Next.js and
TanStack web, a Payload CMS backend, and a vendored ViroReact fork with C++/JNI for XR.
It ships to iOS, Android, web, and PICO/Quest headsets.

**Current objective.** Evaluating a **compiler / toolchain migration**: the current
toolchain has been reported as unable to do something the project requires. Step 1 (the
harness) is **complete**. Step 2 — full codebase analysis plus toolchain research against
goals stated in the user's own words — **has not started**. No candidate has been
evaluated; `docs/decisions/toolchains/INDEX.md` is empty.

**Which toolchain surface is in question is not yet decided.** This repo has four
(JS/TS bundling, iOS native, Android native, vendored Viro C++/JNI) and the roster below is
built to be *pointed* at whichever the stated goals touch. Do not assume it is a C++
compiler.

## File conventions

| Path | Nature |
|---|---|
| `docs/MASTER_KNOWLEDGE.md` | **Durable, canonical.** The one document describing this platform. Numbered sections, pointer-style — links out, never duplicates. Currently a skeleton; Step 2 fills it. |
| `docs/decisions/` | **Durable, never pruned.** One file per evaluated option, plus `INDEX.md` (28 decisions indexed). Rejections are permanent — the reasoning is what prevents re-litigating a candidate in six months. Every new entry carries a **revisit trigger**. |
| `docs/decisions/toolchains/` | **Durable.** `compiler-scout` output: one file per candidate plus its own `INDEX.md`. Read that index **before** researching any candidate. |
| `reports/` | **Transient, prunable.** Dated subagent reports. Nothing durable lives here; promote anything that matters into `docs/`. |
| `.scratch/` | Temp, gitignored. **All** scratch output, logs and intermediate files. **Never the repo root.** |
| `~/claude-harness/` | Outside the repo, deliberately outside version control. Backups, revert path, model allocation, capability inventory. |

Read `~/claude-harness/HARNESS.md` first for the state of the world, and
**`~/claude-harness/REVERT.md`** to undo any harness change.

## Agent roster

Definitions in `.claude/agents/`. Each has a restricted tool list and a pinned model, so it
cannot modify what it is investigating and does not inherit whatever the session is running.

| Agent | Purpose | Model | Invoke with |
|---|---|---|---|
| `codebase-surveyor` | Repository map, boundaries, interfaces, data flow, every FFI boundary | `sonnet` | "Use the codebase-surveyor agent to survey {scope}" |
| `toolchain-cartographer` | **The critical one.** Complete applied flag set with `file:line`, and every item classified PORTABLE or TOOLCHAIN-BOUND | `fable` | "Use the toolchain-cartographer agent to map the toolchain surface of {scope}" |
| `dependency-auditor` | Every dependency's version, entry channel, license, source-vs-binary. Binary-only deps are hard blockers | `sonnet` | "Use the dependency-auditor agent to audit dependencies for {scope}" |
| `compiler-scout` | Outward-facing candidate dossiers + verdict + mandatory prior art | `fable` | "Use the compiler-scout agent to evaluate {candidate} against {need}" |
| `migration-planner` | `feasibility` / `gap-audit` / `behavior-parity` — **mode is required** | `opus` | "Use the migration-planner agent in {mode} mode on {topic}" |
| `murphy` + `reassurance` | Adversarial pair, **three rounds max** | `opus` | "Use the murphy agent to interrogate {decision}, then reassurance to answer" |
| `underdog` | **One shot, after a decision is locked.** OVERTURN / AMEND / SALVAGE / CONCEDE | `opus` | "Use the underdog agent for one shot at {decision}" |

Every `opus` row runs at **`high` effort stated explicitly** — Opus 5.5 alone defaults to
`medium`. Full reasoning per row: `~/claude-harness/MODEL-ALLOCATION.md`.

## Hard rules for investigation sessions

- **Investigation sessions do not modify the build.** `package.json`, lockfiles,
  `turbo.json`, metro/next/babel/app configs, gradle, Podfile, `*.xcodeproj` and
  `CMakeLists.txt` are **denied** in `.claude/settings.json`, as are `pnpm install/add/
  remove/update`, `pod install` and `expo prebuild`. This is enforced, not advisory.
- **Cite or don't claim.** Every structural assertion carries `path/to/file:line`. Uncited
  material goes in an **Unknowns** section — not in the body with a hedge.
- **Report to a file, return a summary.** Agents write full findings to a file and return
  ~1000 words max. This keeps the orchestrating context lean and makes every finding
  re-readable by a later phase instead of re-derived.
- **Label every claim** `VERIFIED` (read it), `INFERRED` (deduced, and from what), or
  `UNKNOWN`.
- **The incumbent gets the benefit of the doubt.** Keeping the current toolchain is the
  default; a challenger earns the switch. Novelty is not evidence, and migration cost
  appears in every comparison.
