# Business Studio: latest npm admission

Requested October 11, 2026. Base: PR #92. This change adds a live npm resolver, a fail-closed freshness check, contract tests, and a narrowly scoped draft-branch refresh workflow. It does not assert that the starting catalog is already current.

## Version policy

Resolve `https://registry.npmjs.org/<package>/latest`; validate the package name, stable exact semver, absence of deprecation, registry tarball origin, and canonical 64-byte SHA-512 integrity. Pin that exact version in the existing default pnpm catalog and regenerate `pnpm-lock.yaml`. Do not put the mutable string `latest` into package manifests. No nightly/canary substitutions, silent downgrade, guessed version or search-result-only verification. Registry failure is a blocker, never a successful empty report.

Scope: Gesture Handler, Reanimated, Worklets, Skia, React Native WebGPU, TypeGPU and the existing Graphite platform binary packages. The deprecated `react-native-wgpu` alias must not be introduced. Every installed target must use the default catalog in all workspace dependency manifests; direct pins, named catalogs, or overrides that bypass the catalog fail the freshness gate. Root overrides may reference the exact default catalog to keep optional peers on one audited version. The resolved lockfile is checked for older duplicate copies too. Packages absent from both manifests and the catalog are recorded as candidates only, not installed speculatively. Existing mobile WebGPU and TypeGPU dependencies are catalog-managed targets, not candidates. PhotoCraft and Mailcheap are source repositories, not invented npm packages. Preserve their reviewed commit pins and licensing checks.

Existing Expo/React Native preview SDK pins and unrelated packages are not globally upgraded or downgraded by this feature. Latest npm admission is necessary but not sufficient for SDK, native patch, Graphite or ABI compatibility. A conflicting latest release blocks this draft until its migration passes; do not fall back to an old release.

## Commands

- `node --test tooling/business-studio-npm.test.mjs` tests the resolver without network calls or package installation.
- `node tooling/business-studio-npm.mjs --check` queries npm and fails on stale installed catalog targets, older resolved copies, or committed receipt evidence that differs from the registry/catalog.
- `node tooling/business-studio-npm.mjs --write` writes exact catalog pins and a versioned evidence receipt. It does not install anything.
- `corepack pnpm install --lockfile-only --ignore-scripts --no-frozen-lockfile` regenerates resolution. Then a real cold-cache install, patches, typecheck, lint, web builds and device builds are mandatory.

The workflow may commit only to the same-repository `chore/business-studio-latest-npm` draft branch, never main or another PR, with no force push. It uses the built-in GitHub token and never reads application/provider secrets. Concurrent branch changes reject the push. It commits only catalog, pnpm lock and npm receipt after successful resolution and a fresh `--check` of that regenerated candidate, before any commit or push. The post-push check remains a second registry observation. All referenced Actions are pinned to verified official commit SHAs; checkout retains the current v4 security backports and credential persistence stays disabled. Standard CI must be rerun on the resulting head: GitHub-token commits do not themselves trigger a new workflow run. A lock-only resolution is not a native compilation or peer-compatibility proof.

## Merge gates

- Registry receipt and pnpm lock correspond to the actual draft head; no untracked version exceptions.
- Existing Reanimated/Gesture Handler/Worklets patches apply to the selected versions.
- Frozen install plus all framework checks; browser keyboard/touch tests; iPad and Android native builds/device checks.
- Skia/Graphite binary versions and JS WebGPU owner compatibility proven before enabling the PhotoCraft renderer.
- Re-run freshness immediately before merge; do not merge on this draft's initial fixture tests alone.

Current validation uses the repository Node 24.19.0 runtime, dependency-free resolver and manifest-coverage contracts, and a direct npm registry receipt. Catalog and lockfile refreshes include existing mobile WebGPU and TypeGPU dependencies and Graphite platform binaries. Worklets is forced through its existing catalog because Expo optional-peer resolution otherwise installs 0.10.x alongside Reanimated 4.7.x, which requires 0.13.x. Full current-head CI and native builds remain mandatory.

