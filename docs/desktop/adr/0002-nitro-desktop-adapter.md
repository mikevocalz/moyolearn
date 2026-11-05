# ADR desktop/0002: Nitro v1 on Legend Spark (desktop adapter)

- Status: Proposed (PR-D03)
- Date: 2026-11-04
- Amends: ADR 0001's Nitro row (Spark's 0.37.0 tarball)
- SOT-KEYWORDS: desktop adr nitro v1 nightly adapter spark nitrogen cocoapods port install-links

## Context

PR-D03 needs one Nitro HybridObject running in Spark's Hermes runtime, with a
synchronous call, an asynchronous call and a native callback, so later desktop
features (OCR, whiteboard input, media) use one native pattern.

The PR pack says to pin the Nitro nightly mobile pins (PR-D03). A first draft
of this ADR kept Spark 0.0.2's patched `react-native-nitro-modules` 0.37.0
instead. Mike overruled that on 2026-11-04: desktop uses Nitro v1,
`react-native-nitro-modules`, `nitro-core` and `nitrogen` at
`1.0.0-alpha.nightly.100.g107f6fc66597`, the root catalog's pins, and Moyo
patches the libraries it needs for v1 as it already does for mobile
(`vendors/*-nitro-v1.tgz`).

Three facts make v1 on Spark more than a version bump:

1. Upstream v1 builds Apple code only through SwiftPM on React Native 0.88
   (`Package.swift`; its podspec is metadata only). Spark 0.0.2 pins React
   Native macOS 0.83 and installs pods with CocoaPods.
2. v1 calls three JSI members React Native 0.83 lacks:
   `jsi::Array::push`, `jsi::Runtime::createError` and
   `jsi::ArrayBuffer::tryGetMutableBuffer` (compiler errors recorded in
   `stages/D03/evidence.log`).
3. Spark's preflight (`spark-cli/dist/native-patch-preflight.js`) stops
   `build`, `dev` and `analyze` unless the installed
   `react-native-nitro-modules` is Spark's 0.37.0 with Spark's `patchHash`.
   The CLI has no setting to change the expected package.

## Decision

1. **Port Nitro v1 to Spark macOS, one patch.** `apps/desktop/vendors/`
   holds `react-native-nitro-modules-1.0.0-alpha.nightly.100.g107f6fc66597-spark-macos.tgz`:
   the npm nightly plus `…-spark-macos.patch` (summary in the tarball's
   `SPARK-MACOS.md` and in `apps/desktop/vendors/README.md`). It carries over
   the macOS part of Spark's 0.37.0 patch (AppKit `HybridView`), adds a
   buildable macOS podspec plus `apple/cocoapods/nitro_cocoapods.rb`, which
   turns Package.swift's targets into pod settings, and a JSI compatibility
   header that uses the 0.88 members when present. Spark's Windows adapter is
   not carried over (macOS only).
2. **simdutf-swift as a pod.** Nitro v1's SwiftPM dependency on
   margelo/simdutf-swift 1.0.1 becomes the `SimdUTF` pod in
   `simdutf-swift-1.0.1-spark-macos.tgz` (same sources, pinned commits and a
   `SHA256SUMS`), a peer dependency of the port and a dependency of the app.
3. **Spark's patch check, kept and extended.** `apps/desktop/patches/legendapp-spark-0.0.2-native-patch-overrides.patch`,
   applied in `postinstall` by `scripts/apply-spark-patches.mjs`, lets the
   preflight read `package.json` `sparkNativePatchOverrides`. The installed
   package must match the override's version, `patchHash` (SHA-256 of the
   `.patch`) and `upstreamIntegrity` (npm's sha512 of the nightly) exactly, as
   it had to match Spark's values before, and every run prints the override.
   The applier refuses to patch a file whose hash is not Spark 0.0.2's.
4. **Library pods through the port's helper.** `moyo-desktop-core`'s podspec
   calls `NitroCocoaPods.add_nitrogen_module`, the CocoaPods counterpart of
   nitrogen's `addNitrogenTargets`. The `MoyoDesktopCoreAppleCxx` module map
   that SwiftPM derives is written down in `apple/cocoapods/`.
5. **Dispatcher comes from Nitro.** `apple/src/NativeNitroModules.mm` in the
   port installs `nitro::detail::CallInvokerDispatcher` around React Native's
   `CallInvoker` from `installJSIBindingsWithRuntime:callInvoker:`
   (`RCTTurboModuleWithJSIBindings`, present in React Native macOS 0.83).
   This PR adds no dispatcher.
6. **Package location and graph.** `packages/desktop-native/moyo-desktop-core`,
   outside the root workspace glob, owns its codegen graph (Nitrogen v1 and
   the port tarball as devDependencies) so Nitrogen never resolves the root's
   copies.
7. **Copied, not symlinked.** `apps/desktop/.npmrc` sets `install-links=true`.
   npm packs the `file:` directory into `node_modules`, so Metro and CocoaPods
   resolve Nitro from the app's graph.
8. **Generated code is committed and guarded.** `nitrogen/generated/` is
   committed; `npm run specs:check` regenerates in a temporary copy of the
   package (Nitrogen v1 writes only where `package.json` `imports` maps
   `#nitro/*`) and fails on any difference. CI runs it.

## Consequences

- Desktop and mobile share Nitro's version and spec syntax (`@Apple`
  decorators, `new MoyoDesktopCore()`, `Callback`, `any Promise<T>`).
  The native builds differ: mobile builds upstream through SwiftPM, desktop
  builds the port through CocoaPods.
- `spark upgrade` or `spark add desktop` rewrites the Nitro pins to Spark's
  tarball, and a new Spark version makes `apply-spark-patches.mjs` stop with
  an error. Either needs the port re-checked and the patch re-made.
- Two Spark SDK packages are Nitro 0.37.0 HybridObjects:
  `@legendapp/spark-codex` (`RNCodex`) and `@react-native-runtimes/core`
  (`NativeComposeThreadedRuntime`). Release builds already prune them (no
  import reaches them), but `spark build --dev` compiles every native package
  and they do not build against v1 ("'NitroModules/Promise.hpp' file not
  found"). `desktop.config.json` `expo.autolinking.exclude` lists both, the
  setting Spark's release check names for this. Porting them is deferred
  until Moyo imports `@legendapp/spark/ai-codex` or a threaded runtime; with
  the exclusion in place, such an import fails Spark's release check by name
  instead of failing at runtime.
- Swift HybridObjects build in the release runtime (`spark build`) and the
  custom development runtime (`spark build --dev`); Spark Runner cannot load
  them.
- A change in the package needs a fresh copy in `apps/desktop` (see
  `packages/desktop-native/README.md`).
- Intel macOS and Windows are out of scope; the podspecs declare macOS only.
