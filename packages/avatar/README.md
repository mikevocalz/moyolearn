# `@acme/avatar`

The embodied tutor renderer — Natalie's 3D stage. Spec of record: **`docs/pack/22-embodied-tutor-avatar-spec.md`**.

This package is being ported from the `gnm-avatar` reference renderer (Next.js + three.js WebGL, Phases 1–9 complete) to React Native WebGPU. Doc 22 §10.1 sets the order deliberately: **the unchanged modules move first, with their tests green, before any material work starts.** That split is what makes the shader rewrite reviewable — when a golden image moves later, it moved because of the shader, not because the idle engine drifted on the way across.

## What has landed

The shared, platform-agnostic core. Nothing here imports three.js, a renderer, or a DOM API, which is exactly why it runs under `node --test` on every platform we ship.

| Module | Status |
|---|---|
| `src/gnm/model.ts` | Ported verbatim. The CPU head evaluator — PCA basis accumulation, Rodrigues FK, linear blend skinning. Its own TS project; see below. |
| `src/idle/{engine,config}.ts` | Ported verbatim. Deterministic breath, sway, drift, saccades, blink hazard, backchannel nods, anticipation. |
| `src/emotion.ts` | Ported verbatim except the `Shape` import, which follows the speech split. |
| `src/speech/track.ts` | **Split** out of the reference's single `speech.ts` — the sampler and the ARKit→GNM matrix. |
| `src/neck-writer.ts` | Ported verbatim. |
| `src/store.ts` | Ported verbatim. |
| `src/body.ts` | Ported. SMPL-X body + the manifest rig contract. Asset URLs are now required parameters. |
| `src/body-frame.ts` | Ported verbatim. The single neck/head writer. |
| `src/skirt-conform.ts` | Ported. The `SCF4` parser and rig-provenance validation. |
| `src/conform/driver.ts` | Ported verbatim. The per-frame seam maths; its own TS project. |
| `src/neck-align.ts` | Ported, **reworked** — see below. |
| `src/speech/driver.ts` | **Reworked.** Viseme + gesture sampling behind an `AudioBackend` interface. |
| `src/speech/backend-audio-api.ts` | **New.** The one audio backend, on `react-native-audio-api`. Not unit-tested — it is the device edge. |
| `src/speech/encoder.ts` | **New.** Named ARKit weights → the head's expression vector; direct or matrix, chosen from container metadata. |
| `src/face-bus.ts` | **Reworked.** The single face writer: mic cut, factory not singleton, encoder injected. |
| `src/tiers.ts` | **New.** Device tiers, compute-head feasibility, and frame-time demotion. Pure policy. |
| `src/materials/skin.ts` | **Rewritten.** The deep-skin BRDF as a TSL `PhysicalLightingModel` subclass — doc 22 §4 row 1. |
| `src/materials/eyes.ts` | **Rewritten.** Refractive iris parallax through a `dFdx`/`dFdy` cotangent frame — doc 22 §4 row 3. |
| `src/materials/hair.ts` | **Rewritten.** GPU-side sway composed onto `positionLocal`, anisotropic BRDF — rows 4–5. |
| `src/materials/denim.ts` | **Rewritten.** Knee fade, hip whiskers and the felled seam off `garmentRestPosition` — row 6. Pose-invariant by construction. |
| `src/materials/mouth.ts` | **Rewritten.** Cavity darkening as a `colorNode` — row 7. Without it an open mouth reads as a mask. |
| `src/materials/brow.ts` | **Rewritten.** Strand tip alpha fade as an `opacityNode` — row 7. Doubles as anti-aliasing for one-pixel ribbons. |
| `src/lashes.ts` | **Ported**, minus the DOM canvas — row 13. Ribbons rebuilt from the lid margins every frame; the texture is now baked offline. |
| `src/compute/head.ts` | **New.** The GPU head kernel and its `adapter.limits` gate — row 14. Fails closed to the CPU path. |
| `src/assets.ts` | **New.** The CDN capability manager: manifest, tier filter, integrity, and the enforced `.glb` rule — row 17. |
| `src/controls.ts` | **New.** Scriptable orbit maths with no gesture dependency — row 16. Dev/QA only; the product camera is authored. |
| `tools/bake_lash_texture.ts` | **New.** Bakes the lash strand texture to a reproducible PNG, with its own rasteriser and PNG encoder — row 13. |
| `src/stage.ts` | **Rewritten.** Rig, IBL, shadows, tone mapping and the post chain on `RenderPipeline` — doc 22 §4 rows 8–12. |
| `src/crypto/sha256.ts` | **New.** Dependency-free SHA-256; Hermes has no `crypto.subtle`. |
| `src/tutor-stage.ts` | **New.** The 2D ↔ 3D handoff state machine — doc 22 §10.8. Renderer-free, so the 2D-only build pulls no three.js. |
| `src/testing/golden.ts` | **New.** The device half of the golden gate: deterministic capture, seven cameras, the reproducibility invariants — doc 22 §8. |
| `src/testing/png.ts` | **New.** Host-side RGBA8 PNG codec. `node:zlib`, so it never runs on device. |
| `src/testing/pixel-diff.ts` | **New.** Host-side perceptual diff (YIQ + antialiasing heuristic) at doc 22 §8's 0.4 % budget. |
| `tools/golden-compare.ts` | **New.** The CI entry point: decode references, diff, write diff images, exit non-zero. |
| `tools/verify_deps.mjs` | **New.** Every `catalog:` reference resolves, every bare import is declared. Written after shipping the first of those as a bug. |
| `tools/verify_doc_claims.mjs` | **New.** Resolves every backticked symbol in doc 22 against real three 0.185.1 exports, addons, types and our own barrels. Caught an invented API on its first run. |
| `tools/build_asset_manifest.mjs` | **New.** Hashes the real baked artefacts into the manifest `assets.ts` consumes, and measures each `.glb`'s embedded-image count. |
| `tools/shader-probe/` | **New.** Three probes in headless Chromium: every material on a lit sphere, `createStage()` for all three tiers, and the rebake A/B (authoring vs rebaked container, diffed with the golden metric). Fails if anything does not compile or does not shade. Found the white-hair bug and the floating shadow catcher. |
| `src/reduced-motion.ts` | **New.** One render mode for every animated surface, with a registry that fails the build when a new animation ships unwired — doc 22 §7. |
| `src/safety/gesture-gate.ts` | **New.** The companionship firewall as code — doc 22 §7. Enumerated vocabulary plus structural limits on the EMAGE stream. |
| `src/testing/offscreen-target.ts` | **New.** The `GoldenTarget` that actually renders: render target, pinned pixel ratio, bottom-up readback flipped. |
| `src/testing/gnm-container.ts` | **New.** Synthesises a valid `GNMW` container in memory, so the head is testable without the shipped binary. |
| `src/testing/close-to.ts` | The one assertion `node:assert` is missing. |
| `src/presence/humano.ts` | **New.** The per-frame writer for the shipped marketing body — idle channels, gaze-at-camera, breath, neck/head drift, jaw, co-speech beats, and a mouth from one openness scalar. Renderer-free and frame-source-free, so the web scene (`useFrame`) and the native stage (`setAnimationLoop`) drive the same maths. |
| `tools/verify_native_gltf.mjs` | **New.** The device-loadability gate for `assets/natalie-phone/`: external images (Hermes cannot decode embedded ones), sibling `.bin`, no Draco, one skin, the named morphs, and every Rigify bone the writer poses. |

