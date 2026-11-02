# Moyo Learn — npm latest + React Native Skia 3 migration (2026-11-02)

> **Staged / draft-only:** This branch intentionally changes dependency manifests, not production deployments. Do not merge until lockfile, auth schema, native and tenant/guardian regression gates pass. Connected Supabase currently does not expose a Moyo database, so no live migration was run.

## What “latest” means here

- Use the latest published, compatible **npm** package releases, pinned exactly. Prefer npm's `latest` dist-tag for stable packages; use the *Payload 4 beta* and matching Delmare `next` prerelease because the existing code is built on Payload 4.
- **Skia v3 is not under `@shopify/react-native-skia`.** New package: `react-native-skia@3.8.1`; old namespace stops at 2.14.0. Update **every** tracked JS/TS import, deep import and test mock; never install both concurrently.
- The SDK 58 / RN 0.88 / Viro / visionOS / Nitro / Executorch integration is a constrained native matrix. Vendor tarballs are not npm releases and cannot be upgraded by selecting npm `latest`. Do not silently drop vendored patches or replace working XR modules.
- This branch stages the critical base framework/auth/Skia family. Remaining catalog entries still need a complete npm dist-tag audit and individually reviewed upgrade batches; this is **not** a certified all-dependencies upgrade.

## Staged exact targets

| Package | Source | Target |
| --- | --- | --- |
| `react-native-skia` | migration guide; npm is **new package** | `3.8.1` |
| `react-native-webgpu` | npm latest (already current) | `0.19.2` |
| `expo` | npm latest SDK 58 | `58.0.22` |
| `react-native` | npm latest stable | `0.88.1` |
| `next` and `eslint-config-next` | npm latest stable | `16.4.3` |
| `better-auth`, `@better-auth/expo`, `@better-auth/stripe`, `auth` CLI | npm latest stable | `1.7.15` |
| `payload` and `@payloadcms/*` | coordinated v4 prerelease | `4.0.0-beta.6` |
| `@delmaredigital/payload-better-auth` | v4-compatible `next` tag | `0.40.0-next.0` |
| Node | Delmare v4 adapter runtime peer floor | `24.22.1` |

**Important:** Merely adding the Delmare adapter as a dependency does **not** migrate authentication. Follow Moyo PR #134 for the ID mapping, schema migration and staged cutover. Better Auth `1.7.2` left `better_auth.account.issuer NOT NULL` and an old `(issuer, accountId)` unique index; these must be migrated and validated *before* moving real auth writers to 1.7.15. No production auth writes from this branch.

## Skia v3 details

1. Use `node tooling/migrate-skia-v3.mjs --write` to rewrite repo-tracked TS/JS imports; `--check` fails if imports are left. Review its diagnostic output of removed Skia v2 APIs. `tooling/enable-skia-graphite.mjs` is the **old**, npm-v2-specific native staging script, so root `postinstall` no longer runs it; v3's binary dependencies own Graphite and Dawn.
2. `react-native-skia@3.8.1` and `react-native-webgpu@0.19.2` both depend on `react-native-webgpu-dawn@157.0.0`; verify a **single** Dawn copy is resolved, then run native builds. Do not allow a second Skia native module from transitive dependencies.
3. Android Vulkan 1.1 and API level 26 are required. Moyo already registers `./plugins/with-webgpu-min-sdk` and `expo-build-properties` in `apps/mobile/app.config.ts`; confirm the generated Android `minSdkVersion` and merged manifest in `expo prebuild --clean` output. Android hardware without Vulkan support will have blank Skia canvases; decide support requirements and document device eligibility.
4. iOS deployment target is already 17.0 (v3 minimum 15.1). Run `pod install` / iOS native build with the new Skia binary pod dependencies. Verify the **visionOS** and PICO builds separately; v3's documented support is not a guarantee that Moyo's custom viro/visionOS fork will link.
5. `Expo Go` cannot run Skia v3 because it ships Skia v2. Use custom development builds for simulator/device tests.
6. Removed APIs include `makeImageFromView`, `makeImageSnapshotAsync`, `Skia.Surface.Make`, and deprecated Canvas props. Check whiteboard, native tutor canvas, board snapshot, Rive/Skia effects, Skia/TypeGPU and three.js texture sharing.

## Branch preparation

The branch-only GitHub workflow `prepare-npm-skia-upgrade.yml` is intended to run `migrate-skia-v3` and regenerate `pnpm-lock.yaml` on a GitHub runner with network access. This environment cannot connect to the npm registry, so the lockfile cannot be regenerated locally here. **Until that job succeeds, the draft branch may fail frozen-lockfile CI.** The job may fail on existing pnpm patches, peer requirements or other current native dependencies; those failures must be fixed before merging. It does not deploy, merge or change auth data.

Required review commands after lockfile generation:

```sh
pnpm install --frozen-lockfile
node --test tooling/migrate-skia-v3.test.mjs
node tooling/migrate-skia-v3.mjs --check
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @acme/avatar probe:shaders
pnpm --filter @acme/avatar probe:shaders:webgpu
pnpm --filter @acme/avatar golden:compare
pnpm --filter mobile android
pnpm --filter mobile ios
pnpm --filter mobile visionos:build
```

### Release gating

- **Auth:** no account/schema writes until identity mapping/backfill, guardian restrictions, district host gating, billing and OTP/Resend verification gates pass on staging.
- **Native:** Expo SDK58, RN 0.88, WebGPU Dawn, Skia v3, React 19.3, Viro, Nitro modules, Executorch OCR and headset/pad device builds all pass. Review shader visual changes; not just a TS compile.
- **Package surface:** any transitive peer still requiring `@shopify/react-native-skia` blocks Skia v3 until replaced (old and new packages share a native module).
- **No silent deployment:** production remains on main until compatibility and migration tests have actual evidence.

## Primary references

- https://wcandillon.github.io/react-native-skia/docs/getting-started/migration/
- https://wcandillon.github.io/react-native-webgpu/docs/integrations/react-native-skia
- https://github.com/delmaredigital/payload-better-auth/tree/v0.40.0-next.0
- https://github.com/mikevocalz/nyc-mon/blob/main/packages/payload/src/payload.config.ts
- https://github.com/mikevocalz/moyolearn/pull/134
