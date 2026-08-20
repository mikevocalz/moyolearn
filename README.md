# Solito-NativeUI-Starter

Universal app monorepo starter: **Expo (iOS/Android) + Next.js (web + Payload CMS)** sharing
screens via **Solito** and a **Uniwind** UI kit, with **Storybook** for the components.

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
  assets      Shared fonts (Archivo Black + Space Grotesk, OFL)
  payload     Payload config (Users + Media collections, postgres adapter)
  config      Shared tsconfig/eslint presets and boundary rules
tooling/
  generators  pnpm gen domain <name> | feature <name> | component <Name>
```

## Quick start

```sh
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
