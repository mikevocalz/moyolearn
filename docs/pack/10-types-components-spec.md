# Type System & Responsive Component Architecture
**Doc 10 · Moyo platform pack · Date:** Aug 20, 2026
**Scope:** the typing contract every package obeys, and the reusable-component architecture that makes one kit render correctly from a 320px phone to a 1440px desktop pane, across two dials and four age bands. Skills applied: design-system, frontend-design, code-review (type-safety lens), design-handoff.
**Ground truth:** every claim about the repo below was read from the working tree (`packages/ui/*`, `packages/theme/tokens.ts`, `apps/mobile/src/navigation/split-view/*`, the tsconfig set). Roster + no-invented-APIs gates from plan §9 apply.

---

## 1. What the repo already gets right (canonized, not re-invented)

These are existing patterns. They become **law** for every new component in the pack:

1. **Variants are the type source.** `Button.tsx` builds a `tv()` recipe with slots and then declares `export interface ButtonProps extends VariantProps<typeof button>`. The props *derive from* the style recipe — add a variant, the prop type updates, no drift. **Rule: no component hand-writes a variant union that a recipe already knows.**
2. **Platform forks share a typed contract.** `Collapsible.types.ts` / `FieldGroup.types.ts` declare the prop interface once; `.web.tsx` and `.native.tsx` implement against it. **Rule: every platform fork gets a `.types.ts`** (currently 6 contracts against 32 forked files — §3.3 closes that gap).
3. **State is a discriminated union, not a bag of booleans.** `resolveBack()` returns `{ kind: 'defer' } | { kind: 'step'; column } | { kind: 'fallThrough' }`, and `previousColumn()` takes `columnCount: 1 | 2` — invalid states are unrepresentable and `switch` is exhaustive. This is the house style for every async/UI state in the app.
4. **Tokens are `as const` with derived types.** `tokens.ts` exports `Palette`, `SemanticColor`, `ContentWidth`, `GradeBand` and the `targetForBand()` helper — token names are types, so a typo is a compile error rather than a silently missing class.
5. **The barrel exports the type beside the component:** `export { Button, type ButtonProps }`. Consumers never reach into file paths.
6. **`turbo typecheck` already fans out** to a `tsc --noEmit` script in all eight workspaces. The gate exists; §2 makes it strict.

## 2. The typing contract (gaps found → decisions)

### 2.1 Strictness is currently per-package. Fix: one shared base. **[fix]**
Verified: the root `tsconfig.json` is `{ "compilerOptions": {}, "extends": "expo/tsconfig.base" }` — **no strict flags at the root**; `packages/ui` sets `strict: true` itself, so strictness depends on which package you're in. Add `tooling/tsconfig/base.json`, extended by all eight workspaces:

```jsonc
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,   // arr[i] is T | undefined — the #1 source of RN runtime crashes
    "exactOptionalPropertyTypes": true, // `prop?: string` ≠ `prop: string | undefined`
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,       // forces `import type` — no type-only import survives to runtime
    "noEmit": true
  }
}
```
Matches the 2026 consensus baseline (strict + `noUncheckedIndexedAccess`, ban `any`, `satisfies` for config, `import type`, explicit return types on exports, no `React.FC`). Migration is per-package and mechanical; `noUncheckedIndexedAccess` will surface real bugs in list/table code — that is the point.

### 2.2 Version policy
TypeScript stays on the **stable 6.x line** the catalog already pins (single-version rule, doc 03). 7.0 is at RC as of mid-2026 — it may be benchmarked in CI for compile speed, but is not adopted until GA, and any bump moves the catalog entry, never a package.

### 2.3 The five rules that get enforced in review
1. **`any` is banned** (ESLint error). `unknown` + a narrowing guard at every boundary — API responses, Payload results, deep-link params, MMKV reads.
2. **Exported functions carry explicit return types.** Inference is fine inside a module; across a package boundary it makes error messages readable and prevents accidental API widening.
3. **Invalid prop combinations must be unrepresentable.** Use a discriminated union rather than four optional props that "shouldn't" co-occur — the type system encodes product constraints rather than documenting them:
   ```ts
   export type SessionCardProps =
     | { mode: 'virtual'; joinUrl: string; room?: never }
     | { mode: 'in-person'; room: string; joinUrl?: never }
   ```
   The `?: never` arm is what stops a caller passing both.
