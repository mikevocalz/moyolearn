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

_Not yet filled in._
