# SDK 58 dependency lane — 2026-09-22

Branch `upgrade/expo-sdk-58-preview5`, cut from `upgrade/expo-sdk-58-beta` at `8b2ae90`.
Every version in this file was read from the npm registry on 2026-09-22 with
`npm view <pkg> versions --json` / `npm view <pkg> dist-tags --json`, or from the
published `peerDependencies` of the exact version named. Nothing here is quoted
from a brief.

Scope of this lane: the dependency graph only. No native build, no device run,
no `typecheck`. It is deliberately separate from the SDK 57 hotfix on
`fix/login-verification-natalie-voice`, which ships from `main` for Shipaton.

SOT-KEYWORDS: sdk-58, pnpm-overrides, peerDependencyRules, lockfile-singleton,
typescript-eslint, tiptap, react-viro, expo-pico, payload-storage-bunny

## The brief was wrong about the starting state

The handoff asserted that this branch already carried uncommitted pins for
`expo@58.0.0-preview.5`, the 58.x Expo packages, `react-native-worklets`,
`@better-auth/*`, a `peerDependencyRules` block, and a `@types/react`
devDependency in `packages/payload`. None of that existed.
`git show upgrade/expo-sdk-58-beta:package.json` carried eleven overrides, no
`peerDependencyRules` key at all, and the installed tree resolved `expo` at
`58.0.0-preview.3`. The pins were a target to create, which is what this branch does.

## D0 — the real state, before and after

"Before" is the lockfile at `8b2ae90`. "Registry" is what npm actually publishes
today. "After" is this branch's lockfile.

| Package | Override at `8b2ae90` | Resolved before | Registry `latest` / `next` | Pinned now |
|---|---|---|---|---|
| `expo` | none | `57.0.15`, `58.0.0-preview.3` | 57.0.24 / **58.0.0-preview.5** | `58.0.0-preview.5` |
| `react-native` | none | `0.86.0`, `0.87.0`, `0.88.0-rc.0` | 0.87.1 / 0.88.0-rc.2 | `0.88.0-rc.1` |
| `react` | `19.2.8` | `19.2.8` | — | `19.2.8` (unchanged) |
| `expo-router` | none | `57.0.15`, `58.0.4` | 57.0.x / 58.0.4 | **still split — see below** |
| `react-native-worklets` | none | `0.10.2`, `0.12.2` | 0.13.0 / — | `0.12.2` |
| `@expo/metro-runtime` | none | `57.0.12`, `58.0.3` | 57.0.16 / **58.0.5** | `58.0.5` |
| `expo-constants` | none | `57.0.13`, `58.0.3` | 57.0.19 / **58.0.5** | `58.0.5` |
| `@better-auth/core` | none | `1.7.2`, `1.7.5` | 1.7.5 | `1.7.2` |
| `@better-fetch/fetch` | none | `1.3.1`, `1.3.2` | 1.3.2 | `1.3.1` |
| `@expo/log-box` | none | `57.0.3`, `58.0.3` | 57.0.4 / **58.0.4** | `58.0.4` |
| `expo-font` | none | `57.0.1`, `58.0.1` | 57.0.4 / **58.0.2** | `58.0.2` |
| `expo-keep-awake` | none | `57.0.1`, `58.0.0` | 57.0.2 / **58.0.1** | `58.0.1` |
| `typescript-eslint` family | none | `8.48.0`, `8.63.0` | 8.70.1 | `8.70.1` |
| `@tiptap/extension-{bubble,floating}-menu` | none | `3.30.1` | 3.31.3 | `3.27.1` |

Every version number in the "Pinned now" column was confirmed present in
`npm view <pkg> versions --json` before it was written. `58.0.0-preview.5` does
exist and is the `next` dist-tag on `expo`; so do `@expo/metro-runtime@58.0.5`,
`@expo/log-box@58.0.4`, `expo-constants@58.0.5`, `expo-font@58.0.2`,
`expo-keep-awake@58.0.1`, `react-native-worklets@0.12.2` and
`react-native@0.88.0-rc.1`. Two corrections to the target list worth recording:
`react-native` has since published `0.88.0-rc.2`, which is now the `next` tag —
rc.1 is one behind, and taking it is a choice rather than the newest option.
`react-native-worklets` is at `0.13.0` on `latest`; 0.12.2 is held because
`expo-modules-core@58.0.3` and `react-native-reanimated@4.6.0` both resolve
against it.

