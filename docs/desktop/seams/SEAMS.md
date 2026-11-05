# Desktop seams

What crosses between `apps/desktop` (Spark 0.0.2, its own npm graph) and the
rest of the repo, and every external symbol the desktop source uses. Paths are
relative to `apps/desktop/node_modules/` after `npm ci` and were read from the
installed files on 2026-11-04. A symbol not listed here is not used.

SOT-KEYWORDS: desktop seams spark nitro theme boundary imports

## 1. Boundaries

| Seam | Direction | Mechanism | Rule |
| --- | --- | --- | --- |
| Root pnpm workspace | none | `"!apps/desktop"` in `pnpm-workspace.yaml` | Desktop never appears in `pnpm-lock.yaml`. Guarded by `apps/desktop/scripts/check-root-isolation.mjs` in `.github/workflows/desktop.yml`. |
| `packages/theme/tokens.ts` | shared → desktop | Relative import `../../packages/theme/tokens`; Metro `watchFolders` adds `packages/theme` | Only `tokens.ts`. It has no imports. `index.ts` and `tenant.ts` are not imported. |
| `@acme/ui` | none (DEFER) | — | Reaches Nitro v1, `@expo/ui`, `expo-router` and Viro across 37 non-story files (2026-11-04 dispositions). Returns when a desktop-safe subpath exists. |
| `@acme/auth` client types | none in D01 | — | PR-D04 owns this seam. |
| Nitro | desktop only | Spark's patched `react-native-nitro-modules` 0.37.0 tarball, pinned in `overrides` and `dependencies` | Never the root's v1 nightly. One copy in the graph (`npm ls react-native-nitro-modules` shows one, deduped). |
| Mobile app (`apps/mobile`) | none | — | Desktop reads `apps/mobile/eas.json` only as the documented source for `https://app.moyolearn.com`. |

## 2. Token mapping (`apps/desktop/src/theme.ts`)

