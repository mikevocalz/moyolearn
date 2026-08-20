# Toolchain notes

## Node floor

Node **24.x**, range `>=24.15.0 <26`. Two walls, one narrow overlap: Payload `4.0.0-canary.28`
raised its floor to 24.15.0, and Expo's config loader dies on Node 26 (`stripTypeScriptTypes`
rejects `mode: 'transform'`). **24.19.0** is the pinned version. Declared in `package.json`
`engines`, enforced by `engine-strict=true` in `.npmrc`, and pinned for CI/EAS by `.nvmrc` +
`eas.json`'s `base` profile. Bump `.nvmrc`, `eas.json` and `engines` together — CI reads the file
via `node-version-file`, and a mismatch fails `pnpm install` outright under `engine-strict`.

**`.nvmrc` does not protect Gradle.** The Gradle daemon is long-lived and keeps the environment of
whichever shell first forked it, so it will keep invoking a stale `node` indefinitely — surfacing
as `expo-constants:createExpoConfig` failing with `command 'node' finished with non-zero exit
value 1`, or `The property 'options.mode' must be one of: 'strip'. Received 'transform'` (Node 26
rejecting `stripTypeScriptTypes`). Run `./gradlew --stop` after changing Node versions.

## Known trap: className augmentation and the Strict TypeScript API

**Do not enable `"react-native-strict-api"` in `customConditions` while on RN 0.86.** It
typechecks green in isolation and then fails in three packages with errors that appear to come
from `solito`, `expo-image` and `@legendapp/*`.

Cause: a styling library augmenting RN's prop interfaces. Post-Uniwind migration this is
`uniwind/types` (referenced by the generated `apps/mobile/uniwind-types.d.ts`); it was
previously `react-native-css/types.d.ts` via `nativewind/types`. Either way it does
`declare module "react-native" { interface ViewProps { className } }`.
On RN 0.86 the Strict API emits `ViewProps` as a **type alias**, which an interface cannot merge
into — so the augmentation shadows it and `ViewProps` collapses to `{ className?, cssInterop? }`,
taking every accessibility prop with it. RN 0.87 emits it as an **interface**, and it merges.

Full write-up, evidence and repro: [`rn-087-upgrade-brief.md`](rn-087-upgrade-brief.md).

## Versioning

Every dependency version lives once, in the `catalog:` block of `pnpm-workspace.yaml`. Package
`package.json` files reference `catalog:` — do not pin versions in them.

## Resolved: turbo input-hashing (2026-08-20)

`turbo build` used to fail at input-hashing with `I/O error: Is a directory (os error 21)` for the
`web` and `storybook` tasks — the two whose `turbo.json` `inputs` use `../..`-relative globs.
**This no longer reproduces on turbo 2.10.10**; both tasks hash and execute. The globs were left
in place. Kept here so the failure is recognisable if a turbo bump reintroduces it.

## Keeping native packages out of the web graph

`apps/web` resolves `react-native` → `react-native-web` via `turbopack.resolveAlias`, but that
rewrites the **bare specifier only** — deep subpaths like `react-native/Libraries/**` sail past it
and reach Turbopack as unstripped Flow, which is a parse error, not a warning.

So a single native-only import anywhere in `packages/app` can break `pnpm --filter web build`,
even from a file the web app never renders, because `packages/app/index.ts` re-exports everything
and `not-found.tsx`/`error.tsx` pull the barrel in. `react-native-gesture-handler`,
`react-native-reanimated` and `expo-image-picker` are the usual culprits.

The fix is always the same, and it is a fork, never a `transpilePackages` entry: keep the native
package inside a `.native.*` file behind an extension fork (`x.ts` anchor + `x.native.ts` +
`x.web.ts` + `x.types.ts`, as in `pick-file`, `download`, `pick-note-image`, `settings-scroller`).
Import the fork **without a file extension** — writing `'./pick-note-image.ts'` pins every
platform to the anchor and silently defeats the fork.

## Upgrade reference list

React Native 0.87 / Metro 0.87:

- [RN 0.87 release post](https://reactnative.dev/blog/2026/08/11/react-native-0.87)
- [Strict TypeScript API](https://reactnative.dev/docs/strict-typescript-api) ·
  [migration guide](https://reactnative.dev/docs/strict-typescript-api#migration-guide) ·
  [refs → instance types](https://reactnative.dev/docs/strict-typescript-api#refs-now-use-instance-types-since-087) ·
  [opting out](https://reactnative.dev/docs/strict-typescript-api#opting-out-since-087) ·
  [FAQs](https://reactnative.dev/docs/strict-typescript-api#faqs)
- [Moving Towards a Stable JavaScript API](https://reactnative.dev/blog/2025/06/12/moving-towards-a-stable-javascript-api)
- [Strict API feedback thread](https://github.com/react-native-community/discussions-and-proposals/discussions/1015)
- [Metro configuration](https://metrobundler.dev/docs/configuration/) ·
  [Metro releases](https://github.com/react/metro/releases)
- [SwiftPM RFC #0994](https://github.com/react-native-community/discussions-and-proposals/pull/994)
- [AGP 9 RFC #1006](https://github.com/react-native-community/discussions-and-proposals/pull/1006) ·
  [AGP 9.0 release notes](https://developer.android.com/build/releases/agp-9-0-0-release-notes)
- [Upgrade Helper](https://react-native-community.github.io/upgrade-helper/) ·
  [Upgrading docs](https://reactnative.dev/docs/upgrading) ·
  [RN support policy](https://github.com/reactwg/react-native-releases/blob/main/docs/support.md)
