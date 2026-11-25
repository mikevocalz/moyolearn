# User research plan: hands and homework sessions with children

Date: 2026-11-25. Status: plan, not run. No participant has been recruited and no number below is a measurement. The hands handoff (`docs/design/hands-input-handoff.md`, hands line) states "No child reach, fatigue or pinch study was conducted"; the prior-work handoff (`docs/design/homework-prior-work-handoff.md`, ui line) states "No parents or children were interviewed in this pass." This plan is what replaces those sentences.

## Bands

The repo's four bands are the four `targets` keys in `packages/theme/tokens.ts:targets` (`young` 72px, `child` 56px, `teen` 48px, `adult` 44px), mirrored as `packages/ui/xr/spatial-tokens.ts:SpatialBand` and `packages/app/features/capture/age-band.ts:AgeBand`. Grade mapping is the one doc 38 FD-12 shows to parents: K–2 = `young`, 3–5 = `child`, 6–8 = `teen`, 9–12 = `adult`. The `adult` band is a 9–12 learner here, not a grown-up.

## Recruitment and consent

- 4 children per band, 16 total, plus the parent of each. Mixed handedness on purpose: at least one left-handed child per band. At least one child per band who wears glasses and one who has never worn a headset.
- Recruit through the existing process named in the prior-work handoff. No new vendor. No image retention for this study: the headset is wiped between sessions and the phone build runs against a study tenant.
- Consent is COPPA-framed. The parent signs before the session and sits in the room for every minute of it; the child gives verbal assent on tape and may stop at any point with no explanation asked. The consent form lists exactly what is recorded (hand-pose traces, screen capture, audio, moderator notes) and when it is deleted. A child under 13 never enters an email, name or password on any device in the session (doc 38 standing rule).
- Headset sessions are seated. The hands handoff already says to test seated first with rests between strokes; this plan makes seated the only posture studied for v1.

## Session length per band

| Band | Headset block | Phone block | Rests | Total |
| --- | --- | --- | --- | --- |
| young (K–2) | 8 min, split into two 4 min blocks | 5 min | 2 min between every block | 25 min |
| child (3–5) | 10 min | 6 min | 2 min | 25 min |
| teen (6–8) | 12 min | 6 min | 1 min | 25 min |
| adult (9–12) | 15 min | 6 min | 1 min | 30 min |

Any sign of discomfort ends the headset block. The moderator, not the child, removes the headset.

## What to measure

| Measure | How | Instrument |
| --- | --- | --- |
| Seated reach | Furthest board distance the child touches with the elbow still bent, measured from the head pose the renderer reports (`board-placement.ts:placeInFrontOf` is the seam the handoff names) | Native pose trace; tape measure as a backup |
| Pinch reliability | Hits, misses and double-fires on `minHitSize(d, true, band)` targets at the measured seated distance, 20 pinches per child | Raw aim-strength trace with the 0.75/0.55 experiment and the current 0.7 cutoff both logged |
| Sustained-reach fatigue | Minutes until the child drops the arm, asks to stop, or stroke accuracy drops; also the child's own 1–5 "tired arm" rating after each block | Timestamped moderator log plus the rating |
| Tremor tolerance | Stroke jitter amplitude at the paper plane for the 20 mm and 25 mm safety-depth candidates; count of strokes closed by the depth cutoff that the child did not intend to end | Signed normal-distance trace per the handoff's direct-touch table |
| Time to first undone problem (phone) | From the learner start screen to the first problem the child opens that carries no done mark | Screen capture timestamps |
| Done-mark reading | After a parent marks two problems, ask the child and the parent separately: "What does this mark mean?" Code the answer as `done-before`, `correct`, `graded`, or `other` | Verbatim transcript; the pass bar is zero `correct` or `graded` readings |

## What replaces each hypothesis in the handoff

| Handoff hypothesis (`hands-input-handoff.md`) | Study output that replaces it |
| --- | --- |
| "Small-hand reliability, sustained reach and tremor tolerance are hypotheses to test on device" | Per-band reach, pinch and tremor tables above, with device traces attached |
| 1.5 m board vs 0.6 m seated reach conflict | Measured seated reach per band, then a decision on `spatialDistance.board` vs a seated near-board token (see `design-system-diff.md`) |
| Pinch down ≥0.75 / up ≤0.55 experiment | Accidental press and release counts at those values vs the 0.7 cutoff, per band |
| 20 mm vs 25 mm safety depth | Unintended stroke-close count per band at each depth |
| K–2 "easily skipped coach" | Observed skip rate and whether a skipped child can still find the tray |
| Prior-work handoff: "Record misunderstanding of 'already done' separately from correctness judgments" | The done-mark reading table above, coded per parent and per child |

## Analysis

Observations are affinity-mapped per screen ID and per band. Anything that fails for two or more children in a band is a P1. No threshold in `design-handoff.md` leaves UNQUALIFIED status until its row here has traces from all four bands, or the row states which bands were not tested.
