# Overhaul v2 — Deliverable Q: App-Wide Token System (document of record)

What it is: the single app-scoped token system document doc 38 §5 Phase 0 called for — documents, never defines; `packages/theme/tokens.ts` → `build-css.mjs` is the source.
Why it exists: `docs/site/tokens.md` covers only the marketing site; the app's token system lived in code and scattered pack sections until now.
Source of truth: packages/theme/tokens.ts, packages/theme/tenant.ts, docs/pack/08-visual-hierarchy-spacing-spec.md, docs/pack/36 §5.
SOT-KEYWORDS: overhaul, tokens, role-accent, tenant-accent, spacing-tiers, age-band-targets, typography, dial

## Ownership and pipeline

- All raw values live in `packages/theme/tokens.ts` (939 lines; "no hex outside this file"). One genuine leak existed (`packages/ui/TrendLine.native.tsx:54` `#2952D9`) — fixed 2026-09-01 to `semantic.ballpoint` (dark-adapts).
- `build-css.mjs` emits `theme.css` (Tailwind v4 `@theme`, `light-dark()`) and `theme-native.css` (Uniwind `@variant`). TS consumers (Skia, charts, color math) import tokens directly.
- Enforcement tooling: `tooling/check-role-accent.mjs` (accent slot allowlist), `tooling/check-controls.mjs` (single control radius), `tooling/check-contrast.mjs` (pairs now DERIVED where a convention names them — `on-*` carried foregrounds, `accentRoles` × ink at the 14:1 parity bar, `resourceAccents` × the schedule's real class strings; only convention-less pairs stay declared. Fixed 2026-09-01 after the declared-only design missed the live schedule-accent AA failure and never checked teacher/school role accents), `pnpm ui:sweep` drift reports.

## Primitive trap

Primitive scale names are documented lies kept for class-name stability: `burgundy` = electric yellow, `gold` = blue, `ember` = hot pink, `ink` = paper-cream→black. Feature code uses semantic aliases only; primitives are for the theme layer and TS color math.

## Semantic layer

- Surfaces: `surface` / `surface-raised` / `surface-sunken` (Surface is a token family, deliberately not a component).
- Text: `text` / `text-muted` / `text-inverse`. Primary/accent: `primary`/`primary-pressed`/`on-primary`, `accent`/`accent-pressed` (hand-tuned `#E3307E`; `ember[600]` measured 4.25:1, below AA) / `on-accent`.
- Borders are ink, not grey ("the outline IS the design"): `border` / `border-strong` / `border-soft` (80%) / `border-faint` (10%). Borders are structure, never emphasis (CLAUDE.md).
- Shadows: hard offset slabs `4px 4px 0 0 var(--color-border-strong)` — no blur, ever. Radius: single `control` 0.375rem, tool-enforced.

## Role accent (doc 36 §5 — implemented)

Derived in OKLCH (fixed L≈0.88–0.95, C≈0.10–0.13, rotated hue), shipped as hex because RN cannot evaluate `oklch()`/`color-mix()`. Each role mints `role-<x>` + `role-<x>-underlay` (pre-resolved rgba 0.24); generic `role-accent`/`on-role-accent` resolve per `RoleScope`. Parity bar ≥14:1 ink-on-accent so one contrast verification covers all roles.

| Role | Hex | OKLCH origin |
|---|---|---|
| learner | `#FFDB33` (brand, hue 95°) | 14.36:1 — the bar |
| guardian | `#95EBFF` | oklch(0.90 0.10 230) |
| tutor | `#EDD4FF` | oklch(0.915 0.10 300) |
| teacher | `#FFD5C4` | oklch(0.955 0.11 30) — re-minted 2026-09-01: the 0.93 mint measured 13.09:1 under ink, below the bar, unchecked until pairs were derived |
| org | `#FFD7A5` | oklch(0.95 0.12 50) |
| school | `#BFF5C8` | oklch(0.92 0.10 150) |
| district | `#83EFF5` | oklch(0.89 0.10 200) |
| admin | none — graphite ramp, deliberately |

Allowlisted slots only: active-nav underlay, avatar ring, hero band, header underline, email band. Never: semantic states, body text, borders, primary button (ink-filled everywhere). One accent moment per screen. `accentRoles` (tokens.ts:276) is the single list driving `.role-*` scopes, `RoleScope`, and contrast pairs.

## Tenant accent

Two layers: (1) ~22 `tenant-*` semantic defaults in tokens (`tenant-primary`, `tenant-accent`, `tenant-sidebar-active`, `tenant-focus-ring`, `tenant-success/warning/danger`, …) so `bg-tenant-*` utilities are always real; (2) `tenant.ts` runtime — `TenantBrand` → `resolveTenantTheme(brand, role)` → `tenantCssVariables(theme)`, with `accessibleForeground(background)` doing real relative-luminance math so a tenant can never brand itself into an unreadable header. `roleTheme` maps each role to shell slots (`surfaceHeader/Footer/Muted`, `actionPrimary`, `textOnHeader/Footer`, `surfaceAccent`). Contract: logo + one approved accent + name; semantics invariant.

## Spacing — the dial

Every tier is a `{cool, hot}` pair (doc 08 dial: Hot = learner/guardian, inset 20–24/rows 64+; Cool = ops/admin, inset 12–16/rows 44–52):
`inset-field` .5625/.5625 · `inset-tight` .75/1 · `inset` 1/1.25 · `inset-roomy` 1.25/1.5 · `element` .5/.75 · `stack` .75/1 · `group` 1.5/2 · `section` 2/3 (rem).
Token names are deliberately unprefixed (`stack`, not `gap-stack`) — Tailwind composes `gap-stack` from `--spacing-stack`; a `gap-` prefix in the token would silently no-op every usage.

## Age-band touch targets

`targets`: `floor` 24px (WCAG 2.2 AA CI minimum, never a design target) · `adult` 44 · `teen` 48 (6–12) · `child` 56 (3–5) · `young` 72 (K–2, NN/g 4× finding). Consumed as `min-h-target-*`; "a function of the signed-in child, not a hardcode" — which makes the live-auth band-population defect (A-repo-audit) a token-system defect too: unset band ⇒ teen targets for a six-year-old.

## Typography

Families: Archivo Black (display) · Space Grotesk (sans) · Chivo Mono (data; variable 100–900, `tnum`/`zero`). Working ramp `uiRamp`: `title-lg`, `title`, `body-lg`, `body`, `label`, `caption` (12px floor, never actionable text), `data`, `data-lg` — per-dial `[size, lineHeight, weight]`. `typeScale` display-2xl…display-sm reserved for hero moments (one display moment per screen). Bands change size/density via the dial + targets, not typeface.

## Width systems (two, deliberately separate — do not merge)

1. `widthClassMinDp` — M3 4-band compact/medium/expanded/large (0/600/840/1200dp) → multi-pane policy (`adaptive-panes/constants.ts`). Matches doc 38 §4's numbers.
2. `size-class.constants.ts` — binary compact|regular at 768px → one-vs-two-column decisions (TwoPaneShell, TutorStage, DashboardShell, Text ramp). CSS-resolved where SSR is in play.

## Content widths / misc

`contentWidths` incl. `pane-primary` 20rem, `pane-primary-narrow` 16rem, `pane-supplementary` 21rem, `pane-inspector` 20rem, `pane-tutor` 23.75rem. Plus `zIndex`, `motion`, `readingComfort`, `dial`, `breakpoints`; marketing-site layer (`siteColors`, `moyoShadow*`, `siteTypeScale`) is web-vite-scoped and out of app scope.

## Open token work (queued)

1. ~~Fix `TrendLine.native.tsx` hex leak~~ DONE 2026-09-01 (`semantic.ballpoint[scheme]`).
2. ~~Derive `check-contrast.mjs` pairs~~ DONE 2026-09-01: pairs derived from `accentRoles`, `on-*` naming, and `resourceAccents` × `accent-classes.ts`; schedule selected events fixed to ink-on-accent-400 (all ≥5.80:1, were ember 3.44 / sky 4.32 / gold 4.46 white-on-500); `role-teacher` re-minted `#FFD5C4`.
3. ~~Band-variant consumption for `ProgressBar`/`MasteryBar`~~ DONE 2026-09-01 (optional `band` tv variant consuming `min-h-target-*`; defaults byte-identical). Wider retrofit list lives in J-component-plan §7.
4. Chart palette tokens (TrendLine et al.) — charts currently have no named token set.
