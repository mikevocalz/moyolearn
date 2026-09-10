---
name: viseme-timing
description: Build and verify Natalie's mouth timing — the path from ElevenLabs audio to a viseme schedule that lands on the phoneme it belongs to. Use this whenever ANY speech playback path changes (queueing, decode, scheduling, the audio backend, the onset lead, sentence pauses), whenever the TTS model or voice settings change (model_id, stability, style, speed, output_format, band modulation), whenever a new language is added to the tutor, whenever alignment or timestamp data starts or stops being available, and whenever anyone says the lip sync is off, late, early, mushy, "chewing", "her mouth isn't moving", or "she looks dubbed" — even if the request sounds like a one-line tweak to a constant. Also use it before claiming any lip-sync timing number.
---

# Viseme timing

The mouth cannot be better than the clock, and it cannot be better than the phonemes. This skill covers both halves and the measurement that proves either one.

Read `audit/motion/realism-2026-09-10.md` first — it is the source of truth for what this pipeline is allowed to claim.

## What is installed right now

Do not plan against the pipeline you wish existed. As of this branch:

| Fact | Where |
|---|---|
| The live TTS call is `POST /v1/text-to-speech/{voiceId}/stream` — **no timestamps come back** | `packages/voice/src/eleven.ts:156` |
| The baked call is `/with-timestamps` and returns `BakedAlignment` = `characters`, `character_start_times_seconds`, `character_end_times_seconds` | `packages/voice/src/eleven.ts:69,237` |
| `stream-with-timestamps` is **not called anywhere in this repo** | verified by grep, 2026-09-10 |
| The live mouth is energy + zero-crossing analysis of the decoded PCM, not phonemes | `analyseSpeech`, `packages/avatar/src/speech/audio-shapes.ts:63` |
| The letter-rule fallback still exists and is still exported | `evenTrack`, `packages/avatar/src/speech/driver.ts:192` |
| Playback position is `AudioContext.currentTime - playbackStartAt` | `packages/app/features/tutor/tutor-audio.ts:373` |
| The graph clock does not see speaker/route latency at all | header note, `packages/avatar/src/speech/backend-audio-api.ts` |
| Both shipped assets carry the full **52 ARKit morph targets**, identical lists | `packages/avatar/rig-manifest.json` |
| **No G2P, no CMUdict, no espeak-ng, no MFA** is installed in this repo or on PATH | verified 2026-09-10 |
| There is **no language parameter** on `SpeakSentenceInput` | `packages/voice/src/eleven.ts:76` |

So every stage below except the clock is new work. Say that in the plan rather than describing it as a fix.

## The pipeline

```
text ─► ElevenLabs stream-with-timestamps ─► character timings
                                              │
                    real G2P per language ────┤  (CMUdict/espeak-ng EN, espeak-ng ES)
                                              ▼
                                        phoneme spans
                                              │  validated against the returned audio by MFA
                                              ▼
                        JALI-style jaw/lip viseme field + coarticulation
                                              ▼
                          viseme schedule (Track: [t, Shape][])
                                              ▼
                  scheduled on the audio playback clock, offset by route
```

Full stage-by-stage spec, including request shape and failure behaviour: `references/pipeline.md`.

### 1 · Timings come from the provider, on the audio that plays

Character timings must be requested on the same call that produces the bytes the client plays. Two calls means two renders, and ElevenLabs is nondeterministic — the timings would describe audio nobody hears. This is why the baked path already fuses them (`renderBakedClip` returns bytes and alignment from one response) and why the live path must move to the streaming timestamp endpoint rather than adding a second request.

Preserve the normalized-text mapping the provider returns. Numbers, abbreviations and currency are expanded before synthesis; a schedule built against the pre-normalization string points at the wrong span for exactly the words a maths tutor says most.

### 2 · Characters are not phonemes — run real G2P

`evenTrack` is the anti-pattern in the repo: one keyframe per letter, `jawOpen` 0.5 for `aeiou` and 0.2 otherwise. It produces an even chew with no silence and no stress, and it is wrong in English before it is even asked about Spanish.

- English: CMUdict lookup first, espeak-ng only for out-of-vocabulary words. CMUdict is a curated pronunciation dictionary; falling straight to a rule engine loses the hand-checked entries.
- Spanish: espeak-ng `-v es --ipa`. Spanish orthography is shallow, which is exactly why hand-rolling letter rules is tempting and still wrong — `ll`, `y`, `c`/`z`, `x`, syllable-final `s`, and the stop/approximant alternation of `b d g` are all dialect-conditioned.
- Never extrapolate one language's rules to another. Adding a language means adding a G2P backend and a phoneme→viseme table, not widening a regex.

Phoneme→viseme tables: `references/phonemes-en.md` (ARPAbet), `references/phonemes-es.md` (IPA).

### 3 · Validate against the returned audio with MFA

G2P gives you the phoneme sequence. It does not give you where each phoneme lands in *this* render. Montreal Forced Aligner over a fixed test set is what turns a guess into a measurement, and it is the reference the gate is scored against.

The test set is fixed so numbers are comparable between runs: `references/test-set.md`. It carries English and Spanish, maths vocabulary, long explanations, silence, hesitation, and interruption — the same corpus the audit's acceptance section asks for.

MFA is a validation instrument, not a runtime dependency. It never runs on a device and never runs on a learner's audio.

### 4 · Phonemes to a viseme field, with coarticulation

Drive a JALI-style two-axis field — jaw opening and lip shape — rather than a per-phoneme pose lookup. A lookup snaps; a field lets the jaw hold through a consonant cluster the way a real one does.

