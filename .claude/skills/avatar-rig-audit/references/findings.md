# What the shipped assets measured

Generated 2026-09-10 by `scripts/build-rig-manifest.mjs` from
`packages/avatar/assets/humano-marketing.glb` and
`packages/avatar/assets/natalie-phone/natalie.gltf`. Authoritative lists live in
`packages/avatar/rig-manifest.json`; this file is the reading of them.

## Skeleton

| | |
|---|---|
| Nodes | 472 (both assets) |
| Skin joints | 470 (both assets) |
| Skin name | `Humano_Rig-Plus_080-4620_01_A-LOD0-Skel` |
| Skeleton hash | `4e29e8d065b4e55d…` — **identical across both assets** |
| Exporter | glTF-Transform v4.5.0 (both) |

The hash matching is the invariant the runtime depends on: the presence writer
addresses bones by name, so one code path drives both builds.

## Chains

| Chain | Count | Deforms the mesh |
|---|---|---|
| `DEF-*` | 96 | **yes** |
| `ORG-*` | 76 | no |
| `MCH-*` | 151 | no |
| other (IK controls, e.g. `foot_ik.L`, `toe_ik.R`) | 147 | no |

96 of 470 joints carry skin weights. The other 374 are control and mechanism
bones whose Blender constraints did not survive export — writing to them moves
nothing visible. This is the failure the audit records.

## Animation

**Zero clips in both assets.** There is no idle, listening or gesture library in
the shipped files. Every behaviour is procedural until a licensed clip set
exists, which is what makes `motion-retarget` a prerequisite for `pose-compositor`
rather than an optimisation.

## Morph targets — the finding that changes the face plan

**52 targets, and they are the ARKit vocabulary**, verbatim: `browInnerUp`,
`browDownLeft/Right`, `browOuterUpLeft/Right`, `eyeLookDown/In/Out/Up*`,
`eyeBlinkLeft`, `jawOpen`, `mouthClose`, `mouthFunnel`, `mouthPucker`,
`cheekPuff`, `tongueOut` … An eight-name probe across the ARKit set matched 8/8.

Consequence: Audio2Face-3D emits ARKit-style blendshapes, and this mesh already
speaks them. The **A2F → Humano mapping is near-identity with gains and limits,
not a fit.** The least-squares fit described for the face adapter is the *GNM*
problem — 383 expression components onto the contract — and it does not apply to
the asset shipping today. Do not spend a fit on a vocabulary that already
matches; do verify each curve's usable range visually before trusting it.

ARKit reference · https://developer.apple.com/documentation/arkit/arfaceanchor/blendshapelocation

## Material extensions

| Extension | Marketing GLB | Phone glTF |
|---|---|---|
| `KHR_materials_anisotropy` | yes | yes |
| `KHR_materials_ior` | yes | yes |
| `KHR_materials_specular` | yes | yes |
| `EXT_texture_webp` | yes | no |

Both assets author specular, IOR and anisotropy. The native stage rebuilds
materials as `MeshStandardMaterial` at load — the comment in
`tutor-avatar-3d.native.tsx` records why (Dawn throws on three's node graph for
`MeshPhysicalMaterial`) — so those three extensions are authored and discarded on
device. That is `avatar-materials`' starting point, and the hair anisotropy in
particular is lost.

## The audit's inverse-bind finding, confirmed

Node and joint lists match; the skins point at different inverse-bind accessors
— **224** in the marketing GLB, **222** in the phone glTF. Same rig, different
accessor layout, which is expected from two exports of one source and is why the
skeleton hash is computed over joint NAMES in joint order rather than over bytes.

## Not measured

Stated rather than estimated, because `motion-retarget` needs these and must not
be handed a guess:

- Units and up-axis convention as loaded (the glTF spec fixes metres and +Y, but
  the exported reference pose has not been verified against it here).
- Reference-pose pelvis height, shoulder offsets.
- Per-joint limits and twist distribution.
- Skin influence counts and per-bone local axes — these belong to
  `packages/avatar/src/presence/rig-axes.test.ts`, which measures them against a
  loaded skeleton. Extend that test; do not add guesses here.
