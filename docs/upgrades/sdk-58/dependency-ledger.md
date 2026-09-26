# Dependency ledger — 2026-09-17

Branch `upgrade/expo-sdk-58-beta`, from `f1433ac` on `feat/homework-intelligence`.
Registry read 2026-09-17 via `registry.npmjs.org/-/package/<name>/dist-tags`.

## Payload — upgraded

All seven packages 4.0.0-canary.29 -> **4.0.0-canary.33**, together:
`payload`, `@payloadcms/db-postgres`, `@payloadcms/next`, `@payloadcms/plugin-mcp`,
`@payloadcms/ui`, `@payloadcms/tanstack-start`, and the two overridden packages
`@payloadcms/plugin-cloud-storage` / `@payloadcms/translations`.

`@payloadcms/tanstack-start@4.0.0-canary.33` peers `payload` as an exact pin
(`"payload":"4.0.0-canary.33"`, read from the published manifest), so the group
cannot be split. canary.33 is the head of the canary tag; .30-.32 were skipped over.

Verified: `pnpm typecheck` 19/19, `pnpm test` 12/12, `pnpm --filter web build` emitted
its full route manifest — which is what mounts the Payload admin.

## Upgraded to npm latest — 49 catalog entries

| Package | From | To |
|---|---|---|
| `@anthropic-ai/sdk` | 0.120.0 | 0.126.0 |
| `@better-auth/expo` | 1.7.2 | 1.7.5 |
| `@better-auth/stripe` | 1.7.2 | 1.7.5 |
| `@eslint/eslintrc` | ^3.3.6 | ^3.3.7 |
| `@legendapp/list` | 3.3.6 | 3.3.11 |
| `@react-navigation/native` | 7.3.13 | 7.4.1 |
| `@sentry/nextjs` | 10.71.0 | 10.75.0 |
| `@sentry/react-native` | 8.24.0 | 8.27.0 |
| `@shopify/react-native-skia` | 2.11.1 | 2.12.0 |
| `@storybook/addon-a11y` | 10.5.8 | 10.6.0 |
| `@storybook/react-vite` | 10.5.8 | 10.6.0 |
| `@tailwindcss/postcss` | 4.3.2 | 4.3.3 |
| `@tailwindcss/vite` | 4.3.2 | 4.3.3 |
| `@tanstack/react-query` | 5.101.4 | 5.103.1 |
| `@tanstack/react-router` | 1.170.32 | 1.170.38 |
| `@tanstack/react-start` | 1.168.49 | 1.168.56 |
| `@tanstack/react-virtual` | 3.14.9 | 3.14.13 |
| `@types/pg` | 8.23.0 | 8.23.1 |
| `@types/react` | ~19.2.18 | ~19.3.0 |
| `@types/react-dom` | ^19.2.3 | ^19.3.0 |
| `@vitejs/plugin-rsc` | 0.5.26 | 0.5.35 |
| `auth` | 1.7.2 | 1.7.5 |
| `better-auth` | 1.7.2 | 1.7.5 |
| `date-fns` | 4.1.0 | 4.4.0 |
| `eslint-config-expo` | ~57.0.1 | ~57.0.2 |
| `eslint-config-next` | 16.3.3 | 16.3.5 |
| `lucide-react` | 1.31.0 | 1.47.0 |
| `lucide-react-native` | 1.31.0 | 1.47.0 |
| `next` | 16.3.3 | 16.3.5 |
| `pg-boss` | 12.28.0 | 12.33.0 |
| `playwright` | 1.62.1 | 1.63.0 |
| `react-native-audio-api` | 0.13.3 | 0.13.4 |
| `react-native-keyboard-controller` | 1.22.4 | 1.22.5 |
| `react-native-nitro-modules` | 0.37.0 | 0.37.1 |
| `react-native-reanimated` | 4.5.1 | 4.6.0 |
| `react-native-safe-area-context` | ~5.7.0 | ~5.10.0 |
| `react-native-screens` | ~4.26.0 | ~4.28.0 |
| `react-native-svg` | 15.15.4 | 15.15.5 |
| `react-native-worklets` | 0.10.1 | 0.12.2 |
| `react-native-youtube-bridge` | 2.2.2 | 2.2.3 |
| `sharp` | 0.35.3 | 0.35.4 |
| `storybook` | 10.5.8 | 10.6.0 |
| `stripe` | 22.5.0 | 22.6.2 |
| `tailwind-merge` | 3.6.0 | 3.7.0 |
| `tailwindcss` | 4.3.2 | 4.3.3 |
| `turbo` | 2.10.11 | 2.10.13 |
| `uniwind` | 1.11.0 | 1.12.0 |
| `vite` | 8.2.2 | 8.3.0 |
| `zod` | 4.4.3 | 4.6.5 |

