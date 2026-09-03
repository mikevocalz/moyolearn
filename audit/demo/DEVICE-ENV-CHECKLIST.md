# Device + environment checklist — demo night, Sep 3 2026

Doc 29 §8's failure-proofing list, filled in against the actual demo rig.
Every row carries evidence or it is not verified — a checked box with nothing
behind it is worse than an unchecked one, because it stops you looking.

**Demo rig:** Surface Duo, Android 14, serial `913949703467`, package
`com.moyolearn.app`. Expo **dev client** loading JS from Metro on the Mac and
calling the **local** Next dev server over `adb reverse` — not a standalone
build and not production. Everything below follows from that.

Legend: **V** verified · **NV** not verified · **N/A** not applicable tonight

---

## A. The rig

| # | Row | State | Evidence / why |
|---|---|---|---|
| A1 | Device is the Surface Duo, USB-attached, authorised | **V** | `adb devices -l` → `913949703467 device usb:1-1 product:duo model:Surface_Duo` |
| A2 | App installed and current | **V** | `dumpsys package com.moyolearn.app` → `versionName=1.0.0`, `lastUpdateTime=2026-09-02 21:24:35` |
| A3 | Metro reachable from the device | **V** | `adb reverse --list` → `tcp:8081 tcp:8081`; `files/BridgelessReactNativeDevBundle.js` written on launch |
| A4 | **API reachable from the device** | **V after fix** | `adb reverse` had **only** 8081. Added `tcp:3000`. Without it every tutor call fails silently — the phone's `API_URL` is `http://localhost:3000`. **Re-run after every reboot or cable re-seat.** |
| A5 | USB screen mirroring | **V** | Android Studio device mirroring is attached — `adb reverse --list` shows `localabstract:screen-sharing-agent-*`. QuickTime is iOS-only and does not apply. |
| A6 | Hotspot as primary network | **NV** | Not testable from here. The **Mac** needs the hotspot (it makes the Anthropic / ElevenLabs / Bunny calls); the phone only needs the USB cable. Test by disconnecting the Mac from venue wifi and re-running the smoke script. |
| A7 | Cable + dongle + charger in the bag | **NV** | Physical. The demo dies without the cable — the app cannot reach the API over wifi at all. |

## B. Device state

| # | Row | State | Evidence / why |
|---|---|---|---|
| B1 | Do Not Disturb / Focus on | **NV** | Android equivalent: Settings → Sound → Do Not Disturb. Set it by hand; not verified from here. |
| B2 | Auto-lock never | **NV** | `adb shell settings put system screen_off_timeout 1800000` (30 min — Android has no "never", and the demo is 3 min). Not set. |
| B3 | Battery Saver **off** | **NV** | `adb shell settings get global low_power`. Battery Saver throttles the JS thread and will make streaming look bad. |
| B4 | Battery ~100%, charging | **NV** | Device was on the charger during this pass (`QCOM-BATT ICL: 3000000` in logcat); level not read. |
| B5 | Media volume up | **V** | Raised to **22/25** via `cmd media_session volume --stream 3 --set 22` (was 12/25). Verify again after any reboot. |
| B6 | Brightness up | **NV** | Physical / by hand. |
| B7 | CAMERA runtime permission granted | **V after fix** | Was `granted=false`, and the capture screen rendered **black with no prompt**. Granted via `pm grant com.moyolearn.app android.permission.CAMERA`; now `granted=true`. Re-check after any reinstall. |
| B8 | RECORD_AUDIO permission granted | **V** | `dumpsys package` → `RECORD_AUDIO: granted=true` |

## C. Content

| # | Row | State | Evidence / why |
|---|---|---|---|
| C1 | Matte printed worksheet + spare | **NV** | Physical. Photographing a screen invites glare and moiré and will make the vision model look stupid (doc 29 §8). |
| C2 | One known-good problem, rehearsed | **Partial** | The seeded session problem is `2 + 3 * 4 - 1` and the tutor's refusal lands correctly: *"Order of operations problem. Which operation do you handle first here, and why?"* — a question back, no answer given. Verified on the Duo tonight. |
| C3 | Pre-recorded capture one tap away | **NV** | Not found on the device. Record the full flow tonight and put it on the home screen — with the OCR blocker below unresolved this is the fallback that saves step 3. |
| C4 | Learner profile pre-seeded so progress is not empty | **NV** | Not checked this pass. |

