# Desktop native modules (Nitro on Legend Spark)

Native code for Moyo Learn for macOS. Every module here is a Nitro HybridObject
on Nitro v1 (`1.0.0-alpha.nightly.100.g107f6fc66597`, the version mobile pins),
installed as Moyo's Legend Spark macOS port
(`apps/desktop/vendors/react-native-nitro-modules-…-spark-macos.tgz`), never a
TurboModule or hand-written JSI. These packages sit outside the root pnpm
workspace (the `packages/*` glob matches only `packages/desktop-native`, which
has no `package.json`) and outside `apps/desktop`'s graph until the app
installs them.

SOT: docs/desktop/adr/0002-nitro-desktop-adapter.md · docs/desktop/seams/D03.md · apps/desktop/vendors/README.md
SOT-KEYWORDS: desktop nitro v1 adapter contract nitrogen swift spark hybridobject cocoapods

## Packages

| Package | HybridObjects | Language | Since |
| --- | --- | --- | --- |
| `moyo-desktop-core` | `MoyoDesktopCore` (`getPlatformInfo`, `hashFile`, `addThermalStateListener`) | Swift | PR-D03 |

## Adding a HybridObject

The order is fixed: spec, then Nitrogen, then Swift. Swift is written against
generated protocols, so it cannot come first.

1. **Spec.** Add `src/specs/<Name>.nitro.ts`:
   `@Apple({ language: 'swift', implementation: { className: 'Hybrid<Name>' } })`
   on `export declare class <Name> extends HybridObject`, imported from
   `nitro-core`, plus `export * from '#nitro/<Name>'`. Give it a `constructor()`
   only if JS creates it with `new`; objects returned by a factory have none.
   Put each struct, union and option type in its own `src/specs/<Type>.ts`.
   Export classes and types from `src/index.ts` (barrel only, after
   `import 'react-native-nitro-modules'`). `nitro.json` keeps its `android`
   block (`namespace`, `cxxLibName`); v1 has no `autolinking` key.
2. **Nitrogen.** In the package: `npm ci --ignore-scripts && npm run specs`.
   Commit everything under `nitrogen/generated/`. Never edit those files;
   `npm run specs:check` (CI) regenerates in a temporary copy of the package
   and fails on any difference.
3. **Swift.** `apple/Hybrid<Name>.swift`: `final class Hybrid<Name>: Hybrid<Name>Spec`.
   Swift 6 language mode. One type per file; every extension or conversion in
   its own `Type+operation.swift`. Quick cached reads stay synchronous.
   Anything that can wait returns `any Promise<T>` built with
   `.parallel(<owned queue>)`. JS callbacks arrive as `any Callback<…>`;
   listeners return a `{ remove }` struct built with `.native { … }` and are
   owned by one serial queue.
4. **Pod.** `MoyoDesktopCore.podspec` calls the port's
   `NitroCocoaPods.add_nitrogen_module`, which compiles the Swift and the
   generated C++ and wires the clang modules. A new package also needs
   `apple/cocoapods/<Module>AppleCxx/module.modulemap` (copy the one here).
5. **App.** `apps/desktop` depends on the package with `file:` and copies it
   (`apps/desktop/.npmrc` `install-links=true`), so Metro and CocoaPods resolve
   `react-native-nitro-modules` from the app's graph. npm does not re-copy an
   installed `file:` package whose version is unchanged, so after a change in
   the package run, in `apps/desktop`:
   `npm uninstall moyo-desktop-core && npm install --save-exact moyo-desktop-core@file:../../packages/desktop-native/moyo-desktop-core`
   (`npm ci`, as CI runs it, always copies fresh), then `npx --no-install spark build --dev`
   (custom development runtime) or `spark build` (release). Spark Runner cannot
   load a module it was not built with.
6. **Load lazily.** Importing the package looks up the generated class and
   throws when it is not registered, so app code requires the package inside a
   `try` (see `apps/desktop/src/desktop-core.ts`).
7. **Selection.** `npx --no-install spark analyze` must list the package as
   included in `.spark/selection-report.json` (third-party packages with a
   podspec are kept as "conservative native dependency").

## Why the package has its own devDependencies

Nitrogen parses specs with ts-morph and resolves `nitro-core` and
`react-native-nitro-modules` by walking up from the spec file. From
`packages/desktop-native/*` that walk would reach the root workspace's
copies, which are upstream v1 built for React Native 0.88. The package
therefore installs Nitrogen and `nitro-core` at the nightly, the Spark macOS
port of `react-native-nitro-modules` and its `simdutf-swift` peer (both from
`apps/desktop/vendors/`), and React Native 0.83.10, with an `overrides` entry
so every `react-native-nitro-modules` in its graph is the port. `files` keeps
`node_modules` out of the copy the app installs.
