# React Native Skia v3: DEFER (2026-11-04)

Closes PR #135 (`upgrade/npm-latest-skia-v3-2026-11-02`) without merging. This file is the record the close comment links to.

## Disposition

DEFER. The blocker is the merge gate in `docs/business/npm-policy.md`, not a version conflict:

> Frozen install plus all framework checks; browser keyboard/touch tests; iPad and Android native builds/device checks.
> Skia/Graphite binary versions and JS WebGPU owner compatibility proven before enabling PhotoCraft renderer.

Moving to Skia v3 is a package rename (`@shopify/react-native-skia` to `react-native-skia`) plus a native renderer swap. Its iPad and Android device checks, and the visionOS and PICO checks #135's own body lists, need hardware this pass does not have. A green CI run would cover the simulator and emulator lanes only.

## What was checked on 2026-11-04

| Fact | Evidence |
| --- | --- |
| npm `latest` for `react-native-skia` is 3.9.1 (published 2026-11-03). #135 pins 3.8.1. | `npm view react-native-skia dist-tags` |
| 3.9.1 depends on `react-native-webgpu-dawn` 157.1.0 and `react-native-skia-graphite-{android,apple-ios,apple-tvos,apple-macos}` 157.1.0. | `npm view react-native-skia@3.9.1 dependencies` |
| Main already ships Dawn and Graphite 157.1.0 and `react-native-webgpu` 0.21.1 (#140). The Dawn line no longer conflicts. | `pnpm-workspace.yaml` on `fc96126a` |
| `@shopify/react-native-skia` `latest` is still 2.14.0, which main pins. The npm gate's TARGETS list names that package, so main passes the freshness gate without v3, and deferring is not a fallback to an old release. | `npm view @shopify/react-native-skia dist-tags.latest`; `tooling/business-studio-npm.mjs` |
| 3.9.1 ships no visionOS Graphite package. Main builds a visionOS lane today. | dependency list above |
| #135's head `712b27ad` was pushed by `github-actions[bot]`; all six workflow runs sit at `action_required` with no result. The previous head `ddbc355a` failed `verify`, iOS `simulator` and Android `quest` at `pnpm install --frozen-lockfile`. | `gh run list --branch upgrade/npm-latest-skia-v3-2026-11-02` |
| #135 also moves Expo, Next, Better Auth 1.7.15, Payload 4 beta.6 and Node 24.22.1 in the same diff. | PR body |

## Conditions that reopen it

Open a fresh branch from `main`, never from #135's head, when all of these hold:

1. A visionOS answer: either a Graphite `xros` slice ships, or the visionOS lane keeps Skia stubbed the way it already stubs WebGPU (`apps/mobile/react-native.config.js`).
2. An iPad, an Android phone and the PICO headset are available for the device checks the policy requires.
3. The npm gate's TARGETS entry changes from `@shopify/react-native-skia` to `react-native-skia` in the same PR, with `docs/business/npm-latest.lock.json` refreshed.
4. `tooling/enable-skia-graphite.mjs` is rewritten or removed. In v3 the Graphite binaries are direct dependencies of `react-native-skia`, so the v2 staging step and its admission stamp no longer apply.

Ship only the Skia move in that PR. Better Auth 1.7.15 depends on the `better_auth.account.issuer` migration that follows #134, and Payload 4 beta.6 needs its own decision about running a beta in production. Neither belongs in a renderer change.

`tooling/migrate-skia-v3.mjs` and `docs/architecture/npm-latest-skia-v3-2026-11-02.md` stay on the #135 branch for reuse.