4. **`as const satisfies`** for every config/token map — validates the shape while preserving literal inference (`as` alone throws the narrow type away):
   ```ts
   export const targets = { 'target-floor': '1.5rem', /* … */ } as const satisfies Record<`target-${string}`, `${number}rem`>
   ```
5. **Async state is a union, never a boolean pair.** No `{ isLoading, error, data }` triples that permit "loading and errored"; `{ status: 'idle' | 'loading' | 'success' | 'error' }` with the payload on the arm that owns it. TanStack Query's result is narrowed at the call site, not spread into props.

### 2.4 Domain types are generated, never hand-maintained
Payload generates `payload-types.ts`; Better Auth generates its schema types. **Rule: generated output is committed** (same discipline as Nitrogen output elsewhere) and hand-written duplicates are forbidden — the app's `Learner`, `Session`, `Subscription` types are re-exported from generated sources through `packages/app/types`, so a collection change breaks the build instead of drifting. Cross-boundary payloads (the doc-05 §3.2 visibility matrix) get **explicit projection types** — `TutorViewOfLearner` literally cannot contain a billing field, so over-fetching is a type error, not a code-review catch.

---

## 3. Responsive reusable components

### 3.1 One vocabulary. **[fix]** — currently there are two
Verified: `packages/ui/use-size-class.*` exposes a binary `SizeClass = 'compact' | 'regular'` (split at `REGULAR_MIN_WIDTH`), while `apps/mobile/src/navigation/split-view/use-window-size-class.ts` implements the four M3 width classes (600/840/1200dp). Two responsive vocabularies in one repo is how a kit starts contradicting its own shells. Decision: **`WidthClass` is the single source**, in `@acme/theme`:

```ts
export type WidthClass = 'compact' | 'medium' | 'expanded' | 'extraLarge'
export const widthClassOrder = ['compact','medium','expanded','extraLarge'] as const
/** The kit's binary fork is DERIVED, never parallel. */
export const isRegular = (w: WidthClass): boolean => w !== 'compact'
```
`useSizeClass()` keeps its excellent web/native fork — including the `useSyncExternalStore` + `getServerSnapshot` design that fixes the SSR layout flash — and simply returns `WidthClass`, with `isRegular()` covering today's binary callers.

