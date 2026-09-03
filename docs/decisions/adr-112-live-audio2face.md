# ADR-112 — Audio2Face-3D and Audio2Emotion drive Natalie's face LIVE, on Moyo's own GPU host

Status: **ACCEPTED (the contract and the client). The host is NOT stood up — see §Blocked.**
Date: 2026-09-03 · Decider: Mike, product owner (Sep 3 direction: "the face should follow the voice") · Author: Prompt 6 pass

<!--
What it is: the decision to move NVIDIA Audio2Face-3D + Audio2Emotion from
"pre-baked assets only" (doc 32 §3) to the live tutoring turn, the wire
contract that carries the face beside the audio, the fallback chain, the
licences, and what it costs.
Why it exists: doc 32 scoped A2F to baked assets when the only way to run it
was NVIDIA's hosted endpoint. NVIDIA open-sourced the SDK (MIT) with open
weights on 2025-09-24 and deprecated the hosted endpoint in April 2026. The
constraint that made "baked only" right has moved; this records the delta
(SPEC-002) rather than silently obeying the stale scope.
SOT: packages/voice/src/a2f.ts · packages/voice/src/eleven.ts · packages/app/features/tutor/tutor-audio.ts
     packages/avatar/src/presence/humano.ts · docs/pack/32-tutor-voice-tone.md §3 · .claude/skills/audio2face-live/SKILL.md
SOT-KEYWORDS: adr audio2face a2f audio2emotion a2e live face blendshape frames performance envelope licence gpu host cost fallback spec-002
-->

## Decision

1. **The live path carries a face.** For every server-emitted, tag-verified
   sentence, the voice egress may compute Audio2Face-3D blendshape frames
   from the EXACT ElevenLabs Flash bytes the client will play, and ship both
   together as one `performance`. The client schedules frame `k` at
   `start + k / fps` on `AudioContext.currentTime`. There is no second clock
   and no second audio buffer, so face and voice cannot race.
2. **The Safety Plane still owns the performance** (doc 22 §7). The face is
   computed inside `@acme/voice` — the credential-holding egress that only the
   voice route may import (`tooling/check-voice-egress.mjs`) — from text the
   plane already passed. No feature calls A2F. Structurally, no learner audio
   can reach it: the package has no import path to learner input, and the
   route only ever hands it Natalie's own rendered sentence.
3. **Emotion is specified, never inferred from anyone but Natalie.** The
   tone's `a2f` field (`tones.ts`, doc 32 §4) travels to the host as the
   explicit emotion. Audio2Emotion may read *her* voice for telemetry; it
   never reads a child's, which the A2E licence also forbids (§Licences).
4. **The wire contract** (`apps/web/app/api/tutor/voice/route.ts`):
   `200 application/json { audio: base64, audioContentType, face: { fps, names, frames } }`.
   `names` is carried, never assumed: the SDK's `mouthClose` deviates from
   ARKit (it includes jaw opening) and several shapes are always zero, so the
   client maps by name. `200 audio/mpeg` remains the answer when no face host
   is configured or the face failed.
