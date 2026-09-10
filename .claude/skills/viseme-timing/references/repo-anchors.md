# Installed symbols this skill names

Every API the skill tells you to call, verified by grep against this working tree on 2026-09-10 (branch `fix/natalie-conversational-presence`). Re-verify before citing in a PR; line numbers drift.

## `@acme/voice` — `packages/voice`

| Symbol | File:line | Notes |
|---|---|---|
| `createVoiceEgress`, `voiceEgress` | `src/eleven.ts:50` (barrel `index.ts:50`) | The sole ElevenLabs egress. `tooling/check-voice-egress.mjs` enforces it. |
| `SpeakSentenceInput` | `src/eleven.ts:76` | Fields: `learnerId`, `band`, `tone`, `text`, `previousText?`, `signal?`. **No language field exists.** |
| `SpokenSentence` | `src/eleven.ts:51` | `audio` \| `performance` \| `text-only`. |
| `BakedAlignment` | `src/eleven.ts:69` | `characters: readonly string[]`, `character_start_times_seconds: readonly number[]`, `character_end_times_seconds: readonly number[]`. This is the only alignment shape the repo already parses. |
| `BakedClip` | `src/eleven.ts:75` | `{ kind: 'audio', contentType, bytes, alignment }` \| `{ kind: 'text-only' }`. |
| `LIVE_MODEL_ID` = `'eleven_flash_v2_5'` | `src/registry.ts:41` | |
| `BAKED_MODEL_ID` = `'eleven_v3'` | `src/registry.ts:42` | |
| `voiceRegistry()` | `src/registry.ts:58` | Returns `null` when `ELEVENLABS_VOICE_ID` is unset. |
| `voiceSettingsFor(tone, band)` | `src/tones.ts` | Tone recipe × band modulation → `{ stability, style, speed }`. Any change here is a voice change and re-triggers this skill. |

### Endpoints actually called

| Path | File:line | Timestamps? |
|---|---|---|
| `POST {API_BASE}/v1/text-to-speech/{voiceId}/stream?output_format=mp3_44100_64` | `src/eleven.ts:156` | **No.** |
| `POST {API_BASE}/v1/text-to-speech/{voiceId}/with-timestamps?output_format=mp3_44100_128` | `src/eleven.ts:237` | Yes, baked path only. |

`API_BASE = 'https://api.elevenlabs.io'` — `src/eleven.ts:35`.

**`stream-with-timestamps` is not called anywhere in this repository.** Moving the live path onto it is new work, not a config change: the response is a JSON-per-chunk stream carrying base64 audio plus alignment, where `/stream` returns raw audio bytes, so `speakSentence`'s `ReadableStream<Uint8Array>` return arm changes shape. Read the endpoint reference before writing the client.

## `@acme/avatar` — `packages/avatar`

Barrel: `packages/avatar/index.ts`. Renderer-dependent symbols are behind `@acme/avatar/body` (`packages/avatar/src/body-index.ts`).

| Symbol | File:line | Notes |
|---|---|---|
| `Shape` = `Record<string, number>` | `src/speech/track.ts:25` | Named ARKit-style weights. |
| `Track` = `[number, Shape][]` | `src/speech/track.ts:28` | The viseme schedule type. Time-ordered, seconds. |
| `sampleTrack(track, t, idx)` | `src/speech/track.ts:51` | Keyframe advance + smoothstep. `idx` is carried by the caller. |
| `SpeechSample` | `src/speech/track.ts:38` | `{ shape, active, gap }`. |
| `ArkitMapper`, `ArkitMap` | `src/speech/track.ts:88,100` | 19×N matrix for the authoring container. |
| `ONSET_LEAD_MS` = `300` | `src/speech/driver.ts:30` | Scheduling lead in ms. Schedule t=0 is the audible onset. |
| `createSpeechDriver(backend, wallClock?)` | `src/speech/driver.ts:68` | |
| `AudioBackend` | `src/speech/driver.ts:38` | `now()`, `decode(ArrayBuffer)`, `play(utterance, when)`, `stop()`. |
| `evenTrack(text, durationSeconds)` | `src/speech/driver.ts:192` | **The letter-rule fallback. Do not ship it as a production path.** |
| `analyseSpeech(samples, sampleRate)` | `src/speech/audio-shapes.ts:63` | Energy + ZCR → `Track` of `{ open, spread }`. Not phonemes. |
| `createAudioApiBackend(context)` | `src/speech/backend-audio-api.ts` | `react-native-audio-api` / browser AudioContext. |
| `directEncoder`, `matrixEncoder`, `encoderForContainer` | `src/speech/encoder.ts` | Named weights → the head's expression vector. |
| `idleConfig.speech` = `{ gapWeightSum: 0.05, releaseMs: 250 }` | `src/idle/config.ts:116` | The mouth's gap threshold and release ramp. |

