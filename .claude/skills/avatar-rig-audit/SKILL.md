---
name: avatar-rig-audit
description: Parses the shipped Natalie assets into rig-manifest.json — the single source of joint names, deform-vs-control chains, morph targets and skeleton identity. Use this whenever the avatar asset, its bones, morph targets, skin weights, the presence writer, a clip import or facial-curve wiring are touched, and whenever anyone says "the model looks off", "her face is wrong", "the rig", or asks which bones to write to. Run it before any other avatar skill; they all read its output.
---

# Avatar rig audit

The rig is the contract. Every other avatar skill reads `rig-manifest.json`
rather than naming a bone, because a name typed into a source file is a name
that drifts from the asset silently — and this asset has already produced one
whole presence writer that moved nothing.

## Why the manifest exists

Rigify exports three parallel chains and only one of them deforms the mesh.
`DEF-` bones carry the skin weights. `ORG-` and `MCH-` are the control and
mechanism chains that constraints drove inside Blender, and **constraints do not
export** — writing to them moves the skeleton and not the skin. The presence
writer targeted control bones and the tutor's head, neck and chest sat still
while the code that moved them passed its tests.

So: never write a bone name into source. Read it from the manifest and fail
loudly when it is absent. A missing bone is silent otherwise — `pose()` no-ops
on null, and a skeleton whose names do not match renders in its bind pose with
nothing anywhere to say why.

## Procedure

Regenerate the manifest whenever an asset changes:

```
node .claude/skills/avatar-rig-audit/scripts/build-rig-manifest.mjs \
  packages/avatar/rig-manifest.json \
  packages/avatar/assets/humano-marketing.glb \
  packages/avatar/assets/natalie-phone/natalie.gltf
```

The script is plain node. A GLB is a 12-byte header and two length-prefixed
chunks; a `.gltf` is JSON; everything the manifest records lives in the JSON
chunk. That is forty lines against a dependency the repo would otherwise carry
for one build-time script, and it decodes no BIN payload.

Then check three things, in this order:

1. **Do the skeletons agree?** `skeletonsAgree` is the invariant the runtime
   depends on: the presence writer addresses bones by name, so marketing and the
   phone build must be the same rig or identical code moves different joints.
   A `false` here is a release blocker, not a note.
2. **Does every name the writer uses exist?** Cross-check the writer's bone map
   against `chains.deform`. A name that is not in the manifest is a channel that
   does nothing.
3. **What changed?** Diff against the committed manifest. Joint count, chain
   sizes, morph names and the skeleton hash are the fields worth a human
   reading.

## What the manifest is not

It records what the asset *contains*, not what it can *do*. Skin influence
counts and per-bone local axes are measured at runtime against a loaded
skeleton — that is `packages/avatar/src/presence/rig-axes.test.ts`, and it is
the right place for them because an axis is a property of the loaded pose, not
of the file. Extend that test rather than teaching this script to guess.

It also records zero about motion. Neither shipped asset contains an animation
clip, so there is no idle or listening library to read; every behaviour in this
product is procedural until a licensed clip set exists.

## Rules

- The manifest is generated, never edited. A hand-corrected manifest is a lie
  the next regeneration silently overwrites.
- Regenerate and commit it in the same change as an asset swap. A stale manifest
  is worse than none, because the tests that read it will pass.
- Do not put numbers or names from it into a skill body or a code literal.
  `references/findings.md` holds the measured state; the manifest holds the
  authoritative lists.
- Bind-pose facts (units, reference pose, pelvis height, shoulder offsets, joint
  limits, twist distribution) are needed by `motion-retarget` and are **not
  measured yet** — see `references/findings.md`. Do not cite them as known.

## References

- `references/findings.md` — what the current assets measured, with the date.
- glTF 2.0 · https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
- Blender Rigify (deform vs control semantics) · https://docs.blender.org/manual/en/latest/addons/rigging/rigify/index.html
- glTF-Transform (the exporter that wrote both assets) · https://gltf-transform.dev/
- three.js skinning and `morphTargetDictionary` · https://github.com/mrdoob/three.js
- Audit, source of truth · `audit/motion/realism-2026-09-10.md`
