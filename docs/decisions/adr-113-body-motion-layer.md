# ADR-113 — The body motion layer: how Natalie stops moving like a robot

Status: **ACCEPTED (layers B and C). Layer A is blocked on assets — see §Layer A.**
Date: 2026-09-03 · Decider: Mike ("she moves like a robot") · Author: Prompt 6 pass

<!--
What it is: the layered design of Natalie's body motion below the neck, the
one finding that explains most of the robot, the numbers each layer runs on,
and where the companionship firewall sits in the sum.
SOT: packages/avatar/src/idle/engine.ts · packages/avatar/src/idle/config.ts · packages/avatar/src/presence/humano.ts
     packages/avatar/src/presence/rig-axes.test.ts · packages/avatar/src/safety/gesture-gate.ts
     audit/motion/behaviour-taxonomy.md · audit/motion/what-reads-robotic.md
SOT-KEYWORDS: adr body motion layer weight shift fingers torso gaze away head follow listening cues rigify def bones firewall mixamo blocked
-->

## The finding that came first

The phone body is a Blender Rigify export. The mesh is skinned to the
`DEF-*` bones; the control bones (`head`, `neck`, `chest`, `jaw_master`,
`DEF-pelvis`) are exported as nodes but **are not ancestors of any bone that
carries weight** — Blender drove the DEF chain from them with constraints,
and constraints do not export. `presence/humano.ts` wrote its head drift,
nods, breath and jaw to those control bones. Every frame, correctly, to
nothing. Her head never turned or nodded on the phone; her chest never rose;
"breathing" was a shoulder twitch. The finger curl was written on local `z`,
which on this rig is a splay.

This is now a red test rather than a memory: `presence/rig-axes.test.ts`
builds the node hierarchy from the shipped glTF, reads the skin weights from
the `.bin`, and asserts (1) every bone the writer poses is an ancestor of
weight, (2) the control bones deform nothing, and (3) the local-axis
semantics the writer relies on — spine `+x` pitches toward the camera, `+y`
yaws, `+z` tilts; upper arm `+x` forward, `+z` abducts (L+, R−); finger `+x`
curls. The writer applies every rotation in the bone's own frame
(`rest × Δ`); it used to add to Euler `rotation.x`, which is a parent-frame
rotation and only coincides with the local axis while the rest rotation is
small.

**The model asset is not altered.** Mike asked that the model not be touched;
this pass changes which bones the code poses, nothing in the GLB/glTF.

## The layers, additive, one pose per frame

| Layer | Source | Status |
|---|---|---|
| **A. Base idle** — mocap clips retargeted to the `DEF-*` bones, `AnimationMixer`, additive B on top | Mixamo idle/listening/thinking/talking loops, retargeted in Blender | **Blocked** — see below |
| **B. Procedural micro-motion** — `idle/engine.ts`, seeded | New channels: `weightShift`, `torsoYaw`, `shoulderL/R`, `wristL/R`, ten finger channels, `gazeAwayYaw/Pitch`, `headFollowYaw/Pitch` | **Shipped, golden-testable** |
| **C. Event / co-speech** — beats from the speech envelope; listening from the learner's cues | `tutor-cues.ts` (typing cadence, open recorder, send) → `partnerSpeaking` / `partnerPauseEvent`; the audio queue's scheduled onset → `timeUntilOnset` | **Shipped** (EMAGE remains a gateway-side future) |

### Layer B — the numbers (from `audit/motion/behaviour-taxonomy.md`)