### `analyseSpeech` constants (`src/speech/audio-shapes.ts`)

| Constant | Value | Line |
|---|---|---|
| `FPS` | 60 | 31 |
| `SILENCE` | 0.02 | 37 |
| `ZCR_VOWEL` | 1500 | 43 |
| `ZCR_SIBILANT` | 5000 | 44 |
| `GAMMA` | 0.62 | 51 |

Normalization is against the utterance's own 95th-percentile energy, not full scale (`src/speech/audio-shapes.ts:102`).

## `@acme/avatar/body` — the rig-facing mouth

| Symbol | File:line | Notes |
|---|---|---|
| `LipShape` | `src/presence/humano.ts:184` | **Nine** fields: `jawOpen`, `mouthClose`, `mouthSmileLeft/Right`, `mouthFunnel`, `mouthLowerDownLeft/Right`, `mouthUpperUpLeft/Right`. Nine of the asset's 52 — a limit of the openness path, not the rig. |
| `LIP_ZERO` | `src/presence/humano.ts:196` | |
| `lipFromOpenness(openness)` | `src/presence/humano.ts:218` | One scalar → the nine morphs, fixed ratios. |
| `gazeMorphs(yaw, pitch)` | `src/presence/humano.ts:234` | Eight ARKit eye-look weights. |
| `GAZE_RANGE_DEG` = `15` | `src/presence/humano.ts:175` | |
| `HumanoInput.face?: Shape \| null` | `src/presence/humano.ts` | A full A2F face for the frame; replaces the openness mouth when present. |

**Drift found 2026-09-10:** the docstring above `LipShape` says "twelve mouth morphs"; the interface declares nine. Fix the comment or the interface.

`packages/avatar/rig-manifest.json` records **52 ARKit morph targets on both shipped assets**, identical lists, `skeletonsAgree: true` — including `mouthPucker`, `mouthPressLeft/Right`, `mouthRollUpper/Lower`, `mouthStretchLeft/Right` and `tongueOut`. Those are reachable through `HumanoInput.face` (written by name at `src/presence/humano.ts:739`) and unreachable through `HumanoInput.mouth`. Route the viseme track through `face`.

## Client scheduling — `packages/app/features/tutor/tutor-audio.ts`

| Behaviour | Line |
|---|---|
| Playback position = `audio.currentTime() - playbackStartAt` | 373 |
| `sampleFace()` — A2F frames interpolated on that position | 394 |
| `timeUntilOnset()` — null while nothing is scheduled | 383 |
| `analyseSpeech` wrapped so a failed analysis costs the mouth, not the voice | 623 |
| First sentence of a turn uses `ONSET_LEAD_MS`, the rest use the band's sentence pause | 641 |
| `lipsFromAnalysis` — `{open, spread}` → `jawOpen`, `mouthStretchLeft/Right` | 693 |

`lipsFromAnalysis` writes `mouthStretchLeft`/`mouthStretchRight`, which are not in `LipShape` but ARE on both assets. They reach the mesh only on the route that writes by name; verify the route (`face` vs `mouth`) before concluding a channel is unreachable.

## Not installed

Verified absent from `pnpm-lock.yaml` and from `PATH` on 2026-09-10:

- No G2P package of any kind.
- No CMUdict.
- No espeak-ng (binary or binding).
- No Montreal Forced Aligner.
- No per-route or per-device audio latency table, constant, or measurement anywhere in `packages/` or `apps/`.

Every one of these is a dependency the pipeline needs and does not have. Plan them as work.

## Landed 2026-09-10 — read before touching a channel name

`packages/avatar/rig-manifest.json` and the `avatar-rig-audit` skill that generates it. 52 ARKit morph targets per asset, both assets agreeing, `skeletonHash` recorded. Re-run the audit after any asset change.