## D1 — typescript-eslint pinned to 8.70.1, with a corrected reason

8.70.1 exists and is the `latest` dist-tag. Its published peers:

    typescript-eslint@8.70.1        typescript >=4.8.4 <6.1.0, eslint ^8.57.0 || ^9.0.0 || ^10.0.0
    @typescript-eslint/parser@8.70.1            typescript >=4.8.4 <6.1.0
    @typescript-eslint/typescript-estree@8.70.1 typescript >=4.8.4 <6.1.0

The stated reason — "8.70.1 supports TypeScript <6.1" — is true but it only
separates 8.70.1 from one of the two copies in the lock, not both.
`@typescript-eslint/typescript-estree@8.63.0` already peers `>=4.8.4 <6.1.0`;
it is `8.48.0` that stops at `<6.0.0`, and this repo's catalog is
`typescript: ~6.0.3`. So 8.48.0 was the only version actually outside its own
supported range, and 8.63.0 was fine. The real gain from the pin is collapsing
two copies of a ten-package family into one.

Neither version is declared anywhere in the repo; both arrive transitively.
`8.48.0` comes from `eslint-config-next@16.3.5`, `8.63.0` from
`eslint-config-expo@57.0.2`. That is why the fix is an override rather than a
version bump in a manifest — there is no manifest to bump.

All eleven packages were confirmed to publish 8.70.1 before being listed:
`typescript-eslint` plus `@typescript-eslint/`{`eslint-plugin`, `parser`,
`project-service`, `scope-manager`, `tsconfig-utils`, `type-utils`, `types`,
`typescript-estree`, `utils`, `visitor-keys`}.

## D2 — tiptap menus pinned to 3.27.1

Confirmed first, as instructed: `@tiptap/react`, `@tiptap/core` and `@tiptap/pm`
all resolve to **3.27.1** in this lock, and so do fifteen other `@tiptap/extension-*`
packages. Only `extension-bubble-menu` and `extension-floating-menu` had drifted
to `3.30.1`. Both publish 3.27.1, and at 3.27.1 they peer `@tiptap/core` and
`@tiptap/pm` at the exact string `3.27.1` — so the drift was a genuine peer
violation, not a cosmetic mismatch. Pinned to 3.27.1 to match the rest of the set
rather than dragging twenty packages to `latest` (3.31.3) inside a dependency lane.

## D3 — two vendored tarballs, both deferred, with the cost written down

### `@reactvision/react-viro` 3.0.0-moyo.3

Peers read from `vendors/reactvision-react-viro-3.0.0-moyo.3.tgz`:

    "@reactvision/react-native-visionos": ">=0.86.0 <0.87.0"
    "@reactvision/viro-web-renderer":     ">=0.0.1"
    "expo":                               ">=57.0.0 <58.0.0"
    "react":                              ">=19.0.0"
    "react-native":                       ">=0.86.0 <0.87.0"
    "react-native-web":                    ">=0.19.0"

The brief described this as "a peer of react-native <0.87". It is that, and also
`expo >=57.0.0 <58.0.0`. The tarball excludes both halves of this upgrade, not
one. `react-native ">=0.86.0 <0.87.0"` also means it was already outside its
declared range against `0.88.0-rc.0` on the beta branch — this lane moves it from
one violation to a slightly larger one.

**Decision: not rebuilt.** It is not cheap. moyo.3 is a 53 MB tarball carrying
prebuilt Android AARs and iOS artefacts; a moyo.4 cut against RN 0.88 means
rebuilding the native side of the fork and re-cutting the tarball, which per the
project's own history is a multi-hour native task, not a manifest edit. An
`allowedVersions` entry is in `package.json` instead.

**What that defers, concretely.** The override silences the range check; it does
not make the native code compatible. The Viro fork's Android side links against
React Native's JNI and `ReactPackage`/`ViewManager` surface, and its iOS side
against RN's Fabric component registry — both of which move between 0.86 and
0.88. The first failure mode is a build failure on `pnpm --filter mobile prebuild`
or Gradle/CocoaPods, not a silent runtime bug; if it does link, the exposure is
the XR surface specifically: `packages/ui/xr`, the spatial whiteboard, and the
Natalie avatar path that depends on the moyo skeleton/morph JNI.