Overlap dominance functions so neighbouring phonemes blend instead of stepping. The consequence that matters: **bilabial closure is enforced after blending, not before**. `/p/ /b/ /m/` must reach a closed mouth even when a wide vowel sits either side, because a bilabial that does not close is the single most legible lip-sync failure. `references/viseme-field.md` carries the axis definitions, dominance parameters, and the closure rule.

Deliver the track as `HumanoInput.face` — named ARKit weights written by name (`packages/avatar/src/presence/humano.ts:739`) — not as the `mouth` scalar, whose `lipFromOpenness` path exposes 9 of the asset's 52 morphs. `packages/avatar/rig-manifest.json` is the list of what exists; check it before writing a channel, because a missing morph fails silently.

### 5 · Schedule from the audio playback clock, and only that

Frame `k` plays at `playbackStartAt + t_k + routeOffset`, read off `AudioContext.currentTime`. Never response-arrival time, never a network chunk boundary, never a render timer, never `Date.now()`.

The repo already does the first part: `tutor-audio.ts:373` computes position as `currentTime() - playbackStartAt`, and `sampleFace()` interpolates A2F frames on it. Keep that shape. `ONSET_LEAD_MS = 300` (`packages/avatar/src/speech/driver.ts:30`) is scheduling silence on purpose — the schedule's t=0 is the audible onset, not the `speak()` call.

Interruption cancels the schedule for the old generation and eases the mouth out; it does not snap shut and does not reset the skeleton. The release ramp already exists at `idleConfig.speech.releaseMs = 250` (`packages/avatar/src/idle/config.ts:116`).

### 6 · Calibrate per device and per audio route

`AudioContext.currentTime` is the graph clock. It does not include the output path, so a Bluetooth route can be a hundred-plus milliseconds late while the clock reports a perfect schedule. The backend header already flags this and names the right home for the fix — the backend, fed by route-change events (`packages/avatar/src/speech/backend-audio-api.ts` header).

Measure it. Do not estimate it. `scripts/measure-offset.mjs` cross-correlates a loopback capture against the source render and prints the lag; the result goes in `references/device-calibration.md`, which ships **empty of measurements on purpose** — a calibration table with invented rows is worse than none.

## The gate

Scored against MFA phoneme onsets on the fixed test set, per language:

| Metric | Threshold |
|---|---|
| median \|viseme onset − phoneme onset\| | ≤ 40 ms |
| p95 \|viseme onset − phoneme onset\| | ≤ 80 ms |
| worst visual-late (mouth behind sound) | never > 45 ms |

The 45 ms figure is the one with an external basis: ITU-R BT.1359-1 gives sound-advanced detectability at 45 ms, which is the asymmetric direction — a late mouth is caught long before an early one. The 40 ms and 80 ms figures are **Moyo's own gate**, chosen tighter than detectability so device jitter has headroom; they are not a published constant and must not be cited as one. Confirm the in-force BT.1359 revision at <https://www.itu.int/rec/R-REC-BT.1359> before quoting it in a spec.

Behaviour cases that must pass alongside the numbers — bilabial, sibilant, rounded vowel, silence, interrupted word — are in `references/test-set.md` with the expected assertion for each.

`scripts/check-timing.mjs` computes all three metrics and exits non-zero on failure. Wire it to the fixed test set; a run without a recorded output is not a gate.

## Replay tests

The scheduler is pure: alignment JSON in, viseme schedule out. Test it that way, in Node, with no audio device — the same split `packages/avatar/src/speech/track.ts` already relies on.

`scripts/schedule-visemes.mjs` is that function as a CLI. Fixtures live in `references/fixtures/`; each has an input alignment, its phoneme spans, and the expected schedule. A replay test asserts the emitted schedule, not that the function returned something.

## Rules

- Never write a timing number into a doc, comment, or PR body without the measurement that produced it and the device/route it came from.
- Never ship `evenTrack` as a production path. It is a fallback for an aligner that was never wired; wiring the aligner is the work.
- Never send a learner's audio anywhere in this pipeline. G2P and MFA see Natalie's text and Natalie's render only. That is doc 19's no-emotion-recognition-of-minors rule and `tooling/check-voice-egress.mjs`'s import fence, both saying the same thing.
- A failed alignment costs the mouth, never the voice. The existing wrapping at `tutor-audio.ts:623` is the pattern: catch, drop the track, keep playing.
- When the fallback runs, say so in telemetry. A silent downgrade to energy-only lipsync is how "lip sync looks off" becomes unreproducible.

## References

- `references/pipeline.md` — stage-by-stage spec, request shapes, failure behaviour
- `references/phonemes-en.md` — ARPAbet → viseme class, CMUdict/espeak-ng sourcing
- `references/phonemes-es.md` — Spanish IPA → viseme class, espeak-ng sourcing
- `references/viseme-classes.json` — the machine-readable class table, read by both scripts
- `references/viseme-field.md` — jaw/lip axes, dominance parameters, bilabial closure rule
- `references/device-calibration.md` — per-device/route offset table and how to fill it
- `references/test-set.md` — the fixed corpus and the behaviour assertions
- `references/repo-anchors.md` — every installed symbol this skill names, with file:line

Adjacent skills: `avatar-rig-audit` owns `rig-manifest.json` and runs first. `face-adapter` owns which producer may write a channel. `tone-to-performance` owns expression timing.

## Sources

ElevenLabs stream-with-timestamps <https://elevenlabs.io/docs/api-reference/text-to-speech/stream-with-timestamps> · JALI, Edwards et al., ACM TOG 35(4), 2016 <https://dl.acm.org/doi/10.1145/2897824.2925984> · Montreal Forced Aligner <https://montreal-forced-aligner.readthedocs.io/> · CMUdict <https://github.com/cmusphinx/cmudict> · espeak-ng <https://github.com/espeak-ng/espeak-ng> · ITU-R BT.1359 <https://www.itu.int/rec/R-REC-BT.1359>
