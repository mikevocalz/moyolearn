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
