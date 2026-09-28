# ElevenLabs v4 upgrade

Status: implementation ready for account and listening verification; not a production audio approval.

## Decision

Use `eleven_v4` for both live sentences and baked pieces, with the existing `ELEVENLABS_VOICE_ID`. The product request prioritizes natural delivery and a consistent Natalie. There is no automatic model or voice fallback. Missing configuration or synthesis failure keeps the text-only behavior.

v4 is a model ID, not an API path version or a suffix to add to a voice ID. A Professional Voice Clone may need v4 fine-tuning under ElevenLabs My Voices. Changing or recreating the licensed asset requires a separate identity/rights review.

Both paths use the documented HTTP Text-to-Dialogue contract: one `inputs` entry, `model_id`, and `settings` containing `stability` and `similarity`. Live uses `/v1/text-to-dialogue/stream`; baked uses `/v1/text-to-dialogue/with-timestamps`. Both request `mp3_44100_128`. The generic HTTP reference still defaults to v3; actual v4 access and this account's existing voice must be verified by a synthesis request before release.

The existing clients buffer and decode each sentence. Provider streaming is retained, but this change does not introduce incremental client decoding or promise a 100 ms end-to-end speaking delay. A WebSocket transport is unnecessary for this bounded sentence protocol.

## Behavior

- The nine lesson tones remain closed. v4 receives Stability/Similarity and trusted delivery tags; legacy speed/style controls are removed. Prose bracket tags in signed tutor text become literal parenthesized words in the provider copy. Numeric intervals, indices, symbolic math, displayed captions and signature verification remain intact.
- K–2 requests include slow/clear delivery intent, grades 3–5 slow intent, and teens a restrained delivery intent. These are model directions, not equivalents of the old numeric rate control. S4-young uses the K–2 recipe; shared ordinary baked pieces retain a neutral age recipe.
- Signed utterances still pass through `protectedOperation`, the Safety Plane/MAC boundary and the single voice egress. The learner ID is used only for the budget, never sent to ElevenLabs.
- Request cancellation reaches synthesis and Audio2Face. A cancelled face render cannot return playable audio. The face uses exactly the bytes returned to the client; the playback clock is unchanged.
- Requests over HTTP dialogue's reliable 2,000-character limit (including tags) fail to text-only without truncating the lesson. Verified previous context is bounded to the documented 100 characters. Requests time out after 30 seconds.
- Baked responses validate JSON, base64 and timing arrays. Normalized alignment is preferred. A voice/recipe/script fingerprint selects the cache namespace; content-addressed audio is uploaded before a manifest containing its digest and alignment. Failed or competing publications cannot combine different generations' audio and timing. Old caches remain available for rollback. S4 cache misses never call synthesis.
- Voice cost uses the published standard v4 estimate of $0.08/1,000 characters, checked September 28, 2026. It deliberately excludes the temporary launch discount and account-specific agreements. The existing daily band ceilings stay unchanged. An atomic conditional upsert reserves the whole tagged request before dispatch, so concurrent prefetches cannot cross the cap. Reservations remain charged after failure/cancellation because provider billing may already have occurred; this is a conservative budget estimate, not an invoice ledger. No schema migration is required.

## Release verification

With the deployment's server environment loaded, run:

```sh
pnpm --filter web voice:check
pnpm --filter web voice:bake
```

`voice:check` prints no key and no voice ID. It reads `/v1/models` and the configured voice, then spends one short sentence on the live synthesis path and reports whether audio came back. A passing check still does not certify how the audio sounds.

**Readiness is the synthesis probe, not the fine-tuning field.** An earlier version of this check required `fine_tuning.state['eleven_v4'] === 'fine_tuned'` for professional voices. That can never pass. ElevenLabs keys `fine_tuning.state` by fine-tunable model, and this account's `/v1/models` reports `can_be_finetuned: false` for `eleven_v4`, `eleven_v4_turbo` and `eleven_v3` — `true` only for `eleven_multilingual_v2`, `eleven_flash_v2_5`, `eleven_turbo_v2_5`, `eleven_turbo_v2`, `eleven_flash_v2` and `eleven_multilingual_sts_v2`. No voice on any account can report a v4 state. The v4 capabilities page describes a My Voices "plus button next to Eleven v4" for fine-tuning an existing PVC; the live model catalogue contradicts it, and the catalogue is what the API enforces. `fineTuningState` and `liveModelFineTunable` are still printed so a future live model that IS fine-tunable is visible rather than silently unchecked.

The probe exists because metadata cannot see the failure that matters. `/v1/models` is a read and keeps answering `can_do_text_to_speech: true` while the account is refused at synthesis: an unpaid invoice appears only as a 401 `payment_issue` on a TTS call. The probe is charged off any learner budget, for the same reason `renderBakedClip` takes no learner ID — a readiness check is an operations cost, not a child's spend — and its response body is cancelled as soon as the first chunk proves audio is flowing.

The configured asset is a Voice Library copy (`sharing.status: "copied"`, `is_owner: null`), fine-tuned for `eleven_turbo_v2` only. Moyo does not own the source recording. Do not clone it, swap the speaker, or add a "v4" suffix to the voice ID to work around a readiness failure.

`voice:bake` regenerates every piece in the v4 namespace, including both S4 scripts, and fails if a complete audio/alignment bundle cannot be published. Run before routing production sessions to this revision. Keep existing v3 assets.

Listen on web and native with the configured Natalie voice: all nine tones, K–2 slow explanations, grades 3–5, teen encouragement, fractions/negative numbers/bracket notation, adjacent sentence transitions, both S4 scripts and live-to-baked transitions. Require intelligible child pacing, stable identity/accent, exact safety wording, no spoken direction tags, and acceptable time to audible playback. Test interruption, retry/offline recovery and mouth closure; check A2F timing against the actual playback clock. Do not claim phoneme accuracy from the existing audio-analysis fallback.

Account access, PVC fine-tuning, production bake, real listening and native/device checks have not been performed in this checkout because provider/deployment credentials are not loaded. Database reservation semantics require the existing database integration environment; unit tests exercise contention at the ledger port, not a live Postgres server.

Rollback: restore the preceding deployment/commit and its v3 cache keys. No data migration or asset deletion is involved. Do not configure a mixed live-v3/baked-v4 state.

## Automated checks

- Voice package tests: request schema/settings, one voice, bounded context, input limits, model access report, budget reservation, cancellation, provider failures, baked timing and cache fingerprint.
- App tests: authenticated/signed boundary, cancellation propagation, existing playback generation guards and tutoring regressions.
- Web cache tests: signed reads, publication order, failed manifest write and corrupt/missing S4 assets.
- Whole-workspace cold typecheck, affected ESLint, voice egress/store separation/fail-closed checks.

## Official references (checked 2026-09-28)

- https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4
- https://elevenlabs.io/docs/api-reference/text-to-dialogue/stream
- https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps
- https://elevenlabs.io/docs/api-reference/voices/get
- https://elevenlabs.io/pricing/api
