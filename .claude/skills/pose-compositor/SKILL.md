---
name: pose-compositor
description: The single writer that turns layers — clips, gestures, life layer, speech-driven head and torso, gaze and IK — into one coherent pose. Use this whenever code writes to more than one channel or joint owner, whenever clips are mixed with procedural motion, whenever an AnimationMixer is proposed, and whenever two systems appear to fight over a joint. It owns joint ownership; nothing else may write a bone it claims.
---

# Pose compositor

Two systems writing one joint is the defect that produces every artifact worth
naming: the shrug on every breath, the hand through the torso, the finger inside
the palm, the pose that resets when a clip ends. None of them is fixed where it
is seen. They are fixed by deciding who owns the joint.

## Ownership, from the manifest

Build the ownership table from `rig-manifest.json` — 96 of 470 joints deform the
mesh, and only those are worth owning. Every layer declares which joints and
channels it writes; two claims on one joint is a build error, not a blend.

Layer order, base upward:

1. base clip
2. semantic gesture
3. life layer
4. speech-driven head and torso
5. gaze and IK constraints

Later layers are **additive deltas relative to the reference pose**, never
absolute writes. An absolute write from layer four erases layer one, which is
how a gesture ends by snapping the body back to rest.

## It replaces the per-frame rest-restore

`packages/avatar/src/presence/humano.ts` currently restores the rest pose and
recomputes from it every frame — `HumanoPresence.rest()` is the state a freeze
holds, and the writer leans on that shape. It works because there is exactly one
writer. The moment a clip plays beside it, restoring rest per frame erases the
clip, and blending without restoring accumulates drift. The compositor owns the
joints instead, and the rest-restore goes.

Until then: **no `AnimationMixer` runs beside the presence writer.** Both write
bones directly; whichever runs second wins, silently, and the result depends on
effect ordering.

## Continuity is the hard part

Quaternion interpolation in the correct **local** frames — a slerp in the wrong
frame is a joint travelling the long way round. Preserve velocity across
interruption and transition boundaries: a gesture cut off mid-stroke must retract
or finish its safe part, never freeze and never teleport to rest.

Feet stay planted. The support pose is a constraint, not an output; a hip
rotation that moves a foot is a bug even when the upper body looks right.

IK only for real targets — a board, an object the lesson actually has. IK toward
an imagined point produces a stable-looking arm pointing at nothing, and the
elbow direction has to be stable or the forearm rolls between frames.

Hands are coupled anatomically: a relaxed arc, mild coupling between adjacent
fingers, thumb opposition, wrist and forearm rotation together, and
follow-through that lags the arm. Ten independent channels is the fidgeting the
audit already names.

## One clock, no allocation, deterministic

Everything schedules from the audio playback position. Nothing allocates per
frame — a compositor that allocates is a compositor that stutters at the moment
it matters. Given the same inputs it must produce the same pose, or none of the
tests below mean anything.

## Rules

- One writer per joint. A second is a build error.
- Additive deltas against the reference pose. Never absolute writes above layer one.
- Local-frame quaternion blending. Velocity preserved across boundaries.
- No `AnimationMixer` beside the presence writer until this owns the joints.
- No per-frame allocation. Deterministic given inputs.

## References

- `references/ownership.md` — the table and how a conflict is resolved.
- `packages/avatar/rig-manifest.json` · `packages/avatar/src/presence/humano.ts`
- three.js animation system · https://github.com/mrdoob/three.js
- Holden, Learned Motion Matching (transition and blend quality) · https://theorangeduck.com/page/learned-motion-matching
- Audit §4 · `audit/motion/realism-2026-09-10.md`
