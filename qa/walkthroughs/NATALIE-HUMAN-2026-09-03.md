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

## After — first device runs (16:13–16:35 EDT), what they found, what they fixed

Run from the main tree checked out at the branch's commits, on Metro 8081 (the dev launcher ignored the 8082 deep link).

| Time | Build | Seen on the Duo | Cause | Fix (commit) |
|---|---|---|---|---|
| 16:13 | 742074d | preload parsed 2474 ms; first frame 5283 ms after mount (one remount in between); she turns her head — and her **eyeballs sit outside the sockets** ("eyelids missing skin") | the eyeballs, teeth and both arms hang off the CONTROL chain (`MCH-spine.002 > spine_fk.* > ORG-spine.004-6 > ORG-face`), not the DEF chain the skin follows; turning the head skin alone left them behind | every torso/head delta mirrored as the same world rotation onto its twin, hip-root pivot offset compensated exactly; `rig-axes.test.ts` holds eyes/teeth/arm root to < 0.5 mm over 30 s (fabeb1f) |
| 16:20 | fabeb1f | eyes back in the sockets; loader line "Natalie's getting ready…" under the mark while warming; preload 2661 ms | — | — |
| 16:24 | fabeb1f | **mouth never moves while she speaks** (12-frame burst during sentence 3, all closed); head/eyes/blink alive | `analyseSpeech` emits `{open, spread}`; the 2D encoder and the 3D writer read `jawOpen`. Pre-existing on the base build, not a regression | mapped to ARKit names at the queue; real-PCM regression test (ef19517) |
| 16:24 | fabeb1f | **hands pump up and down while talking** | the beat raised the whole forearm ~50° on both sides every ~1.5 s | beats live in the wrist; one every 2–4 s; both hands rarely (c3b4655) |
| 16:25 | 4933bf9 | stage still black after the `surface-stage` token | Metro's uniwind pass had not re-processed the theme (its generated types lacked the token); needs a fresh cache | Metro restarted with a fresh cache; renderer clear made transparent (ef19517) |

Voice timing off the same runs (logcat `[voice-timing]`): first word 6.1 s after send (model-bound, unchanged), inter-sentence gaps 14–43 ms, renders 500–1300 ms, prefetch lead 9–20 s.

| 16:39 | ef19517 (fresh Metro cache) | plum stage live (pixel #43216B), eyes in sockets, preload 2565 ms, first frame 5374 ms after mount | — | — |
| 16:49 | ef19517 | **mouth opens with the voice** (16-frame burst, `after/face-burst-mouth-fixed-1649.png`); arms quiet and asymmetric; first word 5.1 s after send | — | — |
| 16:52 | 251adf0 | Mike: "she's speaking so fast" | K–2 at 0.88× with 14–47 ms between sentences | K–2 0.76×, 3–5 0.86× (palette v2); per-band breath after each full stop, 750/600/450/350 ms; dev log now reports the audible gap |

Disk filled at 16:41 (a 2700×1800 recording plus a second dependency tree); recordings and the pnpm store were pruned and the duplicate worktree removed. `~/MoyoLearn` is now ON `feat/natalie-human` (a branch, not detached); `overhaul/phase1-audit` is untouched at `c519c05`. An untracked `apps/mobile/ios/` (209 MB, a prebuild) appeared during the session and was not created by this pass.

## After — device gate (remaining)

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
