---
name: face-adapter
description: The one contract every facial control writes through — FACS action units, viseme channels, gaze and blink, each with a range and exactly one owner — plus the calibrated mappings from Audio2Face-3D, to the Humano rig, and to a GNM head. Use this whenever ANYTHING touches a facial control: adding or renaming a blendshape or morph, wiring Audio2Face output, changing the face bus or its merge, adding a blink/gaze/emotion layer, landing or swapping a GNM head, rebaking the head container, changing the expression encoder, or when anyone says her face looks wrong, plastic, frozen, twitchy, uncanny, "she's smiling when she shouldn't be", or the mouth stops reading under an expression. Use it before writing any per-channel max().
---

# Face adapter

Four systems want the same face: the speech solver, the emotion layer, procedural blink, and gaze. The audit's finding is that they currently fight over it, and per-channel `max()` is how they fight.

Read `audit/motion/realism-2026-09-10.md` §5 first.

## The contract

One face control contract. Every producer writes to it; nothing writes past it to a rig or a container directly.

Four groups:

| Group | What it carries |
|---|---|
| **AU** | FACS action units — brow, lid, cheek, nose, lip corner, chin, jaw |
| **VIS** | Viseme channels — jaw opening, lip closure, rounding, spread |
| **GAZE** | Eye yaw/pitch, plus the derived look weights |
| **BLINK** | Lid closure, per eye |

Every channel declares a range and **one owner**. Machine-readable: `references/contract.json`. Prose, with the reasoning per channel: `references/contract.md`.

The point of a single owner is not tidiness. It is that a channel with two owners has no defined value, so the face's appearance depends on merge order and frame timing, which is exactly the class of bug that reads as "uncanny" and never reproduces.

## Masks and priorities — this replaces per-channel `max()`

`packages/avatar/src/face-bus.ts` merges speech, idle and emotion by per-channel `max()`, and `HumanoInput.emotion` says it deliberately mirrors that rule. `max()` is commutative and cheap, and it is wrong for a face:

- A `mouthSmile` of 0.55 from `happiness` (`EMOTION_PRESETS`, `packages/avatar/src/emotion.ts`) wins against every viseme value below it. The lip corners stop articulating and hold a smile through the whole sentence.
- `surprise` carries `jawOpen: 0.15`. Under `max()` that becomes a floor: the mouth cannot close below it, so bilabials stop closing while the tone holds.
- Nothing prevents `mouthClose` and `mouthFunnel` both being high at once. That face does not exist on a human.

The rule that replaces it:

1. **During articulation, jaw and lips belong to speech.** Full authority, no blending against expression. If the mouth is talking, the mouth is the speech solver's.
2. **Expression modulates the upper face freely and the lip corners inside a limit.** The corner limit is a hard cap, per channel, in the contract. A tone shapes the mouth; it does not take it.
3. **Blink and gaze own their channels outright.** Neither the speech solver nor the emotion layer writes an eye channel. A2F does not animate eyes at all — the a2f.ts header says so — so there is no contention to resolve, only a boundary to enforce.
4. **No universal per-channel `max()` anywhere.** Where two producers legitimately overlap, the contract names the resolution: speech-priority, additive-with-clamp, or exclusive.

Full ownership and mask table: `references/contract.md`.

Per-AU onset / apex / release envelopes live in `tone-to-performance` — this skill defines the channels; that one defines their timing.

## Mapping 1 · Audio2Face-3D → contract

A2F returns `{ fps, names, frames, emotion }` (`packages/voice/src/a2f.ts:31`) — ARKit-named weights, sampled on the client's audio clock by `sampleFace()` (`packages/app/features/tutor/tutor-audio.ts:394`).

Map **by name, never by index**. `names` is carried in the payload precisely because the order is the host's, not a constant. Two documented deviations make an index map actively wrong:

- `mouthClose` is not standard ARKit `mouthClose` — the SDK's includes jaw opening.
- Several ARKit shapes are always zero from A2F. A2F does not animate head, eyes, or tongue fully.

Per-channel gain and limit table: `references/map-a2f-to-contract.md`.

## Mapping 2 · contract → Humano

Bind to the curves in `packages/avatar/rig-manifest.json`. **Read the manifest; never hardcode a morph or bone name.** It is produced by the `avatar-rig-audit` skill — run that first, and re-run it after any asset change.

What the manifest reports as of 2026-09-10: both `humano-marketing.glb` and `natalie.gltf` carry **52 morph targets, identical lists**, and `skeletonsAgree: true` with a recorded `skeletonHash`. The full ARKit set is present, including the channels the presence driver's `LipShape` does not expose.