## Deliberately retained

| Package | Held at | Published | Reason |
|---|---|---|---|
| `react-native-executorch` | 0.9.3 | 0.10.2 | 0.10 is an API break, not a bump: the flat export split into `/cv`, `/speech`, `/llm`, `/nlp` subpaths, `OCRDetection` became `OcrDetection`, and `OCRModule` / `isAvailable` / `OCR_ENGLISH` / `SpeechToTextModule` / `WHISPER_TINY_EN` left the root entry. `packages/app/features/capture` imports all of them. Taking it produced 8 compile errors on the homework OCR path. A `/legacy` entry exists; the migration needs a real model init and an OCR inference on a device. |
| `react-native-executorch-expo-resource-fetcher` | 0.9.1 | 0.10.0 | Its own release train. Held with executorch — it registers into that runtime. |
| `three` | 0.185.1 | 0.186.0 | The catalog pins it exactly and requires a reviewed PR with golden diffs: r186 removes `PCFSoftShadowMap` on WebGPU and changes `PhysicalLightingModel.direct()`. Taking it also broke the build — r186 `QuadMesh` now requires a constructor argument (`tutor-avatar-3d.native.tsx:548`). Needs `packages/avatar`'s `probe:shaders`, `probe:shaders:webgpu` and `golden:compare` before and after. |
| `@types/three` | 0.185.1 | 0.186.0 | Moves with `three`. |

## Not taken — reasons, not omissions

```
react                                      19.2.8                 -> 19.3.0                 SDK-managed: comes from the expo release
react-dom                                  19.2.8                 -> 19.3.0                 SDK-managed: comes from the expo release
react-native                               0.86.2                 -> 0.87.1                 SDK-managed: comes from the expo release
expo                                       57.0.15                -> 57.0.23                SDK-managed: comes from the expo release
@expo/metro-runtime                        57.0.12                -> 57.0.15                SDK-managed: comes from the expo release
expo-build-properties                      57.0.16                -> 57.0.20                SDK-managed: comes from the expo release
expo-font                                  57.0.1                 -> 57.0.4                 SDK-managed: comes from the expo release
expo-image                                 57.0.3                 -> 57.0.5                 SDK-managed: comes from the expo release
expo-document-picker                       57.0.1                 -> 57.0.2                 SDK-managed: comes from the expo release
expo-image-picker                          57.0.12                -> 57.0.18                SDK-managed: comes from the expo release
expo-image-manipulator                     57.0.9                 -> 57.0.18                SDK-managed: comes from the expo release
expo-linking                               57.0.7                 -> 57.0.10                SDK-managed: comes from the expo release
expo-router                                57.0.15                -> 57.0.21                SDK-managed: comes from the expo release
expo-screen-capture                        57.0.2                 -> 57.0.3                 SDK-managed: comes from the expo release
expo-secure-store                          57.0.1                 -> 57.0.4                 SDK-managed: comes from the expo release
expo-splash-screen                         57.0.7                 -> 57.0.9                 SDK-managed: comes from the expo release
expo-system-ui                             57.0.2                 -> 57.0.4                 SDK-managed: comes from the expo release
expo-updates                               57.0.17                -> 57.0.22                SDK-managed: comes from the expo release
react-native-gesture-handler               ~2.32.0                -> 3.3.0                  major bump: needs its own migration
@expo/ui                                   ~57.0.11               -> 57.0.18                SDK-managed: comes from the expo release
react-native-webview                       13.16.1                -> 14.0.1                 major bump: needs its own migration
@tanstack/react-table                      8.21.3                 -> 9.2.4                  major bump: needs its own migration
payload                                    4.0.0-canary.33        -> 3.89.0                 on a prerelease track; latest would downgrade
@payloadcms/db-postgres                    4.0.0-canary.33        -> 3.89.0                 on a prerelease track; latest would downgrade
@payloadcms/next                           4.0.0-canary.33        -> 3.89.0                 on a prerelease track; latest would downgrade
@payloadcms/plugin-mcp                     4.0.0-canary.33        -> 3.89.0                 on a prerelease track; latest would downgrade
@payloadcms/ui                             4.0.0-canary.33        -> 3.89.0                 on a prerelease track; latest would downgrade
@payloadcms/tanstack-start                 4.0.0-canary.33        -> 4.0.0-internal.183b315 on a prerelease track; latest would downgrade
graphql                                    16.14.2                -> 17.0.2                 major bump: needs its own migration
typescript                                 ~6.0.3                 -> 7.0.2                  major bump: needs its own migration
@types/node                                ^24.13.3               -> 22.20.3                major bump: needs its own migration
eslint                                     ^9.39.2                -> 10.10.0                major bump: needs its own migration
nitro                                      3.0.260610-beta        -> 3.0.260903-beta        on a prerelease track; latest would downgrade
vite-plugin-react-native-web               2.5.0                  -> 3.2.0                  major bump: needs its own migration
```

