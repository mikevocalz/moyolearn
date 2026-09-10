# Joint ownership

The table is generated from `rig-manifest.json` at build time rather than typed
here, so it cannot drift from the asset. This records the RULES for resolving a
claim, which a generated table cannot express.

## Resolution

| Situation | Resolution |
|---|---|
| Two layers claim one joint | Build error. Not a blend, not a priority — the design is wrong and a weight would hide it. |
| A layer writes a joint it did not declare | Build error. Silent extra writes are how double-driving returns after it is fixed. |
| Speech and expression both want the jaw | Speech owns jaw and lips during articulation. Expression modulates the upper face and lip corners inside its masks. Never a per-channel `max()`. |
| Gaze and head cadence both move the head | Gaze owns the eyes; head cadence owns the neck chain. They compose because they own different joints — this is why the split exists. |
| A clip and the life layer both touch the spine | The clip is the base; the life layer is additive on top, bounded so it cannot fight the clip's intent. |

## Deform joints only

96 of 470 joints carry skin weights. The other 374 are ORG and MCH control
chains whose Blender constraints did not survive export. Writing to them moves
nothing visible — and it is the failure that made a whole presence writer
invisible, so it is worth a build error rather than a comment.

## Ownership and modulation are different permissions

This is what lets the two rows above coexist. An OWNER writes a joint's
absolute value; a MODULATOR adds a bounded delta on top. Exactly one owner per
joint, any number of modulators, and a modulator on an unowned joint is an
error because its delta has no base. "The clip is the base, the life layer is
additive" and "two claims is a build error" are then one rule read at two
tiers.

The split already matches the code: restoring the reference pose each frame is
the owning write, and every `pose()` call is a modulation.

## What exists

`packages/avatar/src/presence/ownership.ts` declares the four layers and their
joints, derived from `HUMANO_BONES` and `FINGER_BONES` rather than retyped.
`tooling/check-joint-ownership.mjs` runs in the blocking `lint` chain and
enforces three things: every claimed joint resolves in all three shipped assets,
exactly one owner per joint with no orphan modulators, and no claimed bone name
typed outside the two files that derive them.

Layer one is a base POSE, not a clip — the reference pose plus the fingers'
resting arc. Neither shipped asset contains an animation, so a clip library is
something the table can accept later, not something it waits on.

The blending machinery itself is not built and is not needed while there is
exactly one writer. What the table buys today is that the second writer fails
the build where it is introduced instead of producing a visual bug three screens
away. Do not describe the compositor's blending as present.
