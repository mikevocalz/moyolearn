# Business Studio: latest npm admission

Requested October 11, 2026. Base: PR #92. This change adds a live npm resolver, a fail-closed freshness check, contract tests, and a narrowly scoped draft-branch refresh workflow. It does not assert that the starting catalog is already current.

## Version policy

Resolve `https://registry.npmjs.org/<package>/latest`; validate the package name, stable exact semver, absence of deprecation, registry tarball origin, and SHA-512 integrity. Pin that exact version in the existing default pnpm catalog and regenerate `pnpm-lock.yaml`. Do not put the mutable string `latest` into package manifests. No nightly/canary substitutions, silent downgrade, guessed version or search-result-only verification. Registry failure is a blocker, never a successful empty report.

Scope: Gesture Handler, Reanimated, Worklets, Skia, React Native WebGPU, TypeGPU and the existing Graphite platform binary packages. The deprecated `react-native-wgpu` alias must not be introduced. Packages absent from the catalog are recorded as candidates only, not installed speculatively. PhotoCraft and Mailcheap are source repositories, not invented npm packages. Preserve their reviewed commit pins and licensing checks.

Existing Expo/React Native preview SDK pins and unrelated packages are not globally upgraded or downgraded by this feature. Latest npm admission is necessary but not sufficient for SDK, native patch, Graphite or ABI compatibility. A conflicting latest release blocks this draft until its migration passes; do not fall back to an old release.

## Commands

- `node --test tooling/business-studio-npm.test.mjs` tests the resolver without network calls or package installation.
- `node tooling/business-studio-npm.mjs --check` queries npm and fails on stale installed catalog targets.
- `node tooling/business-studio-npm.mjs --write` writes exact catalog pins and a versioned evidence receipt. It does not install anything.
- `corepack pnpm install --lockfile-only --ignore-scripts --no-frozen-lockfile` regenerates resolution. Then a real cold-cache install, patches, typecheck, lint, web builds and device builds are mandatory.

The workflow may commit only to the same-repository `chore/business-studio-latest-npm` draft branch, never main or another PR, with no force push. It uses the built-in GitHub token and never reads application/provider secrets. Concurrent branch changes reject the push. It commits only catalog, pnpm lock and npm receipt after successful resolution. Standard CI must be rerun on the resulting head: GitHub-token commits do not themselves trigger a new workflow run. A lock-only resolution is not a native compilation or peer-compatibility proof.

## Merge gates

- Registry receipt and pnpm lock correspond to the actual draft head; no untracked version exceptions.
- Existing Reanimated/Gesture Handler/Worklets patches apply to the selected versions.
- Frozen install plus all framework checks; browser keyboard/touch tests; iPad and Android native builds/device checks.
- Skia/Graphite binary versions and JS WebGPU owner compatibility proven before enabling the PhotoCraft renderer.
- Re-run freshness immediately before merge; do not merge on this draft's initial fixture tests alone.

Local verification: 18 resolver contracts passed on Node 22.16.0. This is not the repository Node version and does not substitute for CI. Registry DNS is unavailable in the authoring container; the Actions receipt is the live source of truth.

Engineering ownership: dependency/native compatibility, UI/accessibility, Rust/FFI, GPU, security and QA. Use repository CONTRIBUTING, the React best-practices skill and Software Mansion's current migration guidance. Required project references remain expo/skills, mattpocock/skills, Argent/agent-device, coreyhaines31/marketingskills, pbakaus/impeccable and petergyang/no-ai-slop. Device-tool or skill naming is not evidence of a successful test.