5. **The fallback chain, fail-open on the face and fail-closed on the body:**
   frames present → full performance · no frames → the audio-analysis mouth
   (`analyseSpeech`, energy + zero-crossings — this repo's alignment fallback,
   since Flash's stream carries no character timestamps) · no audio → 2D or a
   calm idle with the mouth closed; captions carry the words. Never a frozen
   face, never an error at a child.
6. **The 3D writer takes the face as an input** (`HumanoInput.face`) and, when
   present, writes the whole 52-name frame in place of the openness-shaped
   lips. Blink, eyes-wide and gaze remain the idle engine's — A2F does not
   animate eyes or head. The tone's emotion baseline merges UNDER speech by
   per-channel max, exactly as the 2D face bus does, so she emotes on both
   surfaces (before this, the 3D path applied no emotion at all).
7. **Baked pieces (doc 32 Path B) re-render through the same host** so live
   and baked faces are one face. Not done in this pass; it is a bake-script
   change (`apps/web/scripts/voice-bake.mts`) once the host exists.

## What ships in this pass

| Piece | Where | Verified by |
|---|---|---|
| A2F client, timeout, validation, fail-open | `packages/voice/src/a2f.ts` | `voice.test.ts` — same bytes to A2F and client; 503 → audio; malformed → audio; unset → no call |
| Performance through egress → service port → route | `eleven.ts`, `voice.service.ts`, `apps/web/lib/voice.ts`, the route | typecheck + the tests above |
| Client decode, name-mapped sampling, interpolation, onset lead | `tutor-audio.ts` | `tutor-audio.test.ts` — envelope decoded, frames sampled by name, lead paid once per turn |
| Face + emotion on the 3D writer | `presence/humano.ts` | `humano.test.ts` — face replaces lips; emotion holds under speech |

## Blocked — needs Mike

- **The GPU host.** The SDK is a C++ library (`libaudio2x.so`), CUDA ≥ 12.8,
  TensorRT ≥ 10.13, Linux, "4 GB+ GPU memory recommended". Moyo has to wrap
  it in one endpoint (`POST /v1/face`, audio body, emotion in headers, JSON
  out). I cannot stand up a GPU host from this session. Until it exists,
  `AUDIO2FACE_URL` stays unset and the route answers audio exactly as today.
- **Cost, to be verified at PR.** Doc 32 records ~2.2 GB VRAM per stream on a
  4090. One T4 (16 GB, e.g. AWS g4dn.xlarge, ≈ $0.53/h on-demand ≈ $380/mo)
  should carry ~6 concurrent streams; an A10G (24 GB, g5.xlarge ≈ $1.01/h ≈
  $730/mo) ~10. A2F runs faster than real time, so a stream is busy for a
  fraction of each sentence; the real limiter is p95 latency under load,
  which must be measured before the number goes in doc 12 §7.
- **Regression v2.3 vs diffusion v3.0** is a measurement on Natalie's real
  Flash voice, not a choice from a table. Start with regression (faster,
  lower VRAM) and A/B on the demo phone.
- **Added latency budget.** The client already pipelines two sentences
  ahead; the face is computed on the sentence's own render, before it is
  needed. `A2F_TIMEOUT_MS = 2500` caps a cold host; a hung host costs the
  face, not the sentence. Doc 24's ≤ 2 s first-audio bar is unchanged only if
  the host's p95 for a 3 s sentence stays under ~300 ms. Measure.

## Licences (cite before production)

- **Audio2Face-3D SDK** — MIT (https://github.com/NVIDIA/Audio2Face-3D-SDK).
- **Audio2Face-3D models** — NVIDIA Open Model License (model index:
  https://github.com/NVIDIA/Audio2Face-3D). Read the current text at PR.
- **Audio2Emotion v2.2** — "License Agreement for NVIDIA Audio2Emotion Model
  for Use with Audio2Face Project" (https://huggingface.co/nvidia/Audio2Emotion-v2.2):
  *"This Model and any technology included with this Model may only be used
  in connection with the NVIDIA Audio2Face project"* and it prohibits use
  *"for the purpose of emotion recognition"* outside that context. The model
  card states it is *"ready for commercial/non-commercial use"* inside that
  scope. Our use — inferring emotion from Natalie's synthetic voice to drive
  her own face inside the A2F pipeline — is inside it; inferring a child's
  emotion would be outside it and is forbidden by doc 19 regardless.
  **Counsel to confirm the commercial reading before the host goes live.**
- Training framework — Apache-2.0 (not used).

## Consequences

- Easier: one face everywhere; the 2D face bus and the 3D writer consume the
  same `Shape`; no client-side inference, no GPU on the phone.
- Harder: a GPU host in the voice path, with its own cost line and its own
  outage mode (which is invisible to a child by design).
- Doc 32 §3's table changes: Path A's "Face" row becomes "A2F-3D + A2E live
  on Moyo's host, audio-analysis mouth as fallback". Filed as **SPEC-002**
  below; doc 32 carries the amendment note.