---

# SDK 58 — resolved target set

Resolved 2026-09-17 from the release's own metadata, not from npm `latest`.

- `expo@next` = **58.0.0-preview.3**. `engines.node`: `^22.13.0 || ^24.3.0 || ^26.0.0 || >=27.0.0`.
- `react-native` = **0.88.0-rc.0**, from the release's `bundledNativeModules.json` (123 entries).
  Its own peers: `react ^19.2.3`, `@types/react ^19.1.1`.
- Everything SDK-managed came from `expo install --fix`, which rewrote 20 `catalog:`
  references in `apps/mobile/package.json` into literals plus 2 direct pins. Each literal was
  reconciled back into the catalog and the `catalog:` reference restored.

Two of the CLI's answers were rejected, with reasons:

| Package | CLI wrote | Kept | Why |
|---|---|---|---|
| `@sentry/react-native` | `~7.11.0` | 8.27.0 | The SDK's `bundledNativeModules` pin trails Sentry's own releases by a major. `@sentry/react-native@8.27.0` peers `react-native: ">=0.65.0"`, which admits 0.88.0-rc.0. A peer range is a weaker claim than a tested statement — this needs a runtime check before release. Cut with `@sentry/nextjs` 10.75.0. |
| `react` / `react-dom` | untouched (in `expo.install.exclude`) | 19.2.8 | `bundledNativeModules` lists 19.2.3 as the floor and RN 0.88 peers `^19.2.3`; 19.2.8 is already inside it. Taking 19.3.0 would be an unrelated React minor in an SDK change. |

`react-native-reanimated` 4.6.0 and `react-native-worklets` 0.12.2 are also excluded from
`expo install`, so they were set by hand from the same `bundledNativeModules.json` — the pair
the SDK states, not the pair npm calls latest.

## Overrides retargeted

The four Expo overrides existed to stop open peer ranges dragging another SDK's build into
the graph. Left alone they would have pinned 57.x into a 58 runtime, which is what the two
`unmet peer expo-constants@^58.0.3: found 57.0.13` lines were. Each moved to the newest
release inside the range `expo@58.0.0-preview.3` declares for it:

| Override | Was | Now | expo 58 range |
|---|---|---|---|
| `@expo/dom-webview` | 57.0.1 | 58.0.0 | `~58.0.0` |
| `expo-asset` | 57.0.13 | 58.0.3 | `~58.0.3` |
| `expo-file-system` | 57.0.5 | 58.0.0 | `~58.0.0` |
| `expo-modules-core` | 57.0.12 | 58.0.3 | `~58.0.3` |

## Code the upgrade forced — 5 files

