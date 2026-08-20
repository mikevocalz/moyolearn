# Starter Tailoring — `Solito-NativeUI-Starter` → AI Tutoring Platform
**Companion to:** `ai-tutoring-platform-plan.md` + `adaptive-screens-design-spec.md` · **Date:** Aug 19, 2026
**Source of truth:** the cloned repo at commit HEAD of `main` (every claim below cites a real path). Roster + anti-slop gates from plan §9 apply to all work derived from this doc.

---

## 1. What the starter already delivers (verified inventory)

| Plan/spec item | Status in repo | Where |
|---|---|---|
| pnpm + Turbo monorepo, single-version **catalog** | ✅ done, stricter than planned (one version per dep, `catalog:` everywhere) | `pnpm-workspace.yaml` |
| Expo + Next + Solito shared screens | ✅ Expo SDK 57 / RN 0.86.2, Next 16.3.1, Solito 5, `screen.tsx/.native/.web` pattern | `apps/mobile`, `apps/web`, `packages/app` |
| Payload wired with Postgres | ✅ **Payload `4.0.0-canary.28`** + `@payloadcms/db-postgres`, admin mounted at `/(payload)/admin`, API at `/payload-api`, `schemaName: 'payload'`, generated types committed | `packages/payload/src/payload.config.ts`, `apps/web/app/(payload)/` |
| Design-token pipeline | ✅ single-source `tokens.ts` → `build-css.mjs` emits web `@theme` (light-dark) + native Uniwind variants; "No hex values exist outside this file" | `packages/theme/` |
| Neubrutalist system | ✅ already the house style: ink borders ("the outline IS the design"), hard offset slab shadows `4/6/9px 0 border-strong` **no blur ever**, electric-yellow primary + hot-pink accent, Archivo Black + Space Grotesk (font files present) | `tokens.ts` palette/semantic/shadows, `packages/assets/fonts/` |
| UI kit ("NativeUI") | ✅ ~40 universal components with platform forks + Storybook stories each; subpath APIs `@acme/ui/tw`, `/icons`, `/primitives` | `packages/ui/`, `apps/storybook` |
| Width classes | ✅ **twice**: kit-level `useSizeClass` (`compact`/`regular` @768, window-width-keyed) *and* the split-view's full **Material 3 window size classes** — compact / medium 600 / expanded 840 / extraLarge 1200 dp, widest-first resolution, hook + pure resolver | `packages/ui/size-class.constants.ts`, `apps/mobile/src/navigation/split-view/constants.ts`, `use-window-size-class.ts` |
| Android split view | ✅ complete system, not a shim: per-platform `index.android/ios.tsx`, `CollapsiblePane`, `PaneDivider`, `PaneToggle`, `PaneSearchBar`, pane width tokens (`--container-pane-*` mirrored as dp with a sync test), pane-overrides store, `resize.ts`, `back-navigation.ts`, sticky headers, swipe actions — **plus a folding-feature phase doc already in flight** | `apps/mobile/src/navigation/split-view/` (incl. `PHASE-8-FOLDING-FEATURE.md`) |
| Selection-driven inspector | ✅ already the law: the split demo opens the inspector **only while an event is selected**; the split view "takes a boolean and knows nothing about schedules" | `apps/mobile/app/(drawer)/split/_layout.tsx` |
| Tab bar → rail adaptation | ✅ JS tabs flip `tabBarPosition` to `left` at **600dp** (documented trade-off vs `NativeTabs`' iOS-18-only `sidebarAdaptable`) | `apps/mobile/app/(drawer)/(tabs)/_layout.tsx` |
| Drawer shell | ✅ expo-router drawer with custom content, search-focus vs edge-swipe gesture arbitration | `apps/mobile/app/(drawer)/_layout.tsx` |
| **Schedule engine** | ✅ far beyond greenfield: resource-major day grid ("Noto colours a column, not an appointment" is in the comments), IANA-zone-correct instants, interval-graph lane packing with cluster-width correction, 15-min snap drag that **preserves duration under clamping**, zoom steps, pending-move overrides layer, Zustand store, week-view flag, mini calendar, booking + event-action sheets, unit tests | `packages/app/features/schedule/` (`model.ts`, `lanes.ts`, `reschedule.ts`, `event-drag.native.tsx`, `store.ts`, `schedule.test.ts`) |
| Jank-free drag discipline | ✅ memoised `Gesture.Pan`, Reanimated shared values on UI thread, store written **once on release** via `scheduleOnRN` | `event-drag.native.tsx` header comment |
| Sheets | ✅ two-tier: kit `BottomSheet` wraps **`@expo/ui`'s universal sheet** (vaul on web; SwiftUI/Material native; snaps 55%/85%, never full-screen) for simple surfaces; **Gorhom 5.2.14 on Reanimated 4.5.1** powers the interactive schedule sheets (`BookingSheet`, `EventActionsSheet`, `BottomSheetModalProvider` at root) | `packages/ui/BottomSheet.tsx`, `apps/mobile/components/*Sheet.tsx`, `apps/mobile/app/_layout.tsx` |
| Press physics | ✅ `PressScale` — Legend Motion spring on native, forked per platform | `packages/ui/press-scale.native.tsx` |
| State discipline | ✅ Zustand 5 everywhere business state lives (schedule store, pane stores); TanStack Query provider in place | `packages/app/providers/query-provider.tsx`, stores throughout |
| Scaffolding | ✅ `pnpm gen domain|feature|component` with refuse-to-overwrite templates | `tooling/generators/gen.mjs` |
| Verification culture | ✅ Storybook per component; tests on the pure schedule/split modules; docs that correct their own prior drafts with reproduced (not inferred) failures | `docs/rn-087-upgrade-brief.md`, `docs/toolchain-notes.md` |

**Not present (the actual build surface):** any auth (no Better Auth/session layer), Supabase/realtime, Stripe, learning-graph/mastery domain, roles/orgs/tenancy, availability + conflict/travel validation, Find-a-Time, recurring events, server persistence for the schedule (fixtures only: `DEMO_DAY`/`DEMO_RESOURCES`), inference boundary, consent/privacy plane.

---

## 2. Corrections to the plan/spec, forced by the repo (supersede where noted)

### 2.1 ADR-002 superseded — Payload is 4.0.0-canary.28, and it's working
The plan recommended 3.x-pinned. The repo has already standardized on 4 canary with the right discipline in place: exact pin via catalog, isolated `payload` PG schema, `push` env-gated, generated types committed, import map wired. **Keep 4 canary; formalize the guardrails instead of retreating:**
- Canary bumps are their own PRs, one canary at a time, driven by the release diff — never bundled with feature work.
- No admin-UI customization until 4.0 beta/RC (the admin redesign is the churn zone); collections/access-control config is the stable surface to build on.
- The plan's `domain-services` isolation layer (repositories over the Local API) is still required — it's the migration insurance either direction.
- `payload-types.ts` regeneration is part of every collection PR (already the repo convention).

### 2.2 UI foundation is `@acme/ui`, not PanelUI
The design spec's "PanelUI vendored via CLI" foundation is replaced: the kit exists, is universal, story-covered, and idiomatic to this repo. PanelUI drops to interaction-pattern reference only. All spec components (§6 of the design spec) are built **in `packages/ui` via `pnpm gen component`**, composing existing primitives (`Collapsible` → `InspectorSection`; `PressScale` + slab shadows → `InkTile` feel; `SegmentedControl`, `Menu`, `DataTable`, `Toast` already exist).

### 2.3 Width classes: adopt the repo's, delete the spec's parallel table
The spec's 600/840/1200 thresholds turn out to already exist as the split-view's M3 `WindowSizeClass`. The tailored rule:
- **Pane decisions** use `windowSizeClassForWidth` (compact / medium / expanded / extraLarge) — the spec's four classes map 1:1 (`large` = `extraLarge`).
- **Kit-internal density** keeps `useSizeClass` (`compact`/`regular` @768) — it governs component-level layout, not pane count, and the two coexist on purpose (same reasoning as the 600dp rail threshold vs 768 pane threshold, documented in the tabs layout).
- If shared packages need window classes, promote `constants.ts` + `use-window-size-class.ts` from `apps/mobile/src/navigation/split-view/` into `@acme/ui` unchanged; do not fork the numbers.

### 2.4 Disclosure ladder: adopt the repo's snap points and two-tier sheet strategy
- L1 Peek / L2 Inspect on compact = **Gorhom** (the repo's choice for interactive schedule sheets), snaps **55% / 85%** to match the house rule "never full screen" (`BottomSheet.tsx`). The spec's 45/92 is retired; if usability testing shows 55% is tall for a peek, add a lower detent then — measured, not assumed.
- Simple confirmations/forms outside the schedule keep the kit's `@expo/ui` sheet.
- The compat question is closed: **Gorhom 5.2.14 × Reanimated 4.5.1 × worklets 0.10.1 is the repo's working, catalog-pinned combo** — the spec's "smoke-test 5.2.x on Reanimated 4.3.x" gate is satisfied by a newer pairing already in production here.

### 2.5 Animation drivers: the repo already practices the spec's rule
Legend Motion owns press feedback (`press-scale.native.tsx`); Reanimated + gesture-handler own drag (`event-drag.native.tsx`, with the memoised-gesture and write-once-on-release discipline). Codify exactly that split; `InkTile` = `PressScale` composition for press + the existing drag wrapper for reschedule. No new driver decisions needed.

### 2.6 Design language: fold "Schoolhouse" into `tokens.ts` — the repo is already 80% there
The retro system in `tokens.ts` *is* neubrutalism with Swiss token discipline (single source, semantic emission, light/dark via `light-dark()`). Tailor by **mapping, not replacing**:

| Spec role | Repo reality (`packages/theme/tokens.ts`) | Action |
|---|---|---|
| highlighter | `burgundy` scale is already electric yellow (`300 #FFE14D` / `400 #FFDB33`), and it's `primary` with ink on top | ✅ keep — the repo's primary *is* the highlighter |
| ink | `ink` scale (paper cream `50 #FFFDF7` → true black), `border`/`border-strong` are ink by design | ✅ keep |
| red pen | `danger #D31F2B` (+ `rose` scale for calendar accents) | ✅ map redpen → `danger`; reserve `rose` for resource accents only |
| ballpoint | `gold` scale is already blue hexes (`500 #3B6DF6`) and serves `focus` + resource accents | map ballpoint-role → `gold`; **decision to make:** primary *action* color stays yellow (house identity) — blue stays focus/link/selection, which reads correctly against yellow CTAs |
| grade-green | `forest` scale | ✅ map success/mastered/paid → `forest` |
| hard offset shadows | `shadows.card/raised/overlay` = 4/6/9px slabs, no blur | ✅ identical to spec — delete spec's values, cite these |
| Hot/Cool dial | not yet a token dimension | **add**: a `dial` axis (border width 2↔1, shadow card↔none, radius `sheet`↔`md`, fill saturation) emitted through `build-css.mjs` as variant classes — learner shells run hot, ops cool, same scales underneath |
| type | Archivo Black + Space Grotesk shipped in `packages/assets/fonts/` | ✅ keep the pairing (it's installed and characterful); **retire the spec's Bricolage/Schibsted proposal**; add ONE face: a tabular-figure mono for times/prices/mastery (genuine gap for schedule data) — verify family + `@expo-google-fonts` id at install |
| dark mode | already structural (`semantic` carries light/dark pairs) | spec's dial must define dark values per token — the pipeline already handles emission |

Two paper cuts found while verifying, worth fixing in passing: `README.md` still says the fonts are Fraunces + Inter (stale vs `assets/fonts/`), and `tokens.ts` retains renamed-scale comments (`burgundy` = yellow, `gold` = blue) — fine internally, but the tailoring PR should alias semantic names (`highlighter`, `ballpoint`) so feature code never reads a color lie.

---

## 3. Workspace mapping (plan packages → this repo)

Scope note: `@acme/*` is the placeholder scope; rename to the product scope in one dedicated PR (find/replace + `pnpm-lock` regen) before external contributors touch it.

| Plan package | Lands as | How |
|---|---|---|
| `packages/ui` | `packages/ui` (exists) | new components via `pnpm gen component`; every one ships with a story (house rule) |
| `packages/layout` (AdaptiveSplitLayout) | **stays where it is**: `apps/mobile/src/navigation/split-view/` + `packages/ui/layout/` | it's already the abstraction the spec described (app-authored columns, router-driven detail, selection-driven inspector). Promote `constants.ts`/`use-window-size-class.ts` into `@acme/ui` only when `packages/app` features need window classes directly |
| `packages/scheduling` (calendar engine) | grow in place: `packages/app/features/schedule/` | the pure modules (`model`, `lanes`, `slots`, `geometry`, `reschedule`, `month`) are already dependency-free; extract to `packages/schedule` only when a second consumer (web ops shell, server validation) actually imports them — not before |
| `packages/domain` (zod schemas, roles) | `pnpm gen domain domain` → `packages/app/domain/` per the generator's convention, or a new `packages/domain` if server code must import it without `packages/app` — decide when Better Auth lands (server needs role maps) |
| `packages/domain-services` (Payload repositories) | new `packages/domain-services`, server-only, imports `@acme/payload` | the ADR-002 isolation layer |
| `packages/auth` (Better Auth) | new `packages/auth` + catalog entries | see §4 |
| `packages/learning`, `packages/inference` | new packages, same pattern | Phase 2 |
| `apps/expo`, `apps/web` from the plan | `apps/mobile`, `apps/web` (exist) | plan doc's route tree (§5.3) maps onto `(drawer)/(tabs)` + the split route group; role shells become route groups exactly as planned |
| Storybook "gallery route" verification idea | `apps/storybook` (exists) | the archetype gallery + screenshot matrix live here — §6 |

## 4. Dependency delta (respecting the catalog's one-version rule)

Every add is a `catalog:` entry first; exact versions resolved against the registry **at install time in the PR that introduces them** (no versions invented here), then consumed as `catalog:` by workspaces. Adds, in order of need:

| Add | For | Notes |
|---|---|---|
| `better-auth` (+ its CLI for schema gen) | identity, orgs, guardianship | tables land in the same Postgres, **`schemaName`-style separation like Payload's**: run Better Auth against a dedicated `auth` schema so `payload` / `auth` / app schemas stay distinct in one database |
| `stripe` (server) + Better Auth Stripe plugin | billing/Connect | plugin choice per plan ADR-004 |
| `@supabase/supabase-js` (server) or plain `pg` channels decision | realtime + storage, **iff ADR-001's Supabase path is exercised** | `DATABASE_URL` is already provider-agnostic (`.env.example`); pointing it at Supabase Postgres changes nothing in `payload.config.ts`. Realtime tokens are minted server-side per ADR-003 — the client never gets a Supabase key |
| tabular mono font package | schedule data typography | §2.6 |
| *(nothing else)* | | TanStack Query/Form/Table/Virtual, date-fns, zod, zustand, MMKV, keyboard-controller, gorhom, worklets — all already pinned in the catalog. The plan's TanStack assumption is satisfied |

Explicitly **not** added: NativeWind (repo is Uniwind), PanelUI (see §2.2), any analytics SDK (plan §7.2 forbids them in child surfaces — the repo currently has zero, keep it that way).

## 5. Schedule engine: exists vs. platform needs (the Phase-1 build list)

| Capability | Today (`features/schedule/`) | Platform need | Delta |
|---|---|---|---|
| Resource-major day grid | ✅ resources as columns, zone-correct, lane-packed | same, plus room/location resource kinds | extend `Resource` with `kind`; accents already resource-owned |
| Drag reschedule | ✅ 15-min snap, duration-preserving clamp, one store write | + validity: availability windows, cross-resource conflicts, travel-time feasibility, cancellation-policy gates | new pure module `validate.ts` beside `reschedule.ts`, same tested-pure style; invalid drops render the redpen hatch per the design spec |
| Overrides layer | ✅ pending moves keyed by event id | becomes the optimistic layer over server mutations (TanStack Query) | wire `overrides` → mutation lifecycle; clear on settle |
| Data | fixtures (`DEMO_DAY`) | Payload collections (`sessions`, `availabilities`, `locations`, `services`…) via `domain-services` | plan §7.1 collections; `ScheduleDay` becomes a projection the server assembles |
| Views | day (+ week flag), mini month | role projections: agenda (student/parent), Today run-list (tutor), resource command center (ops) | projections consume the same `model.ts` types; per-role screens per design-spec §4.1 |
| Recurrence | ✗ | recurring sessions/classes, exceptions | recurrence lives server-side (expansion in `domain-services`), grid stays instant-based — the model already insists on instants, which is exactly why this stays clean |
| Find-a-Time | ✗ | constraint solver over availability + travel + qualifications | new pure package when built (Phase 1); `slots.ts` is the seed |
| Selection → inspector | ✅ wired in the split demo | + the full disclosure ladder (peek actions per role, L2 sections) | `EventActionsSheet` grows into the ladder's L1; `InspectorSection` (from `Collapsible`) builds L2 |

## 6. Phase 0 recast as ordered PRs on this repo

1. **PR-0 · Scope + hygiene:** product scope rename; README font line fixed; semantic color aliases (`highlighter`, `ballpoint`, `redpen`, `grade`) added in `tokens.ts` so scale-name lies never leak into features.
2. **PR-1 · Dial tokens:** hot/cool dial axis in `tokens.ts` + `build-css.mjs` emission; Storybook page rendering every component at both temperatures; automated contrast check over every emitted fg/bg pair (design-spec gate, now against real tokens).
3. **PR-2 · Auth foundation:** `better-auth` catalog entry (version resolved at install), `packages/auth`, `auth` PG schema, orgs/memberships/guardianship per plan ADR-003, Expo client wiring; drawer gains the context switcher (design-spec §5.2) fed by memberships.
4. **PR-3 · Domain services:** `packages/domain-services` repositories over Payload Local API; first platform collections (`organizations`, `memberships`, `learners`, `consents`) with committed regenerated types.
5. **PR-4 · Schedule persistence:** `sessions`/`availabilities`/`locations` collections; `ScheduleDay` served by a projection endpoint; fixtures demoted to Storybook/tests; overrides wired to mutations.
6. **PR-5 · Validation + ladder:** `validate.ts` (availability/conflict/travel, pure + tested), redpen-hatch invalid drop states, `EventActionsSheet` → role-aware L1 peek, `InspectorSection`-based L2 in the split view's inspector pane.
7. **PR-6 · Verification rig:** Storybook archetype gallery at the four `WindowSizeClass` widths + screenshot matrix in CI; disclosure invariants as tests beside the existing `split-view.test.ts`.

Each PR: `turbo typecheck` green (`tsc --noEmit` is already the repo's gate), stories for new components, no new dep without a catalog entry, generated output committed.

## 7. What the repo teaches the plan (adopted upstream)

Three of its conventions are now platform law: **one version per dependency via the catalog** (kills version-drift slop at the root), **pure-module-plus-tests for anything with edge cases** (`reschedule.ts`, `lanes.ts`, `pane-overrides.ts` are the house proof), and **docs that correct their own prior drafts with reproduced failures** (`rn-087-upgrade-brief.md`) — the exact artifact-level honesty the anti-slop standard asks for.