**XR still owes an on-device verification.** Nothing in this lane ran on a PICO,
a Quest, or an iOS device. The moyo.3 tarball has never been loaded against
RN 0.88 by anyone. Treat the XR surface as unverified on this branch until that
run happens.

### `@expo-pico/core` 1.0.0

Peers read from `vendors/expo-pico-core-1.0.0.tgz`:

    "expo":                       "~57.0.16"
    "react":                      "*"
    "react-native":               "*"
    "expo-location":              "*"
    "react-native-nitro-modules": ">=0.37.0"

Tighter than the brief's "`expo ~57`": `~57.0.16` resolves to `>=57.0.16 <57.1.0`,
so it excludes every SDK 58 build including the canaries. Its `react-native` peer
is open (`*`), so RN 0.88 does not trip it — the `expo` range is the whole conflict.

**Decision: not rebuilt.** Upstream source is at `/Users/mikevocalz/Downloads/nitro-pico`.
Read-only assessment of the rebuild cost, as instructed — no work started there.
The package is a Nitro module: a rebuild means re-running `nitrogen` codegen and
recompiling the Android/C++ side, then re-cutting the 3.7 MB tarball. It is
smaller than the Viro rebuild but it is still a native build with a device
verification attached, and it is the wrong lane for it. An `allowedVersions`
entry is in `package.json`.

**What that defers.** `@expo-pico/core` binds PICO-specific platform APIs through
`expo-modules-core`, which this branch moves from the 57 line to `58.0.3`. If the
`ExpoModulesCore` native ABI changed between those, the module fails at
autolinking or at first `requireNativeModule` call — on PICO hardware only. No
PICO device was available to this lane, so that is untested.

## D4 — `@seshuk/payload-storage-bunny`: the patch already closes the real gap

The declared peers on both 3.0.0 (installed) and 3.0.1 (`latest`, read from the
registry) are identical:

    "payload":                  "^3.83.0"
    "@payloadcms/translations": "^3.83.0"
    "sanitize-filename":        "1.6.4"
    "@seshuk/payload-plugin-media-preview": "^1.0.0"

This repo is on `payload@4.0.0-canary.33`. Upgrading to 3.0.1 gains nothing — same
range, same problem.

`patches/@seshuk__payload-storage-bunny@3.0.0.patch` already handles the one real
incompatibility. Payload 4 removed `initClientUploads` from
`@payloadcms/plugin-cloud-storage/utilities`, and it is absent from payload core
too; the patch vendors that function verbatim from
`@payloadcms/plugin-cloud-storage@3.88.0` and documents why it runs unmodified —
it only touches `config.endpoints` and `config.admin.{dependencies,components.providers}`,
all unchanged in Payload 4. Every other symbol the adapter imports still exists.

**Decision: do not extend the patch. Document the constraint and declare it.**
Extending the patch would mean inventing a second fix for a problem that has none
left — the runtime gap is already closed and the remaining mismatch is purely a
declaration. So the `^3.83.0` peers get `allowedVersions` entries pointing at
`4.0.0-canary.33`, which says out loud what the patch was silently already
asserting. The one thing that is genuinely deferred: if a later Payload 4 canary
removes or changes another symbol the adapter imports, the patch will not catch it,
and the peer declaration will no longer be there to warn. The patch's own comment
names the exit — remove it when the adapter ships a Payload 4 build.

## D5 — the escaped em dash is not on this branch

Checked, and the regression is real but it is somewhere else. Across all 22 tracked
`package.json` files in this worktree there are **zero** `\uXXXX` escape sequences;
the root `description` holds a literal `—` (U+2014, verified as a raw non-ASCII byte).

    upgrade/expo-sdk-58-beta                  "Moyo — AI tutoring that helps children..."   (literal U+2014)
    codex/homework-scanner-audit-2026-09-21   "Moyo \u2014 AI tutoring that helps children..."   (escaped)
    main                                      "Moyo \u2014 AI tutoring that helps children..."   (escaped)
    origin/main                               "Moyo \u2014 AI tutoring that helps children..."   (escaped)

