# Toolchain notes

## Node floor

Range `^24.15.0 || ^26.0.0`. **24.19.0** stays the pinned version for CI and EAS.

The floor is Payload's: `payload` and `@payloadcms/next` both declare `>=24.15.0`, read from the
installed manifests. The shape — two ranges rather than one `>=` — is Expo's: SDK 58 declares
`^22.13.0 || ^24.3.0 || ^26.0.0 || >=27.0.0`, which excludes the odd majors, and RN 0.88 RC
declares `^22.13.0 || ^24.3.0 || >= 26.0.0`. The intersection with Payload's floor is 24.15+ and
26.x.

**The Node 26 ceiling is gone, and it was tested rather than assumed.** SDK 57's config loader
died on 26 (`stripTypeScriptTypes` rejecting `mode: 'transform'`), which is why the range read
`<26`. On SDK 58 with Node 26.8.2, `pnpm exec expo config --type public` exits 0 and prints the
resolved config, with no `stripTypeScriptTypes` error anywhere in the output. `expo install --fix`
also loads the dynamic `app.config.ts` on 26. Everything else in the repo runs on 26.8.2 too:
install, all four web builds, `pnpm typecheck` 19/19, `pnpm test` 12/12, and `next start`.

`engine-strict` is **false** in `.npmrc`, not true. This section said otherwise and was wrong:
with `engine-strict=false` a mismatch is a pnpm warning, not an install failure — which is why
every command on this machine printed `Unsupported engine` for weeks instead of stopping. Keep
`.nvmrc`, `eas.json`'s `base` profile and `engines` moving together anyway; CI reads `.nvmrc`
through `node-version-file`, so a drift there changes what CI actually runs even though nothing
fails loudly.

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