Engineering ownership: dependency/native compatibility, UI/accessibility, Rust/FFI, GPU, security and QA. Use repository CONTRIBUTING, the React best-practices skill and Software Mansion's current migration guidance. Required project references remain expo/skills, mattpocock/skills, Argent/agent-device, coreyhaines31/marketingskills, pbakaus/impeccable and petergyang/no-ai-slop. Device-tool or skill naming is not evidence of a successful test.


## Shared Dawn admission for Graphite 154.3

WebGPU 0.13.1 moves Dawn binaries and headers into `react-native-webgpu-dawn@154.3.0`. The old postinstall copied from WebGPU's removed `libs/android` layout and stamped `dawn-chrome-m154`, which the native single-Dawn guard correctly rejected against `chrome-m154a`.

`tooling/enable-skia-graphite.mjs` now verifies the exact renderer/WebGPU/Graphite/Dawn package identities and source metadata before staging anything. It copies the shared owner's actual four Android ABI libraries and generated Dawn headers, normalizes header locations like upstream, and invalidates old platform copy caches. An admission stamp is written only after successful staging; warm installs refresh owner files rather than trusting destination existence. The existing native single-Dawn guard is unchanged.

Private Graphite headers come from the SHA-256-pinned [upstream header release](https://github.com/wcandillon/react-native-skia/releases/tag/skia-graphite-m154_8037_58a). Its Skia submodule commit matches the 154.3 publisher. The [renderer-to-binary Skia comparison](https://github.com/google/skia/compare/9f9e6beb751091ef69163d2b4fdcd1e711b594ac...2466dcf3937437e217e7f284afe0e1aae15891ce) contains a Ganesh-internal change, not a changed Graphite/public header interface. Exact admission values and checksum are in the installer, not inferred from a milestone string.

`node --test tooling/enable-skia-graphite.test.mjs` covers unknown combinations, mismatched header source/patches, missing ABIs, absent optional upstream header-shim directories, cold/warm cache invalidation and checksum/download failures without network calls. Separate cold and warm staging checks used integrity-verified npm artifacts and the checksum-verified real header archive; all copied Dawn libraries matched their owner bytes. Neither check proves native compile/link success. CocoaPods lock regeneration is complete for the admitted native dependency/configuration inputs, including the final code candidate recorded in `native-lock-provenance.json`. The subsequent installer directory safeguard and Android diagnostic wrapper do not change pod declarations, versions or admitted artifacts; their exact differences and tests are recorded there. Terminal native builds of the final published head remain required.


Workflow pin provenance (verified 2026-10-11): [checkout v4 security backport](https://github.com/actions/checkout/commit/11d5960a326750d5838078e36cf38b85af677262), [setup-node v4.4.0](https://github.com/actions/setup-node/releases/tag/v4.4.0), and [upload-artifact v4.6.2](https://github.com/actions/upload-artifact/releases/tag/v4.6.2). Regression coverage rejects mutable refs and proves a failing candidate check prevents the publication shell from invoking authentication, commit or push.


## Regenerated CocoaPods locks and native verification

Both tracked CocoaPods locks are copied unchanged from SHA-256-verified native workflow artifacts. The iOS lock comes from the successful #93 build and is byte-identical to #94's independently generated lock. The visionOS lock comes from #94's successful simulator test-build; its native configuration and 1,450-package mobile runtime closure match #93. Exact run/artifact IDs, digests, Podfile checksums and versions are recorded in `native-lock-provenance.json`.

The locks retain CocoaPods 1.17.0 output, including existing precompiled-Expo dependency normalization and the visionOS Podfile's absolute Viro package paths. No generated version or checksum was edited manually. These are compile/build-for-testing results, not physical-device or executed on-device test evidence.

Android's earlier runs ended with runner shutdown/SIGTERM during native compilation, without a compiler error or a proven host-resource cause. The native workflow now wraps the unchanged assembly command in a 30-second timestamp/memory/disk/process-name-and-RSS heartbeat. It preserves the command, flags and exit status and forwards interruption; it never logs environment values or full command arguments. The final-head native gate is still required.

The shared wildcard-export barrel-checker regression and truthful review-time canvas reference annotations are backported unchanged from #90's reviewed commit `8f69044a0b576407d70cd67369084e9c49fab671`. They repair root guards without importing the Science feature or adding a native module to a web barrel.