## D. Voice

| # | Row | State | Evidence / why |
|---|---|---|---|
| D1 | `ELEVENLABS_VOICE_ID` present on the exact env | **V** | `vercel env ls` (project `moyo-app`, scope `mikefacesnys-projects`) lists it on **Production**. `vercel env pull --environment=production` returns a non-empty **20-character** value (not printed). So `packages/voice/src/registry.ts:voiceRegistry()` does not return `null` in production. Locally it resolves from `.env`/`.env.local` the same way. |
| D2 | `ELEVENLABS_API_KEY` present on the exact env | **V (presence only)** | Listed on **Production** by `vercel env ls`. The value is decrypt-blocked on pull (marked sensitive), so presence is the strongest evidence available without a request. |
| D3 | One sentence audible end to end | **V (server-verified), NV (ear)** | `POST /api/tutor/voice 200` twice on the first turn (869 ms, 1010 ms) and twice on the second (403 ms, 407 ms) — 200 means an `audio/mpeg` stream, not the 204 text-only degradation. The ledger then recorded **79 characters / $0.008690**, which only happens on the dispatch path. **Nobody has put an ear to it — do that once before you walk up.** |
| D4 | Durable voice ledger installed in production | **V** | Not the in-memory fallback. `apps/web/lib/voice.ts` calls `installVoiceBudgetLedger(durableVoiceBudgetLedger())` at module scope and `/api/tutor/voice/route.ts` imports it; the proof is the data — `edu.inference_budget` holds `voice_chars=79, voice_usd=0.008690` for `dev-learner-1` on `2026-09-03`, and 79 × `FLASH_USD_PER_CHAR` (0.00011) = 0.00869 exactly. The fallback's `no durable voice budget ledger installed` line would mean a per-lambda counter; it is not what is running. |
| D5 | Demo learner's voice budget reset | **V, and re-do it tomorrow** | Read: `dev-learner-1` had **no row** for Sep 2/3 UTC at the start (zero spent); the reset `update` matched zero rows. Tonight's two rehearsal turns then spent **$0.008690 of the $0.80** `9-12` ceiling (1.1%; ~7,190 characters left). **The UTC day key means Sep 3 daytime rehearsals share the demo's budget, rolling over at 20:00 ET.** Re-run the reset in `qa/walkthroughs/DEMO-SMOKE-2026-09-03.md` right before you go on. |
| D6 | Do not rehearse on the demo learner | **Cannot be honoured as written** | `MOCK_CTX.learnerId` is hard-coded `dev-learner-1` (`packages/app/core/protected-operation.ts:144`), so in mock auth every rehearsal is the demo learner. The mitigation is the reset above, not a throwaway account. |

## E. Server / env

