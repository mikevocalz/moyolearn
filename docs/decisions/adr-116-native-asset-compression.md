# ADR-116 — Compression formats are chosen per runtime, not per asset

**Status:** accepted · **Date:** 2026-09-11
**SOT:** `.claude/skills/asset-optimize/SKILL.md` · `audit/motion/realism-2026-09-10.md`

## Context

The avatar master is 13.07 MB against a 4 MB phone bundle, so something has to
compress. The obvious choices — `EXT_meshopt_compression` for geometry and
morph deltas, Basis-transcoded KTX2 for textures — both ship a decoder, and a
decoder that will not initialise is worse than no compression: the asset fails
to load rather than loading large.

Where the bytes actually are, measured by buffer view on `natalie-phone`:

| | KB | share |
|---|---|---|
| morph targets (already sparse) | 8043 | 60.1% |
| geometry | 2134 | 15.9% |
| textures | 2109 | 15.8% |
| skinning | 1099 | 8.2% |

The received advice — textures dominate a character — does not hold here, so
the format decision matters most for the target deltas, which is the half that
needs a geometry decoder.

## The check

Both decoders hard-require WebAssembly. This is not a preference either of them
degrades from:

- `three/examples/jsm/libs/meshopt_decoder.module.js:20` — `if (typeof
  WebAssembly !== 'object') return { supported: false };`. There is no
  JavaScript fallback path in the file.
- `three/examples/jsm/loaders/KTX2Loader.js:106` — the transcoder is
  `basis_transcoder.wasm`, fetched and instantiated.

The native runtime is Hermes on both platforms:
`apps/mobile/ios/Podfile.properties.json` sets `"expo.jsEngine": "hermes"`,
`apps/mobile/android/gradle.properties` sets `hermesEnabled=true`, and no JSC
package is installed. Hermes does not implement WebAssembly.

**Not verified on a device.** The two decoder requirements and the engine choice
are read from source and config in this repo; that Hermes exposes no
`WebAssembly` global is upstream behaviour this branch has not executed. The
decision below is safe either way — it costs bytes, not correctness — but if a
device ever reports a `WebAssembly` object, the native path can take meshopt and
the budget improves.

## Decision

Formats are chosen per runtime.

**Native:** geometry ships QUANTIZED ONLY, via `KHR_mesh_quantization`, which is
a data layout rather than a codec and needs nothing at runtime. Textures ship as
KTX2 in a GPU-native format the device already decodes — ASTC on iOS and modern
Android, ETC2 as the fallback — or as a platform image the runtime decodes
natively. No transcoder on the device.

**Web:** meshopt and Basis both, where the WASM decoders are fine.

## Consequences

The native bundle is larger than the web one for the same content, and the 4 MB
phone budget is therefore tighter than the tooling defaults assume.

**Measured 2026-09-11, and the estimate above this paragraph was wrong.** The
first draft predicted quantization would roughly halve the target deltas to
~4 MB. Building the derivative (`quantize` then `sparse` — that order, see
below) measured:

| | master | quantized+sparse |
|---|---|---|
| morph targets | 8043 KB | **754 KB** |
| geometry | 2134 KB | 2063 KB |
| skinning | 1099 KB | **29 KB** |
| bin total | 11,276 KB | **2846 KB** |

The estimate missed that re-sparsification compounds with quantization: int16
deltas are half the bytes, and deltas that quantize to zero leave the sparse
set entirely. Rig fingerprint clean; the IBM rewrite is the verified shared
transform.

Bundle today: bin 2846 + JSON ~200 + untouched textures 2109 = **5.03 MB**.
The remaining gap closes in the texture step (KTX2/ASTC, which the phone GPU
decodes natively), so **no morph-target reduction is needed** — the 52-target
question raised in the first draft is answered by measurement, not by an
authored cut.

**Order matters and the tool's own report cannot be trusted for rig truth:**
`quantize` alone densified all 156 sparse accessors and TRIPLED the file to
42.48 MB while logging "Removed Skin (1)" about a skin that survived. `sparse`
afterwards landed at 5.28 MB. The fingerprint, not the tool log, is the gate.

GPU-native KTX2 means one texture set per format family, so the phone tier
carries ASTC and ETC2 variants rather than one Basis file. Budget accordingly.
