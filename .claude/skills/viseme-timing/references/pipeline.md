# Viseme timing pipeline — stage spec

Six stages. Each names its input, its output, what it must not do, and how it fails.

---

## Stage 1 · Provider timings

**In:** one plane-passed sentence window of Natalie's output, plus the tone's voice settings.
**Out:** audio bytes + character-level timings describing *those* bytes.

### Request

Today's live call is `POST /v1/text-to-speech/{voiceId}/stream` (`packages/voice/src/eleven.ts:156`) and returns audio only. The timestamped variant is documented at <https://elevenlabs.io/docs/api-reference/text-to-speech/stream-with-timestamps>; read the current response schema there rather than assuming it matches the non-streaming `/with-timestamps` shape the baked path already parses (`BakedAlignment`, `packages/voice/src/eleven.ts:69`).

Keep every existing property of the live request when you move it:

- `model_id` from `registry.liveModelId` (`eleven_flash_v2_5`).
- `voice_settings` from `voiceSettingsFor(tone, band)` — tone × band modulation.
- `previous_text` for prosody stitching across the doc-07 sentence window.
- `output_format=mp3_44100_64`.

Any of these changing changes the timings. That is why a voice-settings edit re-triggers this skill.

### Normalized text

The provider expands numbers, abbreviations and currency before synthesis. The character timings are indexed against the *normalized* string. Carry that string through the pipeline and index the G2P against it. A maths tutor says "3/4", "12 × 8" and "$1.50" constantly; a schedule built against the pre-normalization text points at the wrong span for exactly those.

### Failure

No timings → fall through to Stage 2's audio-only path (`analyseSpeech`), record the downgrade in telemetry, keep the voice. Never fail the sentence.

---

## Stage 2 · Grapheme to phoneme

**In:** normalized text + language.
**Out:** phoneme sequence with character-span attribution.

### English

1. CMUdict lookup (<https://github.com/cmusphinx/cmudict>). It is hand-curated; a rule engine consulted first throws that away.
2. espeak-ng (<https://github.com/espeak-ng/espeak-ng>) for out-of-vocabulary words only.
3. Record which backend answered per word. An OOV rate that climbs is a lexicon problem, and you cannot see it if you do not log it.

CMUdict returns ARPAbet with stress digits (`AH0`, `IY1`). Strip stress for viseme lookup; keep it for Stage 4's jaw amplitude.

### Spanish

espeak-ng `-v es -x --ipa`. There is no Spanish CMUdict in this pipeline.

Dialect is a decision, not a default. `es-419` and `es-ES` differ on `θ` vs `s` (`c`/`z`), on `ʎ` vs `ʝ`, and on syllable-final `s`. Pick the voice's dialect and pin it beside the voice ID; a viseme table for the wrong dialect makes every `cinco` and `llave` wrong in the same way.

### The rule

**Never letter rules.** `evenTrack` (`packages/avatar/src/speech/driver.ts:192`) is what letter rules look like: `jawOpen` 0.5 for `aeiou`, 0.2 otherwise, spaced by character index. Adding a language means adding a G2P backend and a phoneme→viseme table, never widening a regex.

### Language plumbing does not exist yet

`SpeakSentenceInput` has no language field (`packages/voice/src/eleven.ts:76`). Doc 16 gates learner AI per locale via `aiTutorLocales` — a language ships only when the Safety Plane's L1–L5 classifiers pass in it. The viseme pipeline needs the same locale value the Safety Plane gate reads; do not invent a second source for it.

### Failure

G2P unavailable or the word has no pronunciation → that word falls back to the audio-analysis mouth for its span. Partial degradation, per word, not per sentence.

---

## Stage 3 · Forced alignment as validation

**In:** the fixed test set's audio renders + their transcripts.
**Out:** per-phoneme onset/offset ground truth.

Montreal Forced Aligner (<https://montreal-forced-aligner.readthedocs.io/>) over `references/test-set.md`, producing TextGrids that `scripts/check-timing.mjs` scores the emitted schedule against.

**MFA is offline and English/Spanish acoustic models must be downloaded per language.** It is a CI/bench instrument. It never runs on a device, never in a request path, and never on learner audio.

Regenerate the ground truth whenever the model, the voice settings, or the output format change — those change the render, and a stale TextGrid scores the new audio against the old one.

### Failure

MFA unavailable → the gate cannot be evaluated. Report "not measured", never a passing number. The audit is explicit: gates are calibrated and recorded, not claimed.

---

## Stage 4 · Viseme field

**In:** phoneme spans.
**Out:** `Track` — `[timeSeconds, Shape][]`, time-ordered.

Spec in `references/viseme-field.md`. Two things belong here rather than there because they are pipeline-level:

- The output type is the repo's existing `Track` (`packages/avatar/src/speech/track.ts:28`), sampled by the existing `sampleTrack` with its smoothstep. Do not invent a second schedule format; the sampler, the release ramp and the gap detection are already built against this one.
- Every channel written must exist on the target. `LipShape` (`packages/avatar/src/presence/humano.ts:184`) is nine morphs. Writing `mouthPucker` writes nothing and fails silently.

---

## Stage 5 · Scheduling

**In:** the `Track`, the decoded buffer, the route offset.
**Out:** per-frame `Shape`.

```
t = audio.currentTime() - playbackStartAt - routeOffsetSeconds
shape = sampleTrack(track, t, carriedIdx)
```

`playbackStartAt` is set from `audio.currentTime() + lead` at `source.start(startAt)` (`packages/app/features/tutor/tutor-audio.ts:642-644`). During the lead, `t` is negative and the mouth is closed — the lead is silence on purpose.

Forbidden clock sources, each because it has produced a visible bug in something shaped like this: response-arrival time (drifts with network), chunk-arrival time (jitters per chunk), `requestAnimationFrame` counters (drifts with frame rate), `Date.now()` (unrelated to the graph).

### Interruption

Cancel the schedule for the old generation, ease the mouth out over `idleConfig.speech.releaseMs` (250 ms, `packages/avatar/src/idle/config.ts:116`), transition into listening. Do not snap the mouth shut and do not reset the skeleton — the audit calls out pose reset as a named failure.

The generation guard already exists in `tutor-audio.ts` (`if (generation !== this.generation) return`). Reuse it; do not add a second one.

---

## Stage 6 · Route calibration

**In:** a loopback capture of a known render on a known device and route.
**Out:** one row in `references/device-calibration.md`.

`AudioContext.currentTime` is the graph clock. The output path — DAC, speaker, wired jack, Bluetooth codec buffer — is downstream of it and invisible to it. The `backend-audio-api.ts` header names both the problem and the right home for the fix: the backend, fed by `AudioManager`'s `routeChange`.

Measure with `scripts/measure-offset.mjs`. Re-measure per device model, per OS major, and per route class (built-in speaker, wired, each Bluetooth codec). Apply as `routeOffsetSeconds` in Stage 5.

An unmeasured route gets offset 0 and is marked unmeasured in the table. Zero is honest; a guessed number is not.
