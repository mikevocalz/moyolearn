# Moyo

**Learn it by heart.**

AI tutoring that helps children get a better education — and makes the humans around each
child (parents, tutors, teachers) measurably better at helping them.

Universal monorepo: **Expo (iOS/Android) + Next.js (web + Payload CMS)** sharing screens via
**Solito** and a **Uniwind** UI kit, with **Storybook** for the components.

> Specs live in `docs/pack/` — start with `00-START-HERE.md`. Working rules for agents and
> humans are in `CLAUDE.md`; prompt templates are in `PROMPTS.md`.
>
> The name **Moyo** (Swahili: *heart*) is pending trademark clearance — see doc 02,
> Addendum B. Class 41 conflict analysis is required before brand spend.

## Layout

```
apps/
  mobile      Expo app (expo-router) — renders screens from packages/app
  web         Next.js app — (site) route group + (payload) Payload admin/API
  storybook   Storybook (react-vite + react-native-web) for packages/ui
packages/
  app         Shared screens (Solito pattern: screen.tsx / .native.tsx / .web.tsx) + providers
  ui          Universal UI kit — @expo/html-elements + @expo/ui + Uniwind, SolitoImage-based Image
  theme       Design tokens + theme.css (light/dark via data-theme)
  assets      Shared fonts (see Type below) and brand images, all OFL
  payload     Payload config (Users + Media collections, postgres adapter)
  config      Shared tsconfig/eslint presets, boundary rules, and the local lint rules
tooling/
  generators  pnpm gen domain <name> | feature <name> | component <Name>
  check-barrels.mjs  fails the build on a module no entry point reaches
```

## Type

Three faces, one source (`packages/assets/fonts/`), two loaders — the `expo-font` config
plugin on native, `next/font/local` on web. Nothing is fetched from Google at runtime.

| Role | Face | Job |
|---|---|---|
| display | **Archivo Black** (Omnibus-Type) | headlines, rationed — one display moment per screen |
| sans | **Space Grotesk** (variable 300–700) | everything else |
| mono | **Chivo Mono** (variable 100–900, roman + italic) | tabular data — schedule times, prices, mastery — and the `moyo · n. heart` dictionary device |

Chivo Mono is Omnibus-Type like Archivo Black, so the mono reads as family with the display
face rather than a fourth voice. The italic cut ships because the dictionary device sets its
part-of-speech in italic, and a synthesised oblique on a brand lockup reads as cheap.

Its `tnum` and `zero` features are **off until asked for**, so `build-css.mjs` enables them on
the whole family — otherwise the default `0` sits a hair away from `O`. One platform caveat:
web gets `tabular-nums slashed-zero`, native gets `tabular-nums` only, because React Native's
`fontVariant` has no slashed-zero equivalent.

## Color

Feature code never names a primitive scale. Several scale names are historical lies kept for
class compatibility (`burgundy` is electric yellow, `gold` is blue), so the design language
is expressed through schoolhouse semantic aliases:

`highlighter` (a surface — carries `on-highlighter`) · `ballpoint` · `redpen` · `grade`
(marks — each clears WCAG AA against `surface` in both modes).

`redpen` is teacher feedback and is deliberately not `danger`: a correction is not an error.

## Quick start

Node is pinned (`.nvmrc`, `engine-strict`) — `nvm use` first, or pnpm will refuse to run.

```sh
nvm use
pnpm install

# Web (Next + Payload admin at /admin — needs DATABASE_URL + PAYLOAD_SECRET in .env)
cp .env.example .env
pnpm --filter web dev

# Mobile (Expo)
pnpm --filter mobile ios      # or: android / dev

# Storybook — browse the whole UI kit
pnpm --filter storybook dev
```

## Conventions

- One version per dependency — everything resolves through the pnpm catalog in `pnpm-workspace.yaml`.
- Screens live in `packages/app/features/*`; route files in apps are thin wrappers.
- `packages/ui` is pure presentation: it depends only on `@acme/theme` (lint-enforced boundaries).
- Web forks use `@expo/html-elements` semantic wrappers from `@acme/ui/tw` — no raw HTML in shared code.
- Scaffold new work with `pnpm gen domain <name>` / `pnpm gen feature <name>` / `pnpm gen component <Name>`.
- Every server operation goes through `protectedOperation()`; only repositories touch `@acme/payload`.
  Identity comes from `ctx`, never from input. These are lint errors, not review comments.