241 tests, converted from vitest to `node --test` + `node:assert/strict` — the runner `@acme/ui` already uses. Thresholds are unchanged from the reference suite.

The whole of doc 22 §4 is now built: rows 1–17. What that means and does not mean is worth being precise about — every symbol the parity table claimed is confirmed to exist against the real `@types/three` 0.185.4, every node graph constructs in Node, and the compute kernel's algorithm is diffed against the real `GNMHeadModel` on a machine with no GPU. **The shader probe (`pnpm probe:shaders`) now renders all ten materials AND `createStage()` for all three tiers in headless Chromium on the WebGL2 backend — 13/13 compile and shade, and it found a real bug (white braids) that no unit test could.** What is still unrendered is the WGSL path, the post chain, and the look. The look is unverified for the entire material set. The golden harness that will settle it is built and tested too, `GoldenTarget` implementation included. What is left is wiring a real renderer and stage into `createOffscreenTarget`, one first capture, and a person looking at it.

## Five deviations from a verbatim port, and why

**1. The speech module is split.** The reference's `src/speech.ts` mixed typed-array arithmetic that runs anywhere with `HTMLAudioElement`, `new Audio()`, and `fetch('/tts')` that run in exactly one place. This half needs no audio device at all, which is what makes the viseme math unit-testable here.

To be clear about what the split is *not*: the playback half is **one shared implementation**, not a platform seam. `react-native-audio-api` — already in the catalog at `0.13.3` — is a Web Audio implementation on iOS and Android and delegates to the browser's own `AudioContext` on web, so `HTMLAudioElement.currentTime` becomes `ctx.currentTime - startTime` once, for every platform. It is also a better clock than the one it replaces. Doc 22 §4 row 15 has the detail, including the three things around the clock that *do* still differ (mobile-only position callback and `getLatency()`, output-latency compensation, iOS session configuration).

