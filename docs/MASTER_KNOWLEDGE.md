# MASTER_KNOWLEDGE — MoyoLearn

**Durable, canonical.** The one document describing this platform. Numbered sections,
pointer-style: it **links out** to the file that holds the detail rather than duplicating
it, so it cannot drift out of step with the code.

> **Status: skeleton.** Stage 6.2 of the harness created this file and its section numbering.
> **Step 2 fills it** from the `codebase-surveyor` and `toolchain-cartographer` reports.
> Every section below is a placeholder; a section with no content is an honest gap, not an
> oversight. Do not write a section from memory — each claim carries `path/to/file:line`
> or it goes in §9.

## Table of contents

1. What this platform is
2. Repository and workspace map
3. Module boundaries and interfaces
4. Data flow
5. Process and concurrency model
6. Cross-language and FFI boundaries
7. The build: entry points, toolchain surface, codegen
8. Dependencies and their provenance
9. Unknowns

---

## 1. What this platform is

_Pending Step 2._

## 2. Repository and workspace map

_Pending `codebase-surveyor` → `reports/survey-{date}.md`._

Known starting facts (Stage 1, VERIFIED): pnpm + Turborepo monorepo, workspaces
`apps/*` and `packages/*`, **25 `package.json` files**, `pnpm-lock.yaml` is 1.08 MB
(~308K tokens).

## 3. Module boundaries and interfaces

_Pending Step 2._ `CLAUDE.md` records the enforced rules: only repositories touch
`@acme/payload`, only services call repositories, features import a domain's `index.ts`.

## 4. Data flow

_Pending Step 2._ `CLAUDE.md`: every server operation goes through `protectedOperation()`
in `packages/app/core`.

## 5. Process and concurrency model

_Pending Step 2._

## 6. Cross-language and FFI boundaries

_Pending `toolchain-cartographer`._ Known to exist (Stage 1, VERIFIED): a vendored
ViroReact fork with C++/JNI under `packages/ui/xr`.

## 7. The build: entry points, toolchain surface, codegen

_Pending `toolchain-cartographer` → `reports/toolchain-surface-{date}.md`._ That report's
PORTABLE / TOOLCHAIN-BOUND table is the input this section summarizes.

## 8. Dependencies and their provenance

_Pending `dependency-auditor` → `reports/dependencies-{date}.md`._

## 9. Unknowns

Anything asserted without a `file:line` citation belongs here until it has one.

- Everything above. This file is a skeleton as of 2026-10-02.
