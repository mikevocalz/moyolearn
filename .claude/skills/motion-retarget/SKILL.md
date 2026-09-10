---
name: motion-retarget
description: Brings a motion clip onto Natalie's rig — commissioned, licensed or captured — and records what it is before it lands. Use this whenever a clip, BVH, FBX, SMPL-X/SMPL-H sequence or any animation asset enters the pipeline, whenever someone proposes a motion dataset, and whenever a clip is about to be committed. It owns the ledger; a clip without an entry does not ship.
---

# Motion retarget

Neither shipped asset contains a single animation clip — the rig manifest
records zero in both. Every behaviour in this product is procedural, which is
why a clip library is a prerequisite for the compositor rather than a
refinement of it.

## The ledger comes first

Not as paperwork. A ledger is how you **prove an asset is yours to ship** — the
source, the terms, the redistribution scope, who read them and when. That
question always arrives long after whoever acquired the clip has forgotten the
answer, and reconstructing it under pressure is the expensive version.

`scripts/ledger.mjs --check` fails when an asset in the manifest has no entry,
so an unrecorded clip cannot reach a build quietly. Run `--init` once to create
`packages/avatar/motion-ledger.json`.

The field that decides the most is `redistribution`:

- `source-and-built` — the editable file may live in the repository.
- `built-artifact-only` — only the optimised runtime clip ships; the source
  stays out of git and comes from the CDN the asset manifest already points at.
- `none` — neither goes in a public repository.

Most character and motion licences permit broad commercial use and forbid
redistributing the editable source. Those are different permissions, and a
repository is a redistribution channel whether or not it was meant as one.

## Retarget offline, never at runtime

Read the skeleton from `rig-manifest.json` — never a hardcoded bone name. Work
through, in order: units and up-axis, reference pose, pelvis height, shoulder
offsets, joint limits, twist distribution, finger joint semantics, contact
constraints. Bake constraints, because Rigify's did not survive export and a
clip that depends on them will move the control chain and not the skin.

**Several of those inputs are not measured yet.** `avatar-rig-audit`'s findings
name them explicitly — units as loaded, pelvis height, shoulder offsets, joint
limits, twist. Measure them before retargeting rather than assuming the glTF
defaults; a wrong reference pose is a clip that looks almost right and slides.

Preview the transition in and out, not only the middle. A clip that reads well
in isolation and cannot be entered from the rest pose is not usable.

## Clip metadata

Every clip carries: source and license, skeleton hash, posture, hand
availability, semantic tags, prep/stroke/hold/retraction times, entry and exit
poses, contact anchors, affected joints, and bounds. The compositor reads all of
it — a clip whose stroke time is unknown cannot be scheduled against a stressed
syllable.

The skeleton hash matters most. A clip retargeted against one rig and played on
another moves the wrong joints, and the manifest's hash is what catches it.

## Datasets

Ship optimised clips through the existing avatar asset system
(`packages/avatar/src/assets.ts` — `AssetEntry`, `AssetManifest`). Never bundle
a research dataset into the product.

Two named sources carry restrictions worth knowing before anyone spends time on
them: **BONES-SEED** limits eligibility by revenue and prohibits raw-data
redistribution; **Seamless Interaction** is CC BY-NC 4.0, so a commercial
derivative needs a grant, and retargeting or baking does not launder the
underlying terms. Both are useful to read and neither enters the repo without a
ledger entry.

## Rules

- Ledger entry before the file. `--check` is the gate.
- Bone names come from the manifest. A clip that hardcodes one is broken by the
  next export.
- Retargeting happens offline and is committed as a result, not as a runtime step.
- A clip without prep/stroke/hold/retraction times cannot be scheduled; do not
  accept one.

## References

- `references/metadata.md` — the clip metadata schema and why each field exists.
- `scripts/ledger.mjs` — `--init`, `--check`.
- `packages/avatar/rig-manifest.json` · `packages/avatar/src/assets.ts`
- SMPL-X · https://smpl-x.is.tue.mpg.de/ · MANO / SMPL-H · https://mano.is.tue.mpg.de/
- glTF-Transform · https://gltf-transform.dev/
- Blender Rigify · https://docs.blender.org/manual/en/latest/addons/rigging/rigify/index.html
- BONES-SEED licence · https://bones.studio/info/seed-license
- Seamless Interaction terms · https://huggingface.co/datasets/facebook/seamless-interaction#-license--data-usage-policy
- Audit, source of truth · `audit/motion/realism-2026-09-10.md`
