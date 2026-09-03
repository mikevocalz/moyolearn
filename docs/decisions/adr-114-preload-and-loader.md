# ADR-114 — Never blank: preload Natalie, and a designed loader for the cold path

Status: **ACCEPTED.** Date: 2026-09-03 · Decider: Mike ("never a blank screen while she loads") · Author: Prompt 6 pass

<!--
What it is: the two mechanisms that guarantee no frame of the tutor screen is
ever empty — parsing her before she is asked for, and a designed 2D loading
state for the cold path — plus the reveal, and the one bug that kept her from
ever arriving.
SOT: packages/app/features/tutor/natalie-preload.ts · packages/app/features/tutor/tutor-avatar-3d.native.tsx (`preloadNatalie`)
     packages/app/features/tutor/tutor-avatar.tsx · packages/avatar/src/tutor-stage.ts · apps/mobile/app/(learner)/_layout.tsx
     audit/motion/loader-copy.md · audit/motion/mobbin/loader.md
SOT-KEYWORDS: adr preload never blank loader frame one warm start cold start dissolve reveal 2d mark pending-swap
-->

## Decision

1. **Frame 1 is the 2D mark, always.** `tutor-stage.ts` is unchanged: 2D from
   the first frame, promote only on a real presented frame with the head
   evaluated, never mid-utterance, demote for good on any failure. This ADR
   moves work EARLIER; it does not loosen the gate.
2. **Preload.** The body's fetch, glTF parse, `.bin`, eight texture decodes
   and the Dawn material rebuild are one memoised promise
   (`preloadNatalie()` in the stage module). The learner shell starts it on
   mount — every learner tab is one tap from the tutor screen. The stage
   awaits the same promise and adopts the same scene graph; there is never a
   second parse. Behind the same flag and the same `lazy` boundary as the
   stage, so the 2D path pays nothing and a binary without the native module
   never reaches it.
3. **What preload cannot pay:** Dawn's pipeline creation on the first draw,
   which needs a live surface. The stage logs `first frame N ms after mount`
   in dev so that residual is a number on the phone, not a guess. A
   pre-warmed off-screen canvas that the tutor screen ADOPTS would remove it,
   but that needs a portal across Expo Router screens (ADR-111 lists the
   `compact` ↔ pane crossing as the same unsolved portal) — recorded here as
   the next step, not done.
4. **The loader is the mark plus a line.** While `preparing` / `warming` /
   `pending-swap`, the 2D mark carries one caption in the band's register:
   K–2 and 3–5 *"Natalie's getting ready…"*, 6–12 *"Natalie's on her way"*
   (`audit/motion/loader-copy.md`). Never a spinner, never "Loading assets".
   Progress from the CDN manifest goes in the same slot when the demo build
   takes the download path (ADR-111 §The asset) — the stage already models
   it (`showsProgress`).
5. **The reveal is a dissolve.** The canvas has been drawing her, idling,
   behind the mark since `warming`; on the swap the mark fades out over
   320 ms (under doc 23 §6's ceiling) while she fades in. She is never seen
   starting.
6. **Failure is 2D with a telemetry reason.** Unchanged; airplane mode at
   launch is the 2D path and must be in the smoke walkthrough.

## The bug that made "never arrives" the baseline

Take 1 of the before-video (150 s on the Duo) shows the 2D mark for the
whole session while the status badge says "Speaking". The peer session found
and fixed the cause in `c519c05`: a resumed session restores its last turn as
`speaking` with no audio, `audioQueue.onDrained` was the only exit, and
`trySwap` only retries on the speaking true→false edge — so the stage sat in
`pending-swap` forever, rendering into a canvas at opacity 0. `setSpeaking`
now reads `audioQueue.isSpeaking()` per frame. This ADR builds on that commit;
a prop-driven `setSpeaking` must not come back.

## Budget

| Path | Target | Measured |
|---|---|---|
| warm start (shell entered ≥ a few seconds before the tap) | 3D on the first frame the controller allows (after `minimumPresenceMs` = 900 ms and no utterance) | pending — device run blocked while the peer session owns the phone; the dev log lines are in place |
| cold start (nothing cached) | 2D mark on frame 1; 3D within a stated budget on hotspot | pending — same |
| blank frames | 0 | by construction: the mark renders on frame 1 whether or not the flag is on |

## Consequences

- Easier: one parse per process; the tutor screen's mount no longer blocks
  the JS thread on a 14 MB parse.
- Harder: the shell holds a scene graph in memory for a learner who may never
  open the tutor. It is the same memory the tutor screen would hold; it is
  held earlier. Not released on shell exit in this pass (the process is the
  learner's session).
