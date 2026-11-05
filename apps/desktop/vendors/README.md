# apps/desktop/vendors: Moyo's Legend Spark ports

Moyo Learn runs Nitro Modules v1 (`react-native-nitro-modules`, `nitro-core`
and `nitrogen` at `1.0.0-alpha.nightly.100.g107f6fc66597`) on every platform.
Mobile pins it in the root `pnpm-workspace.yaml` catalog and builds it through
SwiftPM on React Native 0.88. Desktop runs Legend Spark 0.0.2, which pins React
Native macOS 0.83 and builds pods with CocoaPods, so desktop installs the
ports below instead of Spark's own Nitro 0.37.0 tarball. Mike's ruling,
2026-11-04: desktop uses Nitro v1, as mobile does.

`package.json` `dependencies` and `overrides` point each package name at its
tarball. Each tarball is `npm pack --ignore-scripts` of the port directory.

| Tarball | What it is | sha256 |
| --- | --- | --- |
| `react-native-nitro-modules-1.0.0-alpha.nightly.100.g107f6fc66597-spark-macos.tgz` | npm `react-native-nitro-modules@1.0.0-alpha.nightly.100.g107f6fc66597` plus `react-native-nitro-modules-1.0.0-alpha.nightly.100.g107f6fc66597-spark-macos.patch` (its `SPARK-MACOS.md` lists the changes) | see `SHA256SUMS` |
| `simdutf-swift-1.0.1-spark-macos.tgz` | margelo/simdutf-swift tag 1.0.1 (`4f98b5b1`) as the `SimdUTF` pod, which Nitro v1 needs and upstream gets from SwiftPM (its `MOYO-PORT.md`) | see `SHA256SUMS` |

## The Nitro patch

`react-native-nitro-modules-…-spark-macos.patch` is the full diff of the port
against the npm tarball, excluding only the `spark` stamp in `package.json`,
which records the patch's SHA-256 as `spark.patchHash`. In short:

1. AppKit `HybridView` (`NitroPlatformView`), carried over from Spark's
   patch to Nitro 0.37.0. Spark's Windows adapter is not carried over.
2. A buildable `NitroModules.podspec` for macOS and
   `apple/cocoapods/nitro_cocoapods.rb`, which translates Package.swift's
   targets into pod settings for Nitro and for nitrogen-generated libraries
   (`moyo-desktop-core` uses it).
3. `cpp/core/include/NitroModules/detail/JSICompat.hpp`: the three JSI members
   Nitro v1 calls that React Native 0.83 lacks.
4. `peerDependencies`: `react-native >=0.83.0` and `simdutf-swift 1.0.1`.

## Spark's patch check

Spark's build, dev and analyze commands refuse any `react-native-nitro-modules`
other than its own 0.37.0 (`spark-cli/dist/native-patch-preflight.js`), and
offer no setting to change that. `patches/legendapp-spark-0.0.2-native-patch-overrides.patch`,
applied by `scripts/apply-spark-patches.mjs` in `postinstall`, makes the check
read `package.json` `sparkNativePatchOverrides` and print the override on every
run. The installed package must still match the override's version,
`patchHash` and `upstreamIntegrity` exactly.

## Spark modules left out

`@legendapp/spark-codex` and `@react-native-runtimes/core` are Spark SDK
packages written as Nitro 0.37.0 HybridObjects. They do not compile against
v1, and Moyo imports neither, so `desktop.config.json` `expo.autolinking.exclude`
keeps them out of every build, including `spark build --dev`, which otherwise
compiles all native packages. Port them before importing
`@legendapp/spark/ai-codex` or a threaded runtime.

## Recutting

Edit the port, regenerate the patch against the npm tarball, `npm pack
--ignore-scripts`, add the `spark` stamp with the new patch hash, copy the
tarball here, update `sparkNativePatchOverrides`, `SHA256SUMS` and this file.
`spark upgrade` or `spark add desktop` rewrites the Nitro pins to Spark's
0.37.0 tarball; after either, restore the pins above.