**2. `ValueNoise` no longer uses constructor parameter properties.** `node --test` executes the TypeScript directly through Node's type stripping, which cannot emit the assignments a parameter property implies. The package is typechecked with `erasableSyntaxOnly` so that constraint fails at typecheck rather than at test time.

**3. Relative imports carry the `.ts` extension.** Node ESM resolution requires it; the repo's base tsconfig already sets `allowImportingTsExtensions`, so this was anticipated.

**4. `crypto.subtle` is gone, twice over.** Hermes does not provide it. `skirt-conform.ts` hashes the *live* skeleton — bone names and inverse-bind matrices — so it genuinely needs a digest at runtime, and that now goes through `src/crypto/sha256.ts` (~70 lines of FIPS 180-4, no dependency, verified against the standard vectors and against `node:crypto` at every padding boundary). `neck-align.ts` needed no hash at all in the end: after the runtime rebake the identity is folded into the head container, which carries `meta.bake.identitySha256`, so the check became a string comparison between two baked artifacts — and a stronger claim than the original, since it asserts the transform matches the identity actually in *this head* rather than one that happened to be loaded alongside it.

**5. The face bus lost its microphone, and became a factory.** The reference fed the idle engine from an always-on mic — partner speaking, pause events, falling F0 — and doc 22 §3 cuts that: turn-taking comes from the gateway stream, not from a live microphone at a child. Those inputs arrive through `setConversationCues` instead, so backchannel nods and pre-speech anticipation still work, driven by something we can consent to. It also stopped being a module singleton that fired `fetch('/gnm/arkit-map.json')` at import time; import-time I/O is wrong on RN and untestable anywhere.

**6. The store is `zustand/vanilla`, not `zustand`.** The React binding would pull React into a package whose consumers are an imperative render loop and a Node test runner — neither of which has a component. `getState`/`setState`/`subscribe` is the entire surface anything here uses, and this was found the honest way: the test suite would not run.

**7. Asset URLs are required parameters.** The reference defaulted to `/body/...` and `/gnm/...`, which assumes same-origin web. Every avatar artifact now comes from the CDN through the capability manager (doc 22 §3), so callers resolve URLs and these modules never guess.

Everywhere else, `noUncheckedIndexedAccess` (Moyo's base config; the reference didn't have it) surfaced real edges rather than noise — an empty viseme track, a partial ARKit map, a short caller array — and each is fixed at the point of use with the reasoning in a comment.

## What the renderer tests can and cannot prove

`src/materials/skin.ts` and `src/stage.ts` are the renderer, and there is no GPU in CI, so its suite is careful about what it claims. It proves the **API surface**: the material constructs, `setupLightingModel()` returns a `PhysicalLightingModel` subclass, and the node graph builds — against the real `three@0.185.1` package rather than against the spec's memory of it. A typecheck alone would not be enough, because the declarations narrow several of these values to bare `Node`.