| File | Break | Fix |
|---|---|---|
| `packages/ui/Menu.native.tsx` | Strict TypeScript API: `useRef<RNView>` has no host methods, so `measureInWindow` was missing and its four callback parameters fell to implicit `any`. | `useRef<ViewInstance>` — the instance type RN 0.88 exports. |
| `packages/ui/whiteboard-board.native.tsx` | `react-native-webview` 14 (the SDK's pin) declares the export as `React.FunctionComponent<WebViewProps>` rather than a class, so `useRef<WebView>` made every prop on the element resolve to `never`. | `useRef<ComponentRef<typeof WebView>>` — derived from the component. |
| `packages/ui/TenantScope.web.tsx` | RN 0.88 widened `ViewStyle.backgroundImage` to `string \| readonly BackgroundImageValue[]`; react-native-web's stays `string`, so the CSS-variable cast no longer fit the web View. | Derive the style type from the component instead of importing RN's. |
| `packages/ui/Whiteboard.tsx` | RN 0.88 dropped top-level `translateY` from `ViewStyle`, so `{ opacity, translateY }` matched neither half of Legend Motion's `TStyle \| PropsTransforms`. | `y`, which is the library's own transform key. Same movement. |
| `apps/mobile/components/ShellTabBar.tsx` | The Router core rework: `expo-router` 58 added an `exports` map, so the deep import of `bottom-tabs` no longer resolves, and `BottomTabBarProps` lost `navigation` — it now carries `emitter` and `navigateToTab(routeKey)`. | Import the type from the public `expo-router/js-tabs` entry; emit through `emitter` and navigate by `route.key`. The custom JS tabs are otherwise untouched. |

## State

`pnpm typecheck` 19/19 and `pnpm test` 12/12 on expo 58.0.0-preview.3 + react-native
0.88.0-rc.0. `@acme/payload`'s suite failed once and passed on re-run — it exercises a real
Postgres with timing-sensitive sweeps.

Not yet done, and not claimed: native iOS/Android builds, `expo-doctor`, `expo export`, the
iOS 27 scene lifecycle (`SceneDelegate.swift`, `UIApplicationSceneManifest`), Android R8,
`File.write` async callers, the `NODE_ENV` cascade, the `@expo/ui` `<Host>` layout change,
the four `expo.install.exclude` entries re-validated on a device, the expo-router patch
re-derived for 58 (it is keyed to 57.0.15), the Node floor reconciliation, OTA runtime
version isolation, and every Argent run.

---

# Web verification, 2026-09-17 — and one regression it caught

Three subagents, web only. Every claim below was re-run first-hand before being repeated.

## better-auth 1.7.5 broke `account` inserts — reverted

`apps/web` booted with, and returned 500 from `/api/entitlements` and `/api/progress` with:

```
ERROR [Better Auth]: Database schema mismatch
  Required columns Better Auth never writes
    account.issuer
  Inserts into account will fail.
```

`packages/payload/migrations/better_auth_tables.sql:61` is verbatim 1.7.2 `better-auth
generate` output — `account."issuer"` is `text not null` with no default, and line 87 puts a
unique index on `(issuer, accountId)`. 1.7.5 stopped writing that column, so every insert
into `account` fails, which is signup and OAuth account linking.

Introduced by `8b683d9`, which took the whole better-auth group to npm latest. All four
entries (`better-auth`, `@better-auth/expo`, `@better-auth/stripe`, `auth`) are back at
1.7.2.

Before and after, both measured on a fresh `pnpm --filter web build` plus `next start`:

| | `/api/entitlements` | `/api/progress` | schema-mismatch lines in the server log |
|---|---|---|---|
| better-auth 1.7.5 | 500 | 500 | 4 |
| better-auth 1.7.2 | 401 Unauthenticated | 401 Unauthenticated | 0 |

The first attempt at that check was worthless and is recorded here as a caution: the server
was restarted against the **existing** `.next`, which had 1.7.5 bundled into it, so the fix
appeared not to work. Next bundles its server dependencies; a dependency change is not in
effect until the app is rebuilt.

Taking 1.7.5 later means regenerating the DDL with its CLI and migrating the column and
index away per the 1.7 upgrade guide, against a disposable database.

## What passed

| Target | Result | Evidence |
|---|---|---|
| `apps/web` build | exit 0 | 117 routes emitted; TypeScript 52s; 70/70 static pages |
| `apps/web` runtime | serves real SSR | `/login` returns the sign-in form; `/share/report/<bogus>` returns the correct expired-link state; `/nope-404-test` returns the custom 404 |
| `apps/storybook` build | exit 0 | 251 stories across 86 titles in `index.json`; 86 story files, 86 emitted chunks |
| Storybook rendering | 7 stories render | `body.sb-show-main` with real content, loaded in Chrome — not curl |

## Findings that are not upgrade regressions

- **`/admin` 404 is pre-existing.** `app/(payload)/` has no `[[...segments]]/page.tsx`;
  commit `fde9094` "Remove the Payload admin surface from apps/web." (2026-08-31) predates
  every upgrade commit. The Payload REST and GraphQL surfaces are alive at
  `/payload-api/[...slug]` and `/payload-api/graphql`.
- **`/api/health/jobs` 500 is by design** — `route.ts` returns 500 when the report is
  unhealthy, and `retention.sweep.transcripts` has "no recorded success" locally.
- Unauthenticated page routes render a loading skeleton at SSR because the session gate is
  still pending. `/login` proves the pipeline emits real HTML.

## Smaller things the run surfaced

- `pnpm --filter web start -- -p <port>` is broken: `apps/web/scripts/next.mjs` forwards
  `process.argv.slice(3)`, so `-p` arrives as a positional and Next reads it as a project
  directory. Use `PORT=`.
- `withSentryConfig` imported from `@sentry/nextjs` is deprecated and stops working in v11;
  it moves to `@sentry/nextjs/config`.
- `turbopackServerFastRefresh` is listed as an unsupported experiment flag.
- `expo/tsconfig.base` no longer resolves under SDK 58's `exports` map — fixed in `e6dbe8b`.
- `apps/storybook/.storybook/main.ts` globs `packages/ui/html/*.stories.@(ts|tsx)`, which
  matches nothing.
- `vite-plugin-react-native-web` uses `optimizeDeps.esbuildOptions` and
  `transformWithEsbuild`, both deprecated by Vite 8.

## The two Vite apps

Both verified at `fdc02b4` after a from-scratch rebuild, because two commits landed
mid-verification and the earlier numbers would have described a different tree.

| Target | Build | Serving |
|---|---|---|
| `apps/web-vite` | exit 0, 16 pages prerendered, output `.output` (nitro `node-server`) | `/`, `/pricing`, `/how-it-works`, `/for-schools` all 200 with real SSR — `<h1>Learning has a heart.</h1>`, 4371 chars of body text on `/`, correct per-route `<title>`. `curl /` and `.output/public/index.html` hash differently, so the server is rendering rather than serving the prerender. `/definitely-not-a-route` 404. |
| `apps/admin-vite` | exit 0, output `.vercel/output` (nitro `vercel`, `nodejs24.x`, 5-phase RSC) | `/` → 307 `/admin` → 307 `/admin/login` → 200. Protected routes redirect with `?redirect=` intact. `/payload-api/access` returns JSON. |

The admin's 200s are a client-rendered shell — one `<div>`, six `<script>`, no `<form>` in the
HTML — which is what an RSC Flight payload looks like and is expected for the Payload panel.
Loaded in Chrome it renders: title "Login - Payload", an actual form with `email` and
`password`, Login and Stay-logged-in buttons, the Moyo logo overrides live, **0 console
errors over 6 loads**.

### Two traps that are not upgrade fallout

- **A stale orphan `pnpm install` will not prune.** `node_modules/@tanstack/react-router/
  node_modules/@tanstack/react-store@0.9.3` survived under the hoisted linker while
  `@tanstack/react-router@1.170.38` requires `^0.11.0`, producing ten
  `"useSelector" is not exported` errors. The lockfile never mentioned 0.9.3 — it pins
  0.11.1 — so a clean clone or a wiped `node_modules` never sees this, and an incremental
  local tree does. Deleting the directory and reinstalling fixed it; the lockfile is
  unchanged.
- **Root `.env` declares `DATABASE_URL` twice** (line 8 the real Supabase pooler, line 23 a
  `localhost:5432/starter` placeholder). `apps/admin-vite`'s `dev` script does
  `set -a; . ../../.env`, so last-wins gives `password authentication failed for user "user"`
  and the preview process then dies with `ERR_UNHANDLED_REJECTION`. Pre-existing.
  `admin-vite`'s `build` sources no env at all and succeeds without any; only serving needs it.

`apps/web-vite`'s `/` still fires three requests at `http://localhost:3001/api/marketing/voice/
baked/*` and gets `ERR_CONNECTION_REFUSED` — the known hardcoded-origin bug, unchanged by the
upgrade. `/pricing` and `/globe-lab` have zero console errors.

One `/admin/login` 500 appeared on the first load after the server sat idle, with a
`Failed query: select "users"…` in the browser console and nothing server-side. It did not
reproduce across 18 further requests. Consistent with a cold pgbouncer connection on the
Supabase pooler; not pinned down.

## Where the web scope stands

| Target | Build | Serves | Renders |
|---|---|---|---|
| `apps/web` | PASS | PASS | PASS (`/login`, `/share/report/*`, custom 404) |
| `apps/web-vite` | PASS | PASS | PASS (SSR text asserted per route) |
| `apps/admin-vite` | PASS | PASS | PASS (Payload login form, in Chrome) |
| `apps/storybook` | PASS | PASS | PASS (7 of 251 stories, in Chrome) |

Not run, and not claimed: any automated test for any web app — the task graph shows none
exists. No accessibility audit, no visual regression, no performance measurement, no
production-shaped deployment check, and nothing native.