| Channel | Rate / amplitude | Why |
|---|---|---|
| weight shift | every U(8, 20) s; move U(1.2, 2.2) s; ±22 mm hip travel; 8 % follow-through past the target | the thing a standing person does every quarter-minute; the overshoot is the settle |
| torso turn | 0.05 Hz wander × 1.5°; on a turn end or every U(12, 30) s a held turn of U(2, 4)° for U(3, 6) s, 0.8 s ease | a listener re-orients when the other person stops |
| shoulders / wrists | 0.12 Hz × 1.5° · 0.18 Hz × 3°, independent per side | never still, never symmetric |
| fingers | each of ten: its own rate U(0.2, 0.35) Hz and amplitude U(2, 5)°, spread 50/30/20 down the phalanges | no two in phase — the glove look |
| gaze away | every U(3, 4) s for U(0.3, 1.2) s, U(4, 8)° yaw, U(−3, 1)° pitch | the firewall's stare ceiling is 4 s, so by construction it cannot be exceeded |
| head follow | 35 % of gaze, τ = 0.35 s | the head trails the eyes, a beat late |
| hand follower | spring k = 320, ζ = 0.55 behind the arm lift | overlap and follow-through on every beat |

All body channels draw from a **second PRNG stream derived from the seed**
(`seed ^ 0xb0d7`), so the face's stream is untouched: a seed that produced a
given head before this ADR produces the same head after it, and no head
golden needs re-approval for the body being added under it. Same seed →
bit-identical frames is asserted across all 33 channels.

### The bar (`idle/engine.test.ts`, `humano.test.ts`)

- longest interval with no joint below the neck moving > 0.5° over 180 s: **< 2 s** (asserted)
- weight-shift gaps in [8, 20] s (+ move), CV > 0.15 (asserted)
- every finger 1.5–5°, no pair correlated > 0.5 over 10 min (asserted)
- gaze never held > 4 s; away ≤ 1.2 s + ease (asserted)
- torso turns ≥ 1.5° within 1 s of a pause event (asserted)
- head lags the eyes: lagged correlation beats instantaneous (asserted)
- **firewall:** over 10 min of mixed speaking / thinking / listening the summed
  chest pitch stays ≤ `maxTorsoLeanRad` (8°) and shoulder flexion ≤
  `maxShoulderFlexionRad` (45°), read off the writer's own `firewall` field
  (asserted). The reach cap is applied where the reach is made, not filtered
  after.

### Reduced motion

A render mode, not a toggle. The writer takes `reducedMotion` and holds every
body channel at rest (delta 0 into the engine, so the PRNG stream is still
identical between modes); mouth and blink are never scaled. `reduced-motion.ts`'s
registry names each new surface with its governing field and consumer, and
`assertMotionPolicyComplete` fails if one is missing.

## Layer A — blocked, and what it needs

Mixamo requires an Adobe login to download clips and Blender to retarget onto
`DEF-*`; neither is available to this session, and the retarget must be
checked against `rig-axes.test.ts`'s semantics before any clip plays. The
runtime half (`AnimationMixer`, `AnimationUtils.makeClipAdditive` for layer B
on top, 0.4–0.8 s crossfades, never the same clip twice, random offsets, body
clips masked away from `DEF-spine.005/.006` and the morphs) is a small,
well-understood piece of three.js and is deliberately NOT scaffolded without
clips to play — a mixer with nothing in it is a stub.

What to do when the clips exist: export animation-only glTF with the same
node names; a name-parity script over `skins[0].joints` vs the clip's
`channels[].target.node` names (extend `tools/verify_native_gltf.mjs`);
review every clip against `FORBIDDEN_GESTURES` before it enters the library.
Mixamo terms: https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html —
cite the current FAQ at PR (the page did not load from this session).

Layer B alone meets every line of the bar above except the one that only
mocap gives: hands that *settle and re-settle* into new resting places. Mike
should watch the after video with that specific gap in mind.

## Consequences

- Easier: the whole body is seeded and Node-testable; the bar is a test.
- Harder: 21 new channels in every golden fixture; the head goldens are
  unaffected by design, the body goldens are new.
- Follow-ups: layer A; EMAGE through the gateway for content gestures
  (count-on-fingers, indicate-board); measuring the finger-channel cost on
  the phone tier (a `Follower` and 30 `pose()` calls per frame is small, but
  it is measured, not assumed — see the smoke walkthrough).
