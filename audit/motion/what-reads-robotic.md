# What reads robotic — the tells, from the baseline (user-research pass)

SOT-KEYWORDS: audit motion robotic tells twelve principles baseline before video natalie duo

**Baseline evidence:** `audit/motion/before/` — take 1 (150 s, Duo, 2026-09-03 15:40, untrimmed: 2D mark for the whole take; the stage never promoted — ADR-114 §The bug) and the 15:43 still of the 3D body live (`before/duo-3d-live-1543.png`). The 3D motion itself was read from the writer's code against the measured rig (`presence/rig-axes.test.ts`), which is more exact than a video for the question "what moves": on this export, the following did not move at all.

Rubric: the twelve principles (Thomas & Johnston), applied to a *listener*, per band. Band differences are in the last column: a K–2 child forgives stillness and reads any face motion as attention; a teen reads periodicity and symmetry as "computer" within seconds.

| # | Tell | Principle violated | Root cause in code (verified) | Band sensitivity |
|---|---|---|---|---|
| 1 | The head never turns, nods or dips. Gaze morphs move the eyes in a fixed skull. | Follow-through / secondary action | Writes to `head`/`neck` control bones that deform nothing (ADR-113 §finding) | all; teen+ names it "mannequin" |
| 2 | No breath in the chest; a shoulder twitch instead. | Secondary action | Breath written to `chest` (no weight); only the shoulder `z` carried it | 6–12 |
| 3 | Weight never transfers. Continuous ±10 mm hip noise, no discrete shift, ever. | Anticipation, timing | Engine had no `weightShift`; sway went to `DEF-pelvis`, which has no weight | all — the single biggest "statue" tell |
| 4 | Hands: fingers curled by a fixed arc, and the "drift" was `sin(clock·0.7 + i·1.7)` — periodic, wall-clock, and written on the splay axis. | Timing (periodicity), appeal | Finger curl on local `z` (a fan), drift a sine | teen+, immediately |
| 5 | Both arms beat with the same envelope; the hand arrives with the arm. No overlap, no settle. | Overlapping action, follow-through | `lift` applied identically to forearm and hand | 3–5+ |
| 6 | Gaze locked on the lens except while `processing`. No breaks. | Staging (a stare) — and doc 22 §7's firewall | No gaze-away channel; head could not follow the eyes anyway (tell 1) | all; K–2 stares back |
| 7 | State changes are instantaneous: speaking → not-speaking dropped beats but nothing else changed; no re-orientation on the child's send. | Anticipation, slow-in/slow-out | `partnerPauseEvent` never fed; `partnerSpeaking` only from the mic state (cut) | 3–5+ |
| 8 | She does not listen: typing produced no attention cue. | Staging | No cue path from the composer to the writer | all — this is the one a parent notices |
| 9 | The face never emotes on the 3D path. Tone drove the 2D face bus only. | Appeal | `humano.ts` applied no emotion baseline | all |
| 10 | Mouth-only lipsync with even energy shaping; brows and cheeks dead while speaking. | Secondary action | No A2F; `analyseSpeech` is energy + spread only | 6–12 |
| 11 | Symmetric timing everywhere: left/right shoulders shared one signal via breath; blink both eyes exactly together (acceptable), beats mirrored. | Timing | One noise per pair | teen+ |
| 12 | She never arrives: a resumed session shows the 2D mark for the whole lesson. | (not a motion principle — a presence one) | `setSpeaking` from a sticky store state (fixed in `c519c05`) | all |

**What was already right and must not be lost:** the blink hazard model and its double-blinks; saccades; the asymmetric mouth smoothing; the beat's stroke/settle asymmetry and its retraction with the voice; the stance; the rule that a failure is 2D, never an error.

**Order of impact (my estimate, to be checked against the after video):** 3 → 1 → 8 → 4 → 6 → 9 → 5 → 7 → 2 → 10 → 11.
