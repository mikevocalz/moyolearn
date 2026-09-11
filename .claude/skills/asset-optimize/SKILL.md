---
name: asset-optimize
description: Shrinks a rigged, morph-targeted character to a tier budget without damaging the rig. Use whenever an avatar asset is compressed, quantized, re-exported, split into tiers, or added to the manifest, and whenever a texture or geometry size is being reduced. It owns which glTF-Transform and gltfpack operations may touch a skinned character, and it gates every derivative on a rig fingerprint.
---

# Asset optimize

Optimising a static prop and optimising a rigged character are different jobs
that share a toolchain. The tools' defaults are tuned for the prop. On a
character they quietly remove the things that make it a character — skin
weights, morph correspondence, node names the runtime binds by — and the result
loads, renders, and is subtly wrong in a way no error reports.

So every derivative is gated on a **rig fingerprint**, and that gate is the
point of this skill. Bytes may change. The rig may not.

## Measure before deciding — the received wisdom is wrong here

"Textures dominate a character" is the standard advice and it is false for this
asset. Measured on `natalie-phone`, attributing every buffer view by role:

| | KB | share |
|---|---|---|
| morph targets | 8043 | **60.1%** |
| geometry | 2134 | 15.9% |
| textures (all 8 images) | 2109 | 15.8% |
| skinning | 1099 | 8.2% |

The morph targets are **already sparse** — 85.5% smaller than a dense encoding —
and still carry three fifths of the file. 52 targets across two primitives is
what a face costs. Resizing every texture to a quarter of its area saves under
12% of the total; the lever is quantizing and meshopt-compressing the target
deltas.

Run the breakdown per asset before proposing a plan. Attribute BUFFER VIEWS,
not accessors: views are real regions of the file and sum to it, while accessor
logical sizes double-count anything sharing a view. Getting that wrong reports
morph targets at 185% of the file they live in.

## The pipeline, explicit

Never `optimize` on a character — it is a bundle of defaults chosen for props.
Run the steps, fingerprint after each: `dedup`, `prune`, `weld`, `sparse`,
`resample` (clips only), `quantize`, `meshopt`, then textures per tier.

`quantize` is the floor: KHR_mesh_quantization needs no runtime decoder, so
every tier can take it. `meshopt` goes on top only where the runtime can decode
it — verify that on the device rather than assuming, because the answer changes
the budget.

## Never on a character

**`simplify`, and gltfpack's `-si`.** Two independent reasons and either is
fatal. Decimation redistributes skin weights across vertices that no longer
correspond to the ones the weights were painted for. And on this asset the
morph targets are SPARSE — their indices address specific vertices, so removing
a vertex silently re-points every target after it. A lower-poly tier is
authored and re-skinned from source, never decimated in a pipeline.

**Draco.** No morph-target compression, and a WASM decoder to ship. meshopt
does the job these assets need and compresses targets.

**gltfpack without `-kn -km -ke`.** It merges nodes and collapses the tree by
default. A rig is a tree whose node names are its API.

`flatten` and `join` only if the fingerprint proves the skeleton and the skinned
primitives survived. `palette` is for props.

## The fingerprint

`scripts/rig-fingerprint.mjs` emits joint count and names, skin count,
inverse-bind matrix hashes, per-primitive attributes and skinning and target
counts, morph target names from the MESH's `extras.targetNames`, node names,
animation and material counts. Two paths compare; a break exits non-zero.

Hash the DATA, not the accessor. Digesting the accessor object compares
bufferView indices and byte offsets, which differ between a `.gltf` and a `.glb`
of one rig by construction — it reported the marketing and phone assets as
having different bind poses when the matrices are byte-identical. A fingerprint
that cries wolf is worse than none, because the next real break gets waved
through.

Interleaving is recorded and allowed to change: `quantize` and `meshopt` both
rewrite layout. Read that diff rather than ignoring it — a normalised attribute
sharing an interleaved buffer on this asset once asked WebGPU for `unorm32x4`,
which is not a format, and the pipeline failed at `createRenderPipeline` with
no mention of the attribute responsible.

## Rules

- Fingerprint before and after every step. Joints, names, skins, bind matrices,
  target names and counts are identical or the derivative is rejected.
- No `simplify`/`-si` on a skinned or morph-targeted mesh, at any tier.
- Decoder availability is verified on the target runtime before a compressed
  format is chosen for it.
- Byte budgets are per delivery class. A pipeline source is not a download.

## References

- `scripts/rig-fingerprint.mjs` — the gate.
- glTF-Transform · https://gltf-transform.dev/cli · https://github.com/donmccurdy/glTF-Transform
- meshoptimizer / gltfpack · https://github.com/zeux/meshoptimizer
- KHR_mesh_quantization · https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_mesh_quantization
- EXT_meshopt_compression · https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_meshopt_compression
- KHR_texture_basisu · https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_texture_basisu
- KTX-Software · https://github.com/KhronosGroup/KTX-Software
- Audit, source of truth · `audit/motion/realism-2026-09-10.md`
