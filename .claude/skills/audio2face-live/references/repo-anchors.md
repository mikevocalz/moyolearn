# Where this lands in MoyoLearn

The body of `SKILL.md` is written to be portable. These are the symbols in this
repository it maps onto — verified present, not assumed.

| Concern | File and symbol |
|---|---|
| Client contract for the live face | `packages/voice/src/a2f.ts` |
| The decision and its open questions | `docs/decisions/adr-112-live-audio2face.md` |
| The audio sink to tee from | `packages/app/features/tutor/tutor-audio.ts` — `TutorAudioQueue`, `TutorAudioPort.decode` / `createSource` |
| Per-sentence render already in place | `TutorAudioQueue.enqueue(text, voice)` — the render path a face frame must arrive with, not after |
| Baked, never-live audio | `packages/voice/src/baked.ts` — `BAKED_PIECES`, entries with `crisis: true` |
| Tone palette (the only affect input) | `packages/voice/src/tones.ts` — `TONE_PALETTE`, `ToneKey` |
| Morph target names | `packages/avatar/rig-manifest.json` |

## The identity mapping is confirmed, not conditional

`SKILL.md` says "if the avatar's morph targets are ARKit-named, the mapping is
identity". For this asset they are. The rig manifest records **52 morph targets
carrying the ARKit names verbatim**, so contract-to-Humano is gains and limits
rather than a fit. Do not build a fit for this mesh; the fit is the GNM problem.

## The crisis path is not a live render

`BAKED_PIECES` marks the S4 scripts `crisis: true` — serve the cache or serve
nothing, never a live render. A2F must not be placed in front of them, and
Audio2Emotion must not run on them either: the register is fixed by protocol,
not inferred from a waveform.

## Open, and not established here

ADR-112 records the GPU host as pending. This file does not establish the
production environment, the chosen model variant, or any measured latency —
those are `a2f-live`'s outputs and none of them exist yet. Write "not measured"
rather than an estimate.