The stage goes further in one direction and less far in another: it cannot be *constructed* without a GPU — `RenderPipeline`, `PMREMGenerator` and `pass()` all need a live renderer — so its suite asserts the decisions instead (tone-mapping choice and per-curve exposure, the rig's rim-over-key shape, the warm/cool split, both rims behind, the shadow constant). That the API exists is proven by the file compiling, and a deliberate type error was introduced once to confirm the file is genuinely in the program rather than silently excluded.

Neither proves anything about **the look**. That is the golden set's job (doc 22 §8) and it needs a device. Two upstream type gaps are worth knowing about: `LightingModelDirectInput`'s fields and `BRDF_GGX`'s return type are declared as bare `Node`, which carries no math operators, so they are narrowed once at the top of `direct()` with the reason written there — a scatter of inline casts through the maths would read as uncertainty about the values rather than about the declarations.

## The two numeric-kernel exemptions, the rule, and what contains them

**The admission rule.** A file gets its own project with `noUncheckedIndexedAccess` off only when all three hold: it is arithmetic over typed arrays; every index derives from dimensions that a *validated* parser already checked; and it does no I/O, holds no business logic, and makes no platform call. Two files qualify. A third has to argue for itself here, in writing, before it gets one — the flag is worth keeping and it dies by exemption creep, not by one decision.

The rule has already earned its keep once. `skirt-conform.ts` reported 85 errors, so the obvious move was to exempt the file. Counting them by region said otherwise: **3 in the parser, 82 in the driver.** The parser's byte-length, weight-sum and barycentric-sum checks are precisely the code the flag is good at, so the driver was split out into `src/conform/driver.ts` and the parser stayed strict. The exemption is 82 errors' worth of hot loop, not a whole file.

`src/gnm/model.ts` is a 715-line numeric kernel. Under Moyo's `noUncheckedIndexedAccess` it reports **108 errors**, essentially all of the form `sum[j] += basis[offset + j] * factor` — reads that are in-bounds by construction from dimensions `parseContainer` already validated. The reference renderer has no such flag, so this is a Moyo-vs-reference collision rather than a porting mistake. Asserting all 108 would bury the maths and, worse, camouflage the handful of reads that genuinely *are* unchecked.

Each kernel is **its own TypeScript project** — `composite: true`, that one flag off, everything else on. The package project references both and sets `disableSourceOfProjectReferenceRedirect`, so it consumes `.types/gnm/model.d.ts` and `.types/conform/driver.d.ts` instead of the sources.

This is what makes the exemption a boundary rather than a hole, and all four properties were verified rather than assumed:

| | |
|---|---|
| The kernel is still fully typechecked | a deliberate `const x: string = this.numVertices` inside `model.ts` **is** caught by `tsc -b src/gnm` |
| The exemption does not leak into the package | `model.test.ts` sits in the strict project, imports the kernel, and reports zero index errors |
| It does not leak into consumers either | a strict project importing all three entrypoints typechecks clean — every `exports` entry points `types` at an emitted `.d.ts`, never at source |
| Misuse is still caught across the boundary | `m.setJointRotation('neck', …)` errors in both the package and a consumer |

That third row is the one that keeps almost-failing, and it is worth stating how. The first version of this package declared `types` only on the `/gnm` subpath; `.` and `./body` pointed straight at source. A consumer importing those recompiles our source under its own flags — so the moment `./body` started re-exporting the conform driver, the exemption leaked straight into `apps/mobile`. The fix is that **the whole package emits declarations** and every `exports` entry resolves types through `.types/`, with the source kept as the runtime `default` so Metro still gets TypeScript. The consumer check above is run against all three entrypoints for exactly this reason.

**`.types/` is committed** (`.tsbuild/` is not). It is generated output, which repo law says to commit — and it means a fresh clone typechecks without a build-ordering assumption, and a reviewer can read exactly what the kernel exposes without building anything.

## Testing the head without the 34.9 MB binary

`buildGnmFixture()` synthesises a valid `GNMW` container at small dimensions. Doc 22 §3 keeps the shipped container out of the app and therefore out of this repo, and a fixture is the better test anyway: it exercises the parser's declared contract at chosen dimensions instead of one opaque blob that happens to work.

The sharpest assertion it enables: **at rest pose, with every joint at identity rotation, linear blend skinning must reproduce the bind template exactly.** Any error in the weight layout, the FK walk, or the skinning-translation construction shows up as a non-zero delta rather than as a subtly wrong face nobody can diff by eye. It found a real bug immediately — the weights array is **joint-major** (`weights[j * V + v]`), and a vertex-major fixture still produced finite, non-zero vertices.

The real container stays covered through an env-gated case:

```bash
MOYO_GNM_HEAD_BIN=~/.cache/moyo/gnm_head_web.bin pnpm --filter @acme/avatar test
```

## Running it

```bash
pnpm --filter @acme/avatar typecheck   # tsc -b .  &&  tsc --noEmit -p tsconfig.tests.json
pnpm --filter @acme/avatar test        # node --test
```

`tsc -b .` builds the two kernel projects and then the package itself, emitting every declaration under `.types/`. The second invocation checks the test files, which the emitting project excludes — a declaration bundle has no business carrying test types. `turbo.json` declares `.types/**` as the task's output so the emit is cached rather than repeated.

`typecheck` builds the kernel project first because the main project consumes its declarations. `turbo.json` declares `.types/**` as that task's output so the emit is cached rather than repeated.

Dependencies are `zustand` and `three`, both through the catalog. **`react-native-audio-api` is deliberately NOT a dependency**: `backend-audio-api.ts` declares the four-method slice of Web Audio it needs and the app passes an `AudioContext` in, so the package never imports the module. Declaring a dependency you do not import is a lie, and this way the golden harness and the unit suite need no audio stack at all. `three` is pinned at **0.185.1** with a comment in `pnpm-workspace.yaml` explaining why the bump is a reviewed PR rather than a range: r186 removes `PCFSoftShadowMap` on WebGPU and changes `PhysicalLightingModel.direct()`, and both move the avatar's look (doc 22 §4, §6).