Token lengths are CSS strings; React Native wants numbers. `toPoints` converts
`rem` at 16 (no `polyfills.rem` on desktop, unlike mobile's 14) and `px` as-is.
The desktop shell uses the `cool` dial throughout.

| Desktop name | Token |
| --- | --- |
| `color(name, scheme)` | `semantic[name].light` / `.dark`, picked by RN `useColorScheme()` |
| `space.hair … space.section` | `spacingTiers['inset-hair' … 'section'].cool` |
| `corner.control / card / sheet` | `radius.control / card / sheet` |
| `target` | `targets.adult` (44px) |
| `textStyle(step)` | `uiRamp[step].cool` → fontSize, lineHeight, fontWeight |
| Sidebar width | `navChrome.railExpanded` (240px) |
| Body measure | `contentWidths['content-feed']` (38rem) |

The brand faces in `nativeFontFamilies` are not bundled into the desktop app,
so text renders in the system face. Font bundling is DEFER (see PR body).

## 3. Spark 0.0.2 symbols

Package subpaths re-export vendored packages under
`@legendapp/spark/vendor/node_modules/@legendapp/` (abbreviated `V/` below).

| Import in apps/desktop | Symbol | Defined at | Native surface |
| --- | --- | --- | --- |
| `@legendapp/spark/runtime-entry` (`index.ts`) | side-effect entry | `@legendapp/spark/runtime-entry.cjs` → `V/spark-cli/dist/runtime-entry.cjs` | Spark host bootstrap |
| `@legendapp/spark/metro` (`metro.config.js`) | `withDesktop` | `@legendapp/spark/metro.d.cts:12`, `metro.cjs:1` | — |
| `expo-desktop-metro-config` 55.83.3 (`metro.config.js`) | `makeMetroConfig` | `expo-desktop-metro-config/src/index.js:8` | — |
| `@legendapp/spark/dialogs` | `openFileDialog` | `V/spark-file-dialog/src/index.ts:27` | NSOpenPanel |
| `@legendapp/spark/dialogs` | `showMessage` | `V/spark-message-dialog/src/index.ts:99` | NSAlert |
| `@legendapp/spark/menus` | `useMenu` | `V/spark-native-menu/src/hooks.ts:8` | NSApplication main menu |
| `@legendapp/spark/menus` | `MenuRootItem` (type) | `V/spark-native-menu/src/api.ts:13` | — |
| `@legendapp/spark/context-menu` | `showContextMenu` | `V/spark-context-menu/src/index.ts:16` | NSMenu |
| `@legendapp/spark/context-menu` | `getContextMenuAvailability` | `V/spark-context-menu/src/index.ts:11` | — |
| `@legendapp/spark/ui` | `Button` | `V/spark-ui/src/desktop.tsx:16` (via `index.macos.tsx`) | NSButton |
| `@legendapp/spark/ui` | `Select` | `V/spark-ui/src/desktop.tsx:55` | NSPopUpButton |
| `@legendapp/spark/ui` | `getControlAvailability` | `V/spark-ui/src/availability.ts:4` | — |
| `@legendapp/spark/ui` | `ControlRef` (type) | `V/spark-ui/src/types.ts:5` | — |
| `@legendapp/spark/links` | `openURL` | `V/spark-desktop-links/src/api.ts:14` (via `index.macos.ts`) | NSWorkspace open |

Menu targets use `MenuTarget = { menu: MenuLocation }` with `"file" | "view" | "help"`
(`V/spark-desktop-app/src/contracts/menu.ts:6-7`). Shortcut strings go through
`parseAccelerator` in the same file.

`@legendapp/spark/message-dialog` is not an export of 0.0.2. The `exports` map
in `@legendapp/spark/package.json` has `./dialogs`, which re-exports both
`spark-file-dialog` and `spark-message-dialog`.

## 4. Other runtime symbols

| Import | Symbol | Defined at |
| --- | --- | --- |
| `react-native-nitro-modules` 0.37.0 (lazy `require`) | `NitroModules` | `react-native-nitro-modules/lib/typescript/turbomodule/NativeNitroModules.d.ts:2` |
| same | `.version`, `.buildType`, `.getAllHybridObjectNames()` | `react-native-nitro-modules/lib/typescript/NitroModulesProxy.d.ts:46, 40, 35` |
| `zustand` 5.0.16 | `create` | `zustand/react.d.ts:13` |
| `expo` 55.0.32 (`index.ts`) | `registerRootComponent` | `expo` package root |
| `react-native` 0.83.10 | `useColorScheme`, `Image`, `Pressable`, `ScrollView`, `StyleSheet`, `Text`, `View` | `react-native` package root |

`react-native-nitro-modules` is required inside a `try` because importing it
throws `ModuleNotFoundError` when the host has not installed the NitroModules
TurboModule (`react-native-nitro-modules/src/turbomodule/NativeNitroModules.ts`).

## 5. Configuration seams

| File | Field | Value | Source |
| --- | --- | --- | --- |
| `desktop.config.json` | `projectId` | `3e9cc7ca-114f-4ae5-ae40-ed5163ca59bd` (generated once by `spark create`) | Only required field in `@legendapp/spark/schema.json` |
| `desktop.config.json` | `macos.bundleIdentifier` | `com.moyolearn.desktop` | `spark create --bundle-id` |
| `desktop.config.json` | `window.size` / `window.minSize` | 1280×800 / 900×600 | PR pack design handoff |
| `desktop.config.json` | `window.restoreBounds` | `true` | Schema field; the PR pack's `restoreFrame` does not exist in 0.0.2 |
| `desktop.config.json` | `expo.experiments.autolinkingModuleResolution` | `false` | Works around the `react-native-windows` config load failure (ADR 0001) |
| `package.json` | `scripts.postinstall` | `node node_modules/@legendapp/spark/init-template.cjs` | Generated; required |
| `app.json` | — | generated by the CLI from `desktop.config.json`, gitignored | Spark `.gitignore` template |
