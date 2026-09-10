---
name: presence-metrics
description: Measures whether the avatar is actually good, and refuses claims that are not measured. Use this whenever anyone asserts realism, naturalness, quality or "it looks great now", whenever an acceptance record is filled in, and before any release that touches motion or the face. It owns the acceptance record; a number without a method does not count.
---

# Presence metrics

Automated correctness is necessary and not sufficient. A raw-engine test that
requires body movement every two seconds passes on a metronome — the audit says
so directly. Passing it establishes nothing about naturalness, purposeful
stillness, semantic timing, or whether anyone prefers the result.

So this layer measures, and the measurement has to be harder to fake than a
sentence.

## The record refuses estimates

`scripts/acceptance.mjs --init` writes a record with every field set to the
literal string `not measured`. `--check` rejects a bare number: a measurement
carries `{ value, method, capture }` or it says `not measured`.

That asymmetry is the whole design. A bare number is indistinguishable from a
guess the moment the person who wrote it has moved on, and a record of guesses
is worse than an empty one because it reads like evidence. Writing
`not measured` must stay cheaper than inventing something plausible.

## Objective, and what each catches

- **Viseme vs phoneme offset** — median and p95, per device and audio route.
  Bluetooth adds 150–300 ms that no amount of scheduling care removes; measure
  the route, not the code.
- **Head onset against F0 peaks** — pitch-track the played waveform. This is the
  one that distinguishes cadence from bobbing, and it is why head pitch must not
  be driven by `jawOpen`: that correlation should be indistinguishable from
  chance.
- **Torso energy vs speech RMS** — coupling, at conversational amplitude.
- **Blink and breath statistics** — against a *render*, not against the
  generator. `life-layer`'s distribution check validates the generator; it does
  not prove what reached the screen.
- **Idle periodicity** — autocorrelation over 30 s. See `life-layer` for why the
  gate is near-exact recurrence rather than a low threshold.
- **Artifact detectors** — foot slide, penetration, pose reset, eye detachment.
  Inappropriate motion is a failure exactly as much as missing motion.

## Subjective, done properly or not claimed

Paired, blinded, identical audio and camera and lighting, before against after.
Report N and confidence intervals. A small internal preference test is reported
as exactly that — not as a study, not as evidence of naturalness.

Adult raters first. Any child sessions only with guardian consent under the
existing compliance framing.

## What may be said

Nothing outside the record. Not "production-quality realism", not
"human-like", not "award-winning" — not in a commit message, not in a PR
description, not in a report. `--check` reminds you when nothing has been
measured, which is the state today.

## Rules

- Every number in the record has a method and a capture, or says `not measured`.
- Measure per device AND per audio route. One number for "the app" is not a
  measurement.
- Statistics come from a render, not from the generator that fed it.
- A claim with no field behind it does not go in a commit message.

## References

- `scripts/acceptance.mjs` — `--init`, `--check`.
- `references/toolkit.md` — what exists, what does not.
- GENEA (how speech-to-gesture is evaluated) · https://genea-workshop.github.io/
- Listen, Denoise, Action! · https://arxiv.org/abs/2211.09707
- Seamless Interaction evaluation method · https://ai.meta.com/research/seamless-interaction/
- Tavus Phoenix-4.5, the coordination benchmark · https://www.tavus.io/blog/phoenix-4-5
- ITU-R BT.1359 (audio/video timing tolerance) · https://www.itu.int/rec/R-REC-BT.1359
- Audit §"Acceptance before a realism release" · `audit/motion/realism-2026-09-10.md`
