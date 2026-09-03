# Demo smoke — Sep 3, Expo AI Meetup NYC

A **30-second** runnable pass over the eight things the stage arc depends on
(doc 29 §8). Not a regression suite: it is the last thing you run before you
walk up, and the only question it answers is "does the demo path work on THIS
device, on THIS network, right now".

Run it twice. The second pass is the one that counts — the first warms the
route cache on the Next dev server and pulls the first ElevenLabs sentence, and
neither of those costs are representative.

## Scope

| | |
|---|---|
| Device | Surface Duo, Android 14, serial `913949703467`, package `com.moyolearn.app` |
| Build | Expo dev client on Metro (`BridgelessReactNativeDevBundle.js`) — **not** a standalone APK |
| API | `EXPO_PUBLIC_APP_URL=http://localhost:3000` over `adb reverse`, served by the Next dev server on the Mac |
| Network | Personal hotspot on the Mac (the phone reaches the API over USB, the Mac reaches Anthropic/ElevenLabs/Bunny over the hotspot) |
| Learner | `dev-learner-1` (`packages/app/core/protected-operation.ts:MOCK_CTX`), voice band `9-12`, daily voice ceiling **$0.80** |
| iOS | Not in scope. Demoing on the Duo; the iOS audio session (`packages/avatar/src/speech/backend-audio-api.ts`) is deferred. |

## Preconditions (all four, or the script is meaningless)

```sh
adb -s 913949703467 reverse tcp:8081 tcp:8081   # Metro
adb -s 913949703467 reverse tcp:3000 tcp:3000   # the API — without this every step below fails
grep -E '^(EXPO|NEXT)_PUBLIC_AUTH_MODE=' .env   # BOTH must read `mock`
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/marketing/voice/baked/marketing-hint  # 200
```

The auth-mode pair is the one that bites: only the `EXPO_PUBLIC_` half set means
the app believes it is signed in and every `/api/tutor/*` call answers 401.
See `audit/demo/DEVICE-ENV-CHECKLIST.md` row E3.

---

## The eight steps

Timings marked **[D1]** are owned by the audio-pipelining agent and are filled
in from their own measurements — see Appendix A. Leave them blank here; do not
guess them.

### 1 — Cold launch
```sh
adb -s 913949703467 shell am force-stop com.moyolearn.app
adb -s 913949703467 shell am start -n com.moyolearn.app/.MainActivity
```
**Pass:** "Hi Maya" and the three cards render.
**Watch for:** the dev-launcher "the development build crashed" card instead —
that means Metro is unreachable, not that the app is broken.

| Measure | Value |
|---|---|
| Force-stop → "Snap your homework" visible | `______ s` |

### 2 — Capture the printed worksheet
Tap **Snap your homework → Take photo**. Hold the matte print flat inside the
guided frame; press **Snap**, then **Looks good — next step**.

**Pass:** the guided frame draws, the shutter returns one page to "Review your
pages", and the camera preview is live (not black).
**Watch for:** a **black** camera screen with no permission dialog. That is the
CAMERA runtime permission being denied, and the app does not re-prompt:
```sh
adb -s 913949703467 shell dumpsys package com.moyolearn.app | grep 'permission.CAMERA: granted'
```

### 3 — OCR confirm
**Pass:** "Getting the word reader ready…" is replaced by the digitised text
review with the worksheet's text in it, and Confirm hands that text to the tutor.
**Fail (currently reproducing — see the report):** the screen stays on "Getting
the word reader ready…" and nothing lands in the app sandbox.
```sh
adb -s 913949703467 shell run-as com.moyolearn.app du -sk files   # must GROW while the reader loads
```

| Measure | Value |
|---|---|
| Confirm tap → OCR text on screen | `______ s` |

### 4 — First coaching turn
**Pass:** the badge moves `Thinking → Speaking`, text streams in word by word,
and the first sentence is spoken.
**Watch for:** the badge stuck on `Thinking` with no server-side `POST
/api/tutor/coach` line — that is the opening turn being suppressed, not a slow
model.

| Measure | Value | Source |
|---|---|---|
| Send → first token on screen | `______ ms` | Next dev log, `POST /api/tutor/coach … in Xs` |
| Send → first audible word | **[D1]** | Appendix A |
| Sentence-to-sentence gap | **[D1]** | Appendix A |

Reference from tonight's rehearsal on this device over the hotspot:
`POST /api/tutor/coach 200 in 2.5s`; `POST /api/tutor/voice 200 in 403–1010 ms`
(first call ~1 s cold, ~0.4 s warm).

### 5 — Wrong answer names the misconception
Type a deliberately wrong answer (`19` for `2 + 3 * 4 - 1`) and send.