`main` carries exactly one escaped sequence, and it is that one. The SDK 58 branch
already fixed it — `git diff main upgrade/expo-sdk-58-beta -- package.json` shows the
literal em dash restored there alongside the `engines` and `turbo run` changes.

So there was nothing to restore here. The fix belongs on `main`, and this lane is
forbidden from touching `main`, so it is left as a note: whoever next edits the root
`package.json` on `main` should replace `—` with the literal character, and
should look at whatever tool round-tripped that JSON, because it also rewrote
`turbo dev` to `turbo run dev` in the same pass.

## `@types/react` in `packages/payload` — the brief's one claim that held

Added `"@types/react": "catalog:"` to `packages/payload/package.json`
devDependencies. It is not cosmetic: before it, `pnpm install` reported four
missing-peer chains in that workspace —

    packages/payload
    ├─┬ @payloadcms/ui 4.0.0-canary.33
    │ └─┬ react-select 5.9.0
    │   ├─┬ @emotion/react 11.14.0 → ✕ missing peer @types/react@"*"
    │   ├─┬ @types/react-transition-group 4.4.12 → ✕ missing peer @types/react@"*"
    │   └─┬ use-isomorphic-layout-effect 1.2.1 → ✕ missing peer @types/react@"*"
    └─┬ @seshuk/payload-storage-bunny 3.0.0
      └─┬ @payloadcms/plugin-cloud-storage 4.0.0-canary.33
        └─┬ @payloadcms/ui 4.0.0-canary.33 → ✕ missing peer @types/react@"*"

The catalog already carried `"@types/react": ~19.3.0`, so this adds no new version
to the graph. All four warnings are gone from the install output.

## The assert gate

`pnpm install --no-frozen-lockfile` converged, exit 0. Then the gate, verbatim:

    $ grep -E "^  (expo|react-native|react|expo-router|react-native-worklets|@expo/metro-runtime|'@better-auth/core)@" pnpm-lock.yaml
      expo-router@57.0.15:
      '@better-auth/core@1.7.2':
      expo-router@57.0.15:
      expo-router@58.0.4:
      expo@58.0.0-preview.5:
      react-native-worklets@0.12.2:
      react-native@0.88.0-rc.1:
      react@19.2.8:
      react@19.2.8: {}
      (plus the peer-suffixed snapshot keys for the same versions)

**The gate's own regex has a hole.** `@expo/metro-runtime` cannot match it. pnpm
quotes scoped snapshot keys, so the lockfile line is `'@expo/metro-runtime@58.0.5':`
and the pattern only anchors a quote for `@better-auth/core`. It reports a clean
result for that package by never looking at it. Corrected per-package check:

| Package | Distinct versions | Installed copies (peer-suffix variants) |
|---|---|---|
| `expo` | `58.0.0-preview.5` | 4 |
| `react-native` | `0.88.0-rc.1` | 1 |
| `react` | `19.2.8` | 1 |
| `expo-router` | `57.0.15`, `58.0.4` | 4 |
| `react-native-worklets` | `0.12.2` | 1 |
| `@expo/metro-runtime` | `58.0.5` | 1 |
| `@better-auth/core` | `1.7.2` | 1 |
| `@better-fetch/fetch` | `1.3.1` | 1 |
| `typescript-eslint` | `8.70.1` | 1 |
| `@tiptap/core` | `3.27.1` | 1 |
| `@tiptap/extension-bubble-menu` | `3.27.1` | 1 |
| `@tiptap/extension-floating-menu` | `3.27.1` | 1 |

Read from `pnpm why <pkg> -r --json`, counting distinct `peersSuffixHash` values
per installed root. The `expo` row is the one that needs the distinction the brief
asked for: four entries, one version. Those are peer-suffix artefacts — four
resolution contexts pointing at the same `58.0.0-preview.5` release, distinguished
only by which `expo-router` / `webpack` / `esbuild` they were resolved against.
With `node-linker=hoisted` in `.npmrc` there is one physical `node_modules/expo`.
Four copies of one version is not the failure mode a duplicate framework package
causes; two versions is, and `expo` no longer has two.

## `@better-auth/core` 1.7.5 — true here, false on main

