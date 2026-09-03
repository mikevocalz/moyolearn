# Natalie, human — Prompt 6 pass, evidence and device gate (2026-09-03)

SOT-KEYWORDS: natalie human prompt 6 walkthrough before after device gate weight shift preload a2f duo

Branch: `feat/natalie-human` (worktree `/Users/mikevocalz/MoyoLearn-natalie`), on top of `overhaul/phase1-audit` at `c519c05`.

## Before (recorded first, untouched code)

- `audit/motion/before/take1-first-40s-540p.mp4` · `take1-contact-sheet.png` — Duo `913949703467`, 15:40–15:42:45, a resumed "Equation sense" session. The 2D mark for the whole take under a "Speaking" badge: she never arrived (the peer session's `c519c05` fix).
- `audit/motion/before/duo-3d-live-1543.png` — the 3D body live at 15:43 after the fix landed on the phone: straight-on, arms down, gaze locked.
- What moved in that build, read off the writer against the measured rig: eyes (morphs), blink, mouth (morphs), shoulder z twitch, DEF-spine/.001 tilt, arm beats while speaking, finger sine on the splay axis. Head, neck, chest, jaw, pelvis: nothing (`presence/rig-axes.test.ts`).

## What changed (all Node-tested; typecheck green in avatar, voice, app, ui, web)

| Bar (Prompt 6 §6) | Where it is held |
|---|---|
| stillness < 2 s | `idle/engine.test.ts` "is never still" — 180 s, asserted |
| weight shift 8–20 s, irregular | asserted, CV > 0.15 |
| fingers 2–5°, none in phase | asserted, |r| < 0.5 over 10 min |
| gaze breaks, no stare > 4 s | asserted |
| state-change blend 0.4–0.8 s | torso turn 0.8 s ease; emotion 0.4 s; beat retraction; reveal 320 ms |
| listening latency ≤ 400 ms | keystroke → `tutor-cues.ts` → next frame (≤ 16 ms); recorder open → same |
| audio↔face ≤ 40 ms | frames on `AudioContext.currentTime`; **per-route output offset not yet applied — measure on device** |
| cold-start blank frames 0 | 2D mark frame 1, loader line; unchanged gate |
| warm start → 3D | preload from the learner shell; **residual (renderer init + Dawn pipelines) to measure — dev log `[natalie-stage] first frame N ms after mount`** |
| golden fixtures per channel | `engine.test.ts` channel envelopes cover all 33; body layer on its own PRNG stream so head goldens are unchanged |
| reduced motion | `humano.test.ts`, `reduced-motion.test.ts` |
| frame budget | **to measure** — expect +30 `pose()` and one spring per frame |

## After — device gate (NOT yet run; the phone belonged to the peer session)

Run from this worktree so the peer's Metro is untouched:

```
cd /Users/mikevocalz/MoyoLearn-natalie/apps/mobile
adb -s 913949703467 reverse tcp:8082 tcp:8082
npx expo start --dev-client --port 8082
# on the phone: open moyo://expo-development-client/?url=http://localhost:8082
```

Then, same seed (12345), same session, same device:

1. Enter the learner shell; wait 5 s (preload). Open Talk to Natalie. Read `[natalie-preload] parsed in N ms` and `[natalie-stage] first frame N ms after mount` off the Metro terminal. Record both here.
2. Record 60 s idle with `screen-recording-start` (`trimStatic:false`). Expect: a weight shift within 20 s, the head turning with gaze breaks, fingers alive, no two-second stillness.
3. Type slowly for 5 s without sending: expect a nod within 4 s (listening). Send: expect a torso turn within 1 s, then the anticipation breath ~0.3 s before the first word.
4. Speak a turn: beats with hand lag; face emotes with the tone (2D and 3D).
5. Toggle Reduce Motion: body still, mouth and blink alive.
6. Airplane mode at launch: 2D mark + loader line, then `settled-2d` with `assets-unavailable`/`context-lost` in the log; no error at the child.
7. Frame time: `adb shell dumpsys gfxinfo com.moyolearn.app` before/after for the jank percentile.

Fill in `audit/motion/critique-after.md` with the same rubric as `critique-before.md`, and put the after video beside the before one.

## Not done, and why

- Layer A mocap loops — Mixamo needs an Adobe login and Blender; ADR-113 §Layer A.
- The A2F GPU host — cannot be stood up from this session; ADR-112 §Blocked. The whole path is wired and tested behind `AUDIO2FACE_URL`.
- The per-route audio output offset; the A/V offset measurer — device tools, blocked on the phone.
- The model asset is untouched, per Mike's instruction to the peer session.