### 3.2 The responsive ladder (choose the cheapest rung that works)
| Rung | Mechanism | Use for | Cost |
|---|---|---|---|
| **1 (default)** | **Tailwind responsive variants inside the `tv()` recipe** — the pattern `Button` already uses (`px-5 py-2.5 md:px-6 md:py-3`) | padding, type size, gaps, column counts, visibility | zero JS, no SSR flash, no re-render |
| 2 | **Container queries** where the parent's width — not the window's — decides (a card inside a 380px detail pane on a 1440px screen) | pane-embedded components | CSS only; verify support in the RN target before use |
| 3 | **`useSizeClass()` / `WidthClass`** | *structural* decisions only: which archetype renders, how many panes, sheet-vs-popover-vs-pane (doc 02's L1 ladder) | JS, re-render, SSR guess |
Rule: **if CSS can express it, JS must not.** Rung 3 exists for layout topology, not for padding.

### 3.3 The reusable-component contract (every kit component)
1. **Pure presentational** — depends on `@acme/theme` only, no data fetching, no navigation, no store reads. (The kit's own header comment already states this; it becomes a lint boundary rule.)
2. **Props derive from the recipe** (`VariantProps`), plus a `className` escape hatch, plus explicitly-typed a11y props. No prop bag typed `Record<string, unknown>`.
3. **Platform forks share a `.types.ts` contract** — the fix from §1.2; a fork whose props drift from its contract fails typecheck.
4. **Dial and band come from context, not from every call site.** `Dial = 'hot' | 'cool'` and `GradeBand` are provided by the shell (`DialProvider`, learner profile) and read by `useDial()` / `useTargetToken()`. A component that hardcodes `size="lg"` for children is a bug; it asks for `min-h-target-child` via the band.
   ```ts
   export function useTargetToken(): keyof typeof targets   // targetForBand(band) under the hood
   ```
5. **Every component ships stories across the matrix that matters to it** — variant × dial × `WidthClass` — which is also how the doc-08 §7 target-size and hierarchy audits get their fixtures.
6. **Composition over polymorphism.** Generic `as`-prop components type beautifully in isolation and break down ergonomically once props are destructured; the kit prefers explicit components (`Button`, `LinkButton`) over one polymorphic component with conditional props. Generics are reserved for genuine data containers (`DataTable<Row>`, `SpatialList<T>`).
7. **`tv()` for anything with more than one variant** — currently 26 of 108 kit files use it; PR-21 brings the multi-variant remainder onto the recipe pattern so the whole kit types the same way.

### 3.4 Typed layout primitives to add **[add]**
Small, boring, and they delete a hundred ad-hoc decisions:
```ts
// Stack/Inline: spacing is a TOKEN TIER, never a raw number (doc 08 §2.1)
type SpacingTier = 'element' | 'stack' | 'group' | 'section'
export interface StackProps { gap: SpacingTier; children: ReactNode; className?: string }

// Pane: the doc-02 archetype boundary, typed
export interface PaneProps { role: 'primary' | 'supplementary' | 'detail'; children: ReactNode }

// Show: declarative width gating — replaces scattered `if (sizeClass === …)`
export interface ShowProps { from?: WidthClass; until?: WidthClass; children: ReactNode }
```
`SpacingTier` is the type that makes doc 08's spacing law enforceable: `gap={12}` doesn't compile.

## 4. How this meets the Wave-2 build (doc 09)
- The **Mock-Session contract's** `AppSession`, `ActiveContext`, `RoleKind`, and persona fixtures are typed exactly as §2.3 rule 3 demands — `ActiveContext` is a discriminated union on `kind`, so a guardian context cannot carry a `learnerId` by accident, and the RoleSwitcher can only produce valid contexts.
- Screen archetypes (Feed/Duet/Triptych/Focus) are **typed layout components**, and each screen brief's props interface is written before the screen is built — the brief's Layout line *is* the type.
- Fixtures are typed against the same generated domain types the live data will use, so Wave 4's swap from fixtures to Payload projections is a type-checked refactor rather than a rewrite.

## 5. Verification (extends the existing gate)
`turbo typecheck` already exists and is the hard gate — it now runs against the strict base from §2.1. Added checks: ESLint bans `any` and cross-package deep imports; a boundary rule forbids `@acme/ui` importing from `@acme/app`; the spacing lint (doc 08 §7.1) rejects raw values; Storybook coverage assertion — every exported kit component has at least one story per dial it supports. Definition of done for PR-22: **zero `any`, zero `@ts-expect-error` without a linked issue, `turbo typecheck` green from a cold cache.**

## 6. PRs
- **PR-22 · Type foundation:** `tooling/tsconfig/base.json` + all eight workspaces extending it, strict-family flags, ESLint `any` ban + boundary rules, `as const satisfies` pass over `tokens.ts`, generated-types re-export barrel in `packages/app/types`.
- **PR-23 · Responsive unification:** `WidthClass` in `@acme/theme`, `useSizeClass()` returning it (web/native forks preserved), `isRegular()` for existing callers, split-view module consuming the shared type, `Show`/`Stack`/`Pane` primitives, `useDial()` + `useTargetToken()`.
- **PR-21 (extended) · Recipe parity:** remaining multi-variant kit components onto `tv()`, `.types.ts` contracts for all platform forks, story matrix per component.

## 7. Sources
Repo working tree (read this session): `packages/ui/Button.tsx`, `Collapsible.types.ts`, `use-size-class.web.ts` / `.native.ts`, `packages/ui/index.ts`, `packages/ui/tsconfig.json`, root `tsconfig.json`, `packages/theme/tokens.ts`, `apps/mobile/src/navigation/split-view/use-split-view-back.ts` + `use-window-size-class.ts`, workspace `package.json` typecheck scripts. · TypeScript practice 2026: strict + `noUncheckedIndexedAccess`, ban `any`, discriminated unions for async state, `satisfies` for config, `import type`, explicit return types, no `React.FC`; 7.0 RC status vs stable 6.0 line — hashtagcoders TS Best Practices 2026 (Jun 2026). · Discriminated-union component APIs incl. the `?: never` exclusion trick and "types encode product constraints" — Andrew Branch, GreatFrontEnd (Jun 2026), OneUptime (Jan 2026). · Polymorphic `as`-prop pattern and its destructuring/ergonomics breakdown — dev.to TS patterns (Feb 2026), buka.sh (Aug 2025). · Template-literal types for design tokens — dev.to (Feb 2026).