| # | Row | State | Evidence / why |
|---|---|---|---|
| E1 | Next dev server up on :3000 | **V** | `next-server (v16.3.3)`, Turbopack, `✓ Ready` |
| E2 | Metro up on :8081 | **V** | `expo start --clear --port 8081` |
| E3 | **`NEXT_PUBLIC_AUTH_MODE=mock` set for the server** | **V after fix** | Was **absent**. Only `EXPO_PUBLIC_AUTH_MODE=mock` was set, so `isMockAuth()` (`packages/app/core/protected-operation.ts:212`, which compares `NEXT_PUBLIC_AUTH_MODE`) was false and every tutor route answered **401 Unauthenticated** — verified from the device runtime. Added to `.env` (untracked) and documented in `.env.example` (committed). Server log now prints `"authMode":"mock"`. |
| E4 | Routes warm before you go on | **NV** | Turbopack compiles each route on first hit. First `/api/tutor/session` took 2.7 s vs 0.9 s warm. Run the smoke script twice; the second pass is the real one. |
| E5 | Baked voice pieces cached on Bunny | **V** | `pnpm --filter web voice:bake` → `0 rendered, 8 already cached, 0 failed` — all of `s4-young`, `s4-older`, `greeting-first`, `greeting-return`, `celebrate-big`, `marketing-hint`, `marketing-explain`, `marketing-got-it` at `BAKED_VERSION 3`. Every signed CDN URL returns `206 … content-type: audio/mpeg`. The S4 crisis pieces are therefore servable (they are never live-rendered). |
| E6 | Marketing baked route returns 200 + CORS | **Fixed in repo, NOT LIVE** | In production all eight pieces returned **307 → `/login`**, with no CORS headers at all: `apps/web/proxy.ts` `PUBLIC_PATHS` omitted `/api/marketing`, so an anonymous route was behind the session gate and Natalie was silent on www.moyolearn.com. Added `/api/marketing`. Verified against the same code path locally: all eight → `200` with `access-control-allow-origin`. **This needs a deploy of `moyo-app` to take effect, and after the deploy re-check that `MARKETING_ORIGIN` resolves to the www origin rather than `*`.** Not on the Duo demo path. |

## F. Stalls

| # | Row | State | Evidence / why |
|---|---|---|---|
| F1 | Coach SSE has a client timeout with a graceful line | **V after fix** | `streamFetch` had no `signal`, so a dropped connection left the promise pending forever and the stage sat on `Thinking`. Added `COACH_RESPONSE_TIMEOUT_MS` (12 s to headers) and `COACH_STALL_TIMEOUT_MS` (15 s, re-armed per frame) in `packages/app/features/tutor/tutor-constants.ts`, wired through an `AbortController` in `tutor.store.ts:coach`. An abort lands in the existing `catch` → `{ kind: 'retry' }` → *"I couldn't reach Natalie just then. Your work is saved."* + Try again (`packages/ui/TutorStage.tsx`). `react-native-nitro-fetch@1.6.2` honours `init.signal` on the streaming path. |
| F2 | Voice fetch has a client timeout | **NOT APPLIED — owned elsewhere** | `packages/app/features/tutor/tutor-audio.ts:110` still calls `fetch` with no `signal`. A hung POST leaves `isPlaying` true and every later sentence of the turn queued behind it: silence for the rest of the turn, which is exactly what the 204 text-only contract exists to prevent. `VOICE_SENTENCE_TIMEOUT_MS = 8_000` is exported from `tutor-constants.ts` and ready to import — the file belongs to the audio-pipelining agent and was left untouched. |

## G. Not applicable tonight

| # | Row | Why |
|---|---|---|
| G1 | iOS audio session set before any `AudioContext` | **N/A** — demoing on the Duo. `packages/avatar/src/speech/backend-audio-api.ts` is the iOS concern; deferred to another day, and not a risk for this demo. |
| G2 | Safari / mobile-web `AudioContext` gesture unlock | **N/A** — the demo is the native Android build, not mobile Safari. |
| G3 | TestFlight QR on screen | **N/A** — TestFlight is iOS. The Android equivalent for collecting testers is an internal-testing link or an EAS `preview` build QR; neither exists yet, and the demo build is a Metro dev client that cannot be handed to anyone. **If the ask is "20 testers before I leave", something installable has to exist — this is the biggest gap that is not a bug.** |
| G4 | Sign in with Apple beside Google | **N/A** — no iOS surface tonight, and the demo runs in mock auth. |

---

## Sign-off

Build: dev client on Metro, JS from `overhaul/phase1-audit` ·
Date: 2026-09-02 (evening, for the Sep 3 demo) ·
Reviewer: demo-path verification pass

**Blocking rows open:**
1. **C3 / step 3** — on-device OCR never becomes ready (see the report). Until it does, the pre-recorded capture is not a nicety, it is the plan.
2. **F2** — the voice fetch still has no timeout.
3. **E6** — the marketing CORS fix is committed but not deployed.