That gap is the finding. `LipShape` (`packages/avatar/src/presence/humano.ts:184`) declares nine morphs and `lipFromOpenness` writes those nine; the asset has 52. The nine are a limit of the openness path, not of the rig, and the way past it is `HumanoInput.face` — named weights written by name at `packages/avatar/src/presence/humano.ts:739`. Bind the contract there.

The driver's own header carries constraints the manifest does not: the skin binds to `DEF-*` bones only, the control bones `head`/`neck`/`chest` are not ancestors of any DEF bone, and every torso/head rotation must be mirrored onto a parallel chain or the eyeballs detach. That is rig-level, not face-level, but a face adapter that moves the head touches it.

## Mapping 3 · contract → GNM

GNM's expression space is 383 components (`audit/motion/realism-2026-09-10.md` §5, citing <https://github.com/google/GNM/tree/main/gnm/shape>). It is a PCA-style basis, not a blendshape rig.

**Never assign ARKit weights to similarly indexed coefficients.** ARKit index 12 and GNM component 12 have nothing to do with each other; the result is a face that moves and is not the face you asked for, with no error anywhere.

Fit it explicitly: least squares from the contract to the expression basis, with temporal regularization, corrective terms for combinations the linear fit cannot reach, identity held fixed, topology and UVs preserved. Method, objective, and the residual report format: `references/map-contract-to-gnm.md`.

Record residuals per channel. A fit without residuals is a claim.

## The impossible-face detector

Conflicting AUs are a class of bug, not a list of incidents, so catch them structurally. `scripts/impossible-face.mjs` reads a frame stream and fails on any frame where mutually exclusive channels are simultaneously active:

- lips closed and funnelled
- lips closed and stretched wide
- jaw open past the closure ceiling while `mouthClose` is at its floor
- lip corners up and down on the same side
- eye wide and blinking on the same eye
- brow inner up and brow down on the same side

Run it in CI over every generated performance, over the A2F output, and over the golden fixtures. It has a `--self-test` that asserts it catches each conflict — a detector that has never caught anything is not evidence.

## Gate

- Lip articulation is legible under **every** palette tone, at every intensity in `tone-to-performance`'s table. Test the mouth under `celebrate-big` before believing it works, because that is the highest smile intensity in the palette.
- The impossible-face detector passes on the whole fixture set.
- Fit residuals are recorded, per channel, with the fit's date and the container hash.
- Behaviour cases pass: bilabial closure, teeth exposure, sibilants, rounded vowels, silent listening, interrupted words. `viseme-timing`'s `references/test-set.md` owns those assertions; do not write a second set.

None of these is a number to claim. Record what you measured and what you did not, per the audit.

## Rules

- One writer per channel, enforced at the type level where possible. `claimFaceWriter` (`packages/avatar/src/store.ts`) already does this for the whole expression vector; the contract does it per channel.
- Never write a channel without checking it exists on the target. `directEncoder` silently drops unknown names, and `LipShape` is nine morphs — no `mouthPucker`, no `mouthPress*`, no `mouthRoll*`.
- Never let a facial service delay the voice. `A2F_TIMEOUT_MS = 2500` (`packages/voice/src/a2f.ts:66`), every failure is "no face, never no voice".
- Never run any face or emotion inference on a learner's audio or image. A2E reads Natalie's synthetic voice only — doc 19, the A2E licence, and `tooling/check-voice-egress.mjs` all say it.
- A permanent smile is not warmth and a random brow twitch is not responsiveness. Both are `tone-to-performance`'s territory; this skill's job is to make sure neither can win a channel by accident.

## References

- `references/contract.md` — channels, ranges, owners, masks, conflict resolution
- `references/contract.json` — the same, machine-readable, imported by the detector
- `references/map-a2f-to-contract.md` — ARKit 52 → contract, gains, limits, A2F deviations
- `references/map-contract-to-humano.md` — manifest binding, observed names, discrepancies
- `references/map-contract-to-gnm.md` — least-squares fit, regularization, residual report
- `references/repo-anchors.md` — installed symbols with file:line, and what is absent

## Sources

FACS <https://www.paulekman.com/facial-action-coding-system/> · ARKit `ARFaceAnchor.BlendShapeLocation` <https://developer.apple.com/documentation/arkit/arfaceanchor/blendshapelocation> · GNM shape module <https://github.com/google/GNM/tree/main/gnm/shape> · Audio2Face-3D SDK <https://github.com/NVIDIA/Audio2Face-3D-SDK>
