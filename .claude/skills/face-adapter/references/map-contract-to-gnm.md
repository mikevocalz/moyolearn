# contract → GNM

## The control space is not a blendshape rig

GNM's shape model is linear in two coefficient vectors over a mesh template (`gnm/shape/gnm_common.py`, transcribed in this repo's port at `packages/avatar/src/gnm/model.ts:10`):

```
bind   = template + identity_basis^T · id + expression_basis^T · expr
joints = template_joints + joint_identity_basis^T · id
```

Google's current GNM v3 documentation specifies **383 expression components** (`audit/motion/realism-2026-09-10.md` §5, citing <https://github.com/google/GNM/tree/main/gnm/shape>). Those are PCA-style basis directions over vertex displacement. They are not named facial actions, they are not ordered by anything a rigger would recognise, and component *k* has no relationship to ARKit blendshape *k*.

**Never assign ARKit weights to similarly indexed coefficients.** The audit names this specifically. The result is a face that moves plausibly and is not the face you asked for, with no error anywhere — the worst failure shape there is.

The repo's own encoder already guards the analogous mistake for the head container: `encoderForContainer` (`packages/avatar/src/speech/encoder.ts`) refuses to guess, checks the container's `bake` block and its `expressionNames`, and throws with the reason when they disagree. Extend that posture; do not weaken it.

## Fit explicitly

Solve for the expression coefficient vector that best reproduces the contract's target geometry, per frame, in one least-squares problem.

### Objective

Minimise over the frame sequence `E`:

1. **Data term.** Vertex displacement from `expression_basis^T · E[t]` against the target displacement the contract's channel values imply, weighted per region. Regions come from `componentNames` / `regionNames` in `GNMMeta` (`packages/avatar/src/gnm/model.ts:68`) — weight lips, jaw and lids heavily, weight scalp and neck at zero.
2. **Temporal regularization.** Penalise the second difference of `E` across frames. Without it, a per-frame independent fit jitters: the basis is overcomplete for any single target, so consecutive frames land on different equally-good coefficient sets and the face buzzes.
3. **Magnitude regularization.** Ridge term on `E`. Keeps the solution off the far tails of the basis, where GNM's linear model stops being valid and the mesh self-intersects.
4. **Corrective combinations.** A linear fit cannot reach some combinations — lip closure under a wide jaw is the standard one. Add explicit corrective terms for the combinations the behaviour cases exercise, fitted separately and applied on top, exactly as a rig would use combination shapes.

### Held fixed

- **Identity.** Solve for `expr` only. `id` stays at the chosen identity vector for the whole session. `GNMHeadModel` separates them already: `setExpressionVector` (`:422`) touches only the expression side, `setIdentityVector` (`:410`) only the identity side. Never fit both — a solver given both will trade identity for expression and Natalie's face will change shape while she talks.
- **Topology and UVs.** The template's triangles, quads and UV layout are not fit variables.
- **Head and neck joints.** GNM's own neck/head joints stay at identity forever — the model's dev guard at `packages/avatar/src/gnm/model.ts:444-458` enforces it and says why: those are body-owned. Head pose comes from the body layer, not from the face fit.

### Where it runs

Offline, per contract channel, producing a matrix or a learned map from contract values to expression coefficients. Not per frame at runtime — a least-squares solve over 383 components inside a render loop is not a mobile budget.

The runtime then applies the fitted map and writes through `setExpressionVector`. If the map turns out to be linear enough, it collapses into exactly the shape `matrixEncoder` already implements (`packages/avatar/src/speech/encoder.ts`) — a named-weight × basis matrix multiply — and should reuse it rather than growing a second one.

## Residual report

A fit without residuals is a claim. Record, per contract channel:

| Field | Meaning |
|---|---|
| `channel` | Contract channel name |
| `rmsMm` | RMS vertex error over the channel's region, in millimetres |
| `maxMm` | Worst vertex error in that region |
| `region` | Which `regionNames` entry was weighted |
| `correctives` | Combination terms this channel needed |
| `containerHash` | The GNM container the fit was solved against |
| `identityVector` | Hash of the identity held fixed |
| `date`, `solver` | Provenance |

Store it beside the fitted map. A residual table from a different container or a different identity describes a different fit.

There is no residual budget in this file, because none has been measured. Set one from the first fit, record it, and treat later fits as regressions against it — the audit's rule for every gate.

## Verify

- `scripts/impossible-face.mjs` is clean over a performance rendered through the fitted map. The detector works on contract channels, so run it on the input side too: a clean input that produces an impossible output means the fit is the problem.
- Behaviour cases from `viseme-timing`'s `references/test-set.md`: bilabial closure, teeth exposure, sibilants, rounded vowels, silent listening, interrupted words. Bilabial closure is the one that catches an unregularised fit, because closure is exactly the combination a linear basis reaches worst.
- Identity is unchanged between the first and last frame of a long utterance. Compare the fitted mesh's landmarks (`computeLandmarks`, `packages/avatar/src/gnm/model.ts:733`) at rest before and after.

## Status in this repo

`packages/avatar/src/gnm/model.ts` is a working GNM container parser and evaluator: it parses the container, holds identity and expression vectors, applies the bases, skins, and computes vertices and landmarks. What does **not** exist anywhere in the repo, verified 2026-09-10:

- No fitted contract→GNM map.
- No residual table.
- No corrective-combination set.

The audit is equally explicit that GNM is not the visible tutor today — the mobile and application web stages use the Humano/Rigify asset and `createHumanoPresence`. Do not describe a GNM adapter as shipped.

## Sources

GNM shape module <https://github.com/google/GNM/tree/main/gnm/shape> · repo: `packages/avatar/src/gnm/model.ts`, `audit/motion/realism-2026-09-10.md` §5
