# Design critique — AFTER (twelve-principles rubric)

SOT-KEYWORDS: audit motion critique after twelve principles duo evidence

Same rubric, same device, same seed (12345), same session as `critique-before.md`. Evidence: `after/idle-1620-40s.mp4` (fixed-eyes idle, 16:20), `after/speaking-1649-45s.mp4` and `after/face-burst-mouth-fixed-1649.png` / `after/body-burst-wrist-beats-1649.png` (sixteen frames at 200 ms during a spoken sentence, 16:49), `after/eyes-plum-stage-1639.png`. Build `251adf0` on the Duo.

| Principle | Before | After | Evidence |
|---|---|---|---|
| Anticipation | absent | present — the first sentence is scheduled 300 ms out and the engine's breath/settle fires against it | queue `timeUntilOnset`, `anticipated` in the engine; not yet visually confirmed frame-by-frame |
| Staging | fails | passes on the ground: she separates from a plum stage instead of dissolving into ink; the mark + one line carry the wait; **framing still head-to-shoes — Mike wants waist-up and that is his call on the camera** | `eyes-plum-stage-1639.png`, `idle-contact-sheet-1620.png` |
| Follow-through & overlap | absent | present — hand trails the arm through a spring; weight shifts overshoot and settle; head trails the eyes | engine tests; `body-burst` shows small, asymmetric hand motion |
| Slow in / slow out | partial | present — torso turn 0.8 s ease, emotion 0.4 s, reveal dissolve 320 ms; beats stroke/settle | tests; visible in the speaking cut |
| Arcs | partial | partial — wrist-led beats arc; the body has no travel by design (firewall) | — |
| Secondary action | absent | present — chest breath on the deforming chain, ten finger channels, shoulders, wrists, gaze breaks with the head following | `idle-1620-40s.mp4` |
| Timing | fails | passes the numeric bar: never still > 2 s, weight shift 8–20 s irregular, fingers never in phase, gaze never held > 4 s; **voice pace was the remaining timing failure** — K–2 pulled to 0.76× and a 750 ms breath between sentences (v2 palette), which needs Mike's ear, not a test | engine tests; `[voice-timing]` |
| Solid drawing | passes | **regressed then fixed** — the head now moves, which put the eyeballs outside the sockets until the control chain was mirrored (`eyes-out-of-sockets-1616.png` → `eyes-fixed-1620.png`) | rig-axes test holds it to < 0.5 mm |
| Appeal | fails | improved — the mouth moves with the voice for the first time on the 3D path (it had read a track keyed `open`, not `jawOpen`); tone emotion reaches the 3D face; beats no longer read as a curl | `face-burst-mouth-fixed-1649.png` vs `face-burst-mouth-bug-1627.png` |

Score: 7 of 9 applicable principles present, 2 partial. Still robotic to a careful eye: no mocap resting-hand vocabulary (layer A, blocked on Mixamo), no content gestures, and a straight-on full-body framing that shows every joint at once — the waist-up view Mike described would hide the feet, which are the stillest thing on screen.

What Mike should look for on the phone: her head turning as she breaks gaze; the hip moving over the planted feet every quarter-minute; fingers that never hold; mouth open on vowels; a pause at every full stop; and whether 0.76× reads as "teacher" or "slow" to a six-year-old — that number is his.
