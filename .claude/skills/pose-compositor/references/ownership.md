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

## Not built

The compositor does not exist yet. This skill defines what it must be; the
clip library it composes does not exist either (zero animation clips in both
shipped assets), so the layer-one input is currently empty and the audit's
per-frame rest-restore remains in place. Do not describe the compositor as
present.