**Pass:** Natalie names the misconception ("you worked left to right") rather
than saying "incorrect", and never states the answer.
**Watch for:** the composer refusing focus. If tapping "Type your answer" does
not raise the keyboard, check the hosted Compose field still has its floor:
```sh
adb -s 913949703467 shell dumpsys input_method | grep mInputShown   # must be true after the tap
```
A `ComposeView (…, 0.000)` in `describe` output is the known zero-height
regression (`packages/ui/Composer.tsx`, the "THE FLOOR IS LOAD-BEARING ON
ANDROID" comment). Fallback for the stage: **Record a voice message**.

### 6 — Barge-in stops audio cleanly, no orphan
While Natalie is mid-sentence, send the next message.

**Pass:** audio stops on the word, the new turn starts, and the previous turn's
remaining sentences never play — including the one that was already in flight
when you interrupted.
**Watch for:** a sentence from the *previous* turn playing over the new one a
second or two later. That is the orphan.

| Measure | Value | Source |
|---|---|---|
| Barge-in → silence | **[D1]** | Appendix A |
| Orphan sentences after barge-in | **[D1]** | Appendix A |

### 7 — Kill and resume, models resident
```sh
adb -s 913949703467 shell am force-stop com.moyolearn.app
adb -s 913949703467 shell am start -n com.moyolearn.app/.MainActivity
```
Reopen the same session.

**Pass:** the thread comes back with Natalie's last turn restored as the live
bubble above the composer — **and she does not greet you again**. The word
reader and the voice transcriber come up without a download.
**Watch for two opposite failures, both real:**
- a *second* opening turn appended on top of the resumed one (duplicate greeting);
- the badge parked on `Thinking` with the composer locked behind "Natalie is
  thinking" and no request in the server log.

| Measure | Value |
|---|---|
| `du -sk files` before kill / after relaunch | `______ K` / `______ K` (must match) |
| Relaunch → OCR ready | `______ s` (resident: sub-second) |

### 8 — Airplane mode gives a graceful line
Turn airplane mode on, send a message.

```sh
adb -s 913949703467 shell cmd connectivity airplane-mode enable
# ... run the step ...
adb -s 913949703467 shell cmd connectivity airplane-mode disable
```

**Pass:** within the stall budget the stage draws
*"I couldn't reach Natalie just then. Your work is saved."* with a **Try again**
button. Never an indefinite spinner.
**Budget** (`packages/app/features/tutor/tutor-constants.ts`):
`COACH_RESPONSE_TIMEOUT_MS = 12_000` to response headers,
`COACH_STALL_TIMEOUT_MS = 15_000` re-armed on every frame.

| Measure | Value |
|---|---|
| Send → retry line | `______ s` (must be < 13 s) |

---

## After the run

Reset the demo learner's voice budget so the rehearsal spend does not follow you
on stage. **The day key is UTC**, so a New York evening on Sep 3 shares its
budget with everything you ran that afternoon, and rolls over at 20:00 ET:

```sql
update edu.inference_budget
   set voice_chars = 0, voice_usd = 0
 where learner_id = 'dev-learner-1'
   and day >= (now() at time zone 'utc')::date;
```

---
<!-- ─────────────────────────────────────────────────────────────────────────
     APPEND BELOW THIS LINE ONLY.
     Everything above is the demo-path smoke script. The audio-pipelining
     agent owns Appendix A and appends it here; nothing above is theirs to
     edit, and nothing below is edited by anyone else.
     ───────────────────────────────────────────────────────────────────── -->

## Appendix A — audio pipelining timings (owned by the D1 agent)

**What changed:** `packages/app/features/tutor/tutor-audio.ts` used to fetch
sentence N, await its whole body, decode it, play it, and only start N+1 once
`onEnded` fired. Every sentence boundary therefore cost a full ElevenLabs round
trip of silence. The queue now renders two sentences ahead of the one playing.

### Where the numbers come from

The queue emits one `[voice-timing]` line per spoken sentence under `__DEV__`
(`tutor-audio.ts:markPlayed`). Read them off the Metro terminal — **not**
`adb logcat`; on the New Architecture `console.log` is forwarded to Metro and
never reaches the `ReactNativeJS` logcat tag.

| Field | Meaning |
|---|---|
| `firstWord` | last `audioQueue.stop()` (which `tutor.store.ts:coach` calls immediately before opening the coach stream, i.e. end of the child's turn) → `source.start(0)` of sentence 1 |
| `gap` | previous sentence's `onEnded` → this sentence's `source.start(0)` — **the audible silence** |
| `render` | fetch + decode for this sentence |
| `lead` | how long the decoded buffer sat ready before it was needed. `lead ≈ 0` means playback waited on the network; `lead ≫ 0` means the pipeline paid off |

Same device, same session, same problem (`What is 2 + 3 * 4 - 1?`), same
2-sentence coaching turns, back to back within ~12 minutes. The "before" arm is
the pre-D1 serial queue with the identical ruler compiled in, swapped in over
Fast Refresh so nothing else differed.

| Device | Surface Duo, Android 14, serial `913949703467`, `com.moyolearn.app`, Expo dev client on Metro |
|---|---|
| Network | phone → Mac over `adb reverse` (USB); Mac → Anthropic/ElevenLabs over the personal hotspot |
| Audio backend | `react-native-audio-api@0.13.3`, Android/Oboe |

### Raw runs

| Arm | Run | s1 `firstWord` | s1 `render` | s1 `lead` | **s2 `gap`** | s2 `render` | s2 `lead` |
|---|---|---|---|---|---|---|---|
| before | 1 | 2923 ms | 621 ms | 51 ms | **485 ms** | 479 ms | 6 ms |
| before | 2 | 3715 ms | 893 ms | 1 ms | **668 ms** | 664 ms | 4 ms |
| after | 1 | 4236 ms | 1179 ms | 58 ms | **7 ms** | 1127 ms | 1212 ms |
| after | 2 | 4882 ms | 1350 ms | 71 ms | **12 ms** | 1198 ms | 5119 ms |

### Inter-sentence gap — the thing D1 fixes

| Arm | p50 | max | n |
|---|---|---|---|
| before | 577 ms | 668 ms | 2 |
| after | **10 ms** | **12 ms** | 2 |

**n = 2 per arm, so no p95 is quoted.** Quoting one off two samples would be
arithmetic, not evidence. Two things capped the sample count on demo eve: the
opening coaching turn fires only once per session (`tutor-screen.tsx` opens only
when `messages` is empty), and the tree is shared with other agents whose saves
reloaded the bundle mid-run.

The mechanism is visible in the raw table without needing more runs: in the
before arm `gap ≈ render` (485≈479, 668≈664) and `lead ≈ 0` — the silence *is*
the round trip. In the after arm `gap` collapses to ~10 ms while `lead` runs to
1.2–5.1 s, i.e. the buffer was decoded and waiting long before it was needed.
Note the after runs were served by a **slower** ElevenLabs (`render` 1127–1198 ms
vs 479–664 ms; `POST /api/tutor/voice` 1097/1166 ms vs 403/407 ms in the Next
log) and still produced a smaller gap — the pipeline absorbed a worse provider,
which is the property that matters in a room on a hotspot.

**Verdict against the runbook: sentence-to-sentence gaps are inaudible.** 10 ms
is below the threshold at which a listener hears a seam at all.

### First word — target NOT met, and D1 is not what would fix it

Measured 2923 / 3715 / 4236 / 4882 ms against the runbook's ≤ 1.5 s.

`firstWord` = coach TTFT + sentence 1's render. **D1 cannot improve it**: nothing
precedes sentence 1, so there is nothing to prefetch it behind, and the
before/after difference above is provider variance, not a regression. The
dominant term is the model: `POST /api/tutor/coach 200 in 2.5s` and `3.1s` in
the same runs. Closing that means touching the prompt or the model routing,
which §8 freezes for the demo — so **plan the stage patter around ~3–5 s to the
first spoken word** rather than expecting 1.5 s. Step 4's "short client timeout
with a graceful line" is the mitigation that is actually in scope.

### Barge-in — no orphan audio

The pre-D1 guard read `isPlaying`, which is true again the moment the *next*
turn starts, so a sentence whose fetch landed after a barge-in could seize the
active source and speak over the reply that replaced it. `stop()` now bumps a
generation counter, aborts every in-flight render through its `AbortController`,
and drops the decoded-but-unplayed buffers with the queue.

Proven by `packages/app/features/tutor/tutor-audio.test.ts` (`node --test`, no
device): renders in flight are aborted; a sentence whose render resolves after
`stop()` never starts; and `stop()` → `enqueue()` → both resolve plays only the
new turn. Run it with `cd packages/app && pnpm test`.

### Chunked playback on Android — not available in 0.13.3

Checked against the installed package, not the docs:

- `core/AudioDecoder:decodeAudioData` takes `types.ts:DecodeDataInput`
  (`number | string | ArrayBuffer`) and resolves one complete `AudioBuffer`.
  There is no partial-body decode, so a sentence is the smallest unit that can
  be made audible.
- Both incremental sources want a URL they fetch themselves, and a sentence is
  not one: it is a POST carrying the signed tag that proves the server emitted
  the text (`apps/web/lib/voice-utterance.ts`), so there is no address to hand
  them. `core/StreamerNode` is additionally `@deprecated` in 0.13.3, HLS-only
  and FFmpeg-gated (`utils/flags:isFfmpegEnabled`); the
  `core/MediaElementAudioSourceNode` its deprecation note redirects to takes an
  `<Audio>` element source, not a request with a body and credentials.
- `core/AudioBufferQueueSourceNode` (`enqueueBuffer` / `clearBuffers` /
  `onBufferEnded`) **does** exist and would give gapless playback of
  already-decoded buffers — but it is mobile-only (absent from `src/web-core/`),
  and adopting it means re-cutting the per-sentence viseme seam
  (`activeTrack` / `playbackStartAt`) that drives `tutor-avatar.tsx`. Not a
  demo-eve change, and at a 10 ms measured gap it would buy nothing audible.

So D1 stops at prefetch + decode. No streaming decode was invented.

### Not verified tonight

No iPhone attached, so nothing here is claimed for iOS. `react-native-audio-api`
runs on Oboe on Android and AVFoundation on iOS; the queue itself is
platform-neutral, but the numbers above are Android-only.