The brief said 1.7.5 leaks in via the `@better-auth/expo` and `@better-auth/stripe`
peers, and noted that `origin/main` disproves it. Both halves are right, on
different branches. On `main` there is only `@better-auth/core@1.7.2`. On the SDK 58
branch at `8b2ae90` there were two, and the split was exactly where the brief said:

    @better-auth/core@1.7.2  <- drizzle-adapter, kysely-adapter, memory-adapter,
                                mongo-adapter, prisma-adapter, telemetry, better-auth, auth
    @better-auth/core@1.7.5  <- @better-auth/expo@1.7.2
    @better-auth/core@1.7.5  <- @better-auth/stripe@1.7.2

Every one of those declares `^1.7.2`; eight resolved to 1.7.2 and two to 1.7.5.
This is worth more than a dedupe. `pnpm-workspace.yaml` documents why the catalog is
held at 1.7.2 — 1.7.5 changes the `account` table DDL, and taking it means
regenerating the schema with the Better Auth CLI and migrating the column and index.
The two packages that had drifted are the Expo client and the Stripe plugin, i.e.
the session and billing paths. A 1.7.5 core loaded beside a 1.7.2 server is the
precise shape of the schema mismatch that comment was written to prevent. The
`@better-auth/core: 1.7.2` override closes it.

## What is left undone

1. **`expo-router` is still two versions** — `57.0.15` and `58.0.4`. Root cause
   found: `packages/ui/package.json` declares `expo-router` as an *optional* peer at
   `"*"`, and with `autoInstallPeers: true` pnpm answers `*` with the registry
   `latest` tag, which is the SDK 57 line. The install still warns:

       packages/ui
       └─┬ expo-router 57.0.15
         └── ✕ unmet peer expo-linking@^57.0.7: found 58.0.3

   It was left split on purpose. Forcing `expo-router` to 58.0.4 orphans
   `patchedDependencies["expo-router@57.0.15"]`, and that patch is not cosmetic — it
   fixes a cold-boot "state update on a component that hasn't mounted yet" race on
   the deep-link path that the patch header records as reproducing on roughly one
   boot in three. The patch cannot be carried forward as written: in 58.0.4,
   `build/react-navigation/native/NavigationContainer.js` no longer exists (half the
   hunks target a deleted file), and in `build/fork/NavigationContainer.js` the
   `useLinking` call no longer takes `setLastUnhandledLink` as a third argument.
   Collapsing this needs someone to re-read the 58.0.4 fork, decide whether the race
   is fixed upstream, and re-cut or retire the patch — then verify a cold boot with a
   deep link. Doing it blind drops a shipped fix.

2. **No build, no bundle, no device run.** `pnpm typecheck` and `pnpm test` do pass
   on this graph, cold — see below — but a Metro bundle, a prebuild and an on-device
   run are all still owed before this branch means anything. RN 0.88 and
   `expo-modules-core` 58.0.3 both touch the native layer, and neither of those two
   commands compiles a line of it.

3. **Neither vendored tarball was rebuilt** — see D3. Viro owes an on-device XR
   verification; `@expo-pico/core` owes a PICO one.

4. **`react-native` is pinned one behind `next`.** `0.88.0-rc.2` is published and is
   the current `next` tag. rc.1 was taken because it is the version the lane was
   scoped to; moving to rc.2 is a one-line change and an unknown amount of churn.

5. **The em-dash fix on `main` was not made** — out of scope for this branch, and
   this lane is forbidden from touching `main`. See D5.

## Verification actually run

Both from a cold turbo cache, on the committed graph.

    $ pnpm typecheck
     Tasks:    19 successful, 19 total
    Cached:    0 cached, 19 total
      Time:    22.686s

    $ pnpm test
     Tasks:    12 successful, 12 total
    Cached:    0 cached, 12 total
      Time:    23.658s

That covers the TypeScript surface of all 19 workspaces against `expo@58.0.0-preview.5`,
`react-native@0.88.0-rc.1` and `expo-modules-core@58.0.3` — including
`@acme/payload` under the patched bunny adapter, whose 22 assertions pass. It says
nothing about the native layer: no Metro bundle, no prebuild, no pod install, no
Gradle, no device. The two vendored tarballs in D3 have type definitions that resolve
and native code that has never been compiled against this graph.
