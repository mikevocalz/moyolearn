---
name: tone-to-performance
description: Turns a pedagogical tone into a face, a posture and a timing envelope — the emotion layer. Use this whenever expression, tone, emotion, mood or "make her warmer / more patient / more excited" comes up, whenever tutor response metadata changes, and whenever a new tone is proposed. Run it before touching any expression channel; it owns which tones exist and what each one is allowed to do to the face.
---

# Tone to performance

Affect is an **output** here. It comes from lesson state and the tutor's
intended delivery, and never from the child — not from their face, not from
their voice, not from how they type. A tutor that reads a child's mood and
mirrors it is a surveillance feature wearing a friendly coat, and it is banned
on this surface.

## The palette is closed

`packages/voice/src/tones.ts` defines `TONE_PALETTE` and derives `ToneKey` from
it. That is the API. A tone that is not in it does not exist, cannot be
requested, and must not be invented to satisfy a design note. There are no
intimacy tones.

Two consumers read a tone and they must agree:

- `packages/voice/src/tones.ts` — the voice recipe.
- `packages/app/features/tutor/tutor-tone.ts` — `TONE_RENDER`, the face.

**Check both whenever the palette changes.** `toneRenderFor` falls back to
`thinking-together` for an unknown key, so a tone present in the palette and
absent from `TONE_RENDER` renders a neutral face while the voice renders its
own recipe — silently, with no error. Run `scripts/check-tone-table.mjs`; it
fails on exactly that drift.

## What a tone owns, and what it may not touch

For each tone the table in `references/tone-performance.json` carries a FACS
action-unit set with intensity ranges, head and neck tendencies, posture and
gesture energy, gaze behaviour, an onset/apex/release envelope, and a band
modulation for K–2, 3–5, 6–8 and 9–12.

The hard boundary is the mouth. **Speech owns the jaw and the lips during
articulation.** Expression modulates the upper face and the lip corners inside
its limits, and every channel in the table is expression-owned and inside the
face contract's ceiling — `check-tone-table.mjs` asserts it. Legibility is never
traded for feeling: a child who cannot read the mouth has lost the thing the
face is for.

## Acknowledgment is not approval

No tone may render as "correct" on an incorrect answer. This is the rule that
decides ambiguous cases, and it is why the warm tones are bounded rather than
open: a broad smile arriving on a wrong answer teaches a child that the machine
was pleased with a mistake. A nod means *I heard you*. Nothing in this layer
means *you got it right* — that belongs to the words.

No permanent smile, no random brow. An expression has an onset, an apex and a
release; a face that holds one shape is a mask, and a face that changes on a
timer is a tic. Both read as not-listening.

## Audio2Emotion

The Audio2Face SDK can modulate a face from a voice. It may run on the tutor's
synthetic audio only — never on learner audio. Feeding a child's microphone to
an emotion model is inferring their affect, which the first paragraph forbids.

## Russell, if it helps

Valence and arousal are a useful internal parameterisation when interpolating
between two tones or bounding an envelope. They are not the interface. Anything
outside the palette does not get to become a tone by arriving as a coordinate.

## References

- `references/tone-performance.json` — the table, the envelopes, the band
  variants. Names and numbers live here, never in this body or in a code literal.
- `references/*` — the derivation and the per-channel ownership.
- `scripts/check-tone-table.mjs` — palette coverage, channel ownership, contract
  ceiling, and the `TONE_RENDER` drift check.
- FACS · https://www.paulekman.com/facial-action-coding-system/
- Russell, A circumplex model of affect (1980) · https://doi.org/10.1037/h0077714
- Audio2Face-3D SDK, Audio2Emotion · https://github.com/NVIDIA/Audio2Face-3D-SDK
- Audit, source of truth · `audit/motion/realism-2026-09-10.md`
