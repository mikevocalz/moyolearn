# Hands input handoff

Date: 2026-11-14. Status: design proposal for qualification, not shipped input or a device acceptance report. Preserve `expo-horizon-core`, orientation and established app window dimensions. Scene metres are independent of the app window contract.

## Learner interaction brief

No child reach, fatigue or pinch study was conducted. The brief uses the build prompt's required bands and existing Moyo target tokens. Small-hand reliability, sustained reach and tremor tolerance are hypotheses to test on device; no age-dependent physical measurements are invented.

K–2 needs the existing largest targets, short spoken instruction and an easily skipped coach. Grades 3–5 retains large targets and explicit release feedback. Grades 6–8 and 9–12 can use denser instructions, with no reduction below the corresponding token floor. A learner can use either hand without a second hand holding a mode. Neither handedness nor voice access should be inferred from age. Test comfortably seated first, with rests between strokes; never require holding an arm raised to keep a panel open.

The default interaction is stable source ownership from press to release. Near and far input must arbitrate natively, with the current board-pointer funnel as the sole consumer. Leaving the board, loss of tracking and system gestures close a stroke cleanly. A second hand does not hijack it. Do not add required gestures beyond selection and writing for exit/recenter.

## Inspected structure references

These are iOS Mobbin MCP previews inspected in this pass, used only for 2D structure. Mobbin supplied no physical Quest hand measurements; the references do not establish XR affordance quality. Preserve Moyo's spatial kit and brand.

| Screen | Reference | Apply / reject |
| --- | --- | --- |
| Hand coach | [Slack pinch tutorial](https://mobbin.com/screens/a881bea5-c006-43e0-9d67-0eb9499fcc25) | One demonstrated gesture, short purpose line and one acknowledgment. Add Moyo's skippable maximum-three-step sequence; this screen is a phone gesture tutorial, not Quest pinch evidence. |
| Tool tray | [Apple Mail drawing tools](https://mobbin.com/screens/89d3e4d2-9d57-44b0-8dc5-158232966b8b) | Compact distinguishable tools and undo beside the canvas. Do not copy tiny phone hit areas or hidden unlabeled swatches. |
| Board | [Google Arts & Culture drawing canvas](https://mobbin.com/screens/7bec6b68-52a9-470b-9614-759d96e2fd55) | Clear separation of ink surface and tools; active pen has a visible selected treatment. Reject its large browsing color palette for the homework room. |
| Chat panel | [Google listening state](https://mobbin.com/screens/b1ede01b-db3f-432e-8df6-2c659f1e96eb) | Listening is named and mute/captions/close controls are visible. Reject the decorative waveform and disclaimer as default learner content. |
| Exit | [WHOOP exit confirmation](https://mobbin.com/screens/bf2d79da-8dc8-4b5e-8ddb-fbb92de5e0c5) | Explicit cancel/leave choice names the consequence. Do not copy its “all data saved” assertion unless confirmed by the actual board persistence contract. |

The first board result was a Slack text canvas; it was rejected as handwriting evidence and replaced with the drawing reference above. No reference images were downloaded or embedded; canonical links are retained.

## Installed geometry and token seams

`packages/ui/xr/spatial-tokens.ts` owns `spatialSpacing`, `spatialDistance`, `spatialType`, `spatialTarget`, `minHitSize`, and board/tray sizing. `spatialTarget` uses a 4° ray floor, a 1.25 hand multiplier, and `targets` ratios from `packages/theme/tokens.ts`. Reuse those calculations, not a second size table in feature code. The following are derived examples rounded for this handoff, not fresh constants or measured precision:

| Band | 2D target token | Hand minimum at existing 1.5m reference | Hand minimum at proposed 0.6m qualification distance |
| --- | --- | --- | --- |
| K–2 / young | 72 | 0.2143m | 0.0857m |
| 3–5 / child | 56 | 0.1667m | 0.0667m |
| 6–8 / teen | 48 | 0.1429m | 0.0571m |
| 9–12 / adult | 44 | 0.1310m | 0.0524m |

Compute each using `minHitSize(actualDistance, true, band)` in code; do not hardcode these rounded values. `spatialSpacing.xs` is 0.025m and existing board tray has two rows of four. `spatialType.body` is 0.055–0.075m at its reference composition; arbitrary scaling near the hand must also verify text fit and legibility, not only hit targets. `board-layout.ts:layoutBoard` reports fit rather than shrinking target floors.

Reach conflict to resolve on device: existing `spatialDistance.board` is 1.5m, while the build prompt asks every target inside two feet (0.6096m). Existing `nearInteraction` is 0.45–0.8m. Those values do not establish a seated near layout. Do not claim a 1.5m board is touch-reachable, silently rescale the scene, or alter the application window to make it fit. Qualify a near placement using actual seated head/hand pose, view cone, tray fit and all four bands; 0.6m above is a design calculation only. Shorter reach may require placement customization rather than smaller targets. Maintain a ray option when a surface is beyond comfortable reach.

## Proposed native hysteresis for qualification

These values are initial experiments, not approved defaults, platform recommendations or measured behavior. Native owner must confirm installed input units and signed board coordinates before implementation; no new bridge API is asserted here.

| Parameter | Initial experiment | Release/ownership rule |
| --- | --- | --- |
| Far pinch strength | Down at ≥0.75; up at ≤0.55 on normalized 0–1 aim strength | Ignore stale/invalid samples. Intermediate values retain current state. Compare device traces to the current single 0.7 cutoff. |
| Direct touch plane | Define signed normal distance as positive in front of paper; down on crossing to ≤0m inside paper bounds | Up after retreat to ≥0.012m. No contact starts from a stale or invalid sample. Validate sign after world/local transform. |
| Safety depth | Candidate cutoff 0.02m behind paper | Close stroke if beyond safe depth or outside paper; require a new front-to-plane crossing. Depth is not pressure. |
| Near/far zone | Candidate enter ≤0.05m in front of an interactive surface; leave ≥0.08m | Evaluate true surface bounds; near owns that hand while in its captured interaction. No ray click from the same sample. |
| Poke action | Press/release edges, once per crossing | No repeat while held, no auto-fire on regained tracking; require fresh release before a new press. |

No debounce timer or multi-frame JS queue is specified as a substitute for hysteresis. Preserve existing one-source board ownership. Handle FB system-gesture status before app input; close any owned stroke and suppress app presses until fresh valid input resumes. Prioritize validated `poke_ext` when actually bound and supported; otherwise a valid index-tip joint. Runtime capability is authoritative, Meta extensions optional, PICO fallback retained.

Qualification must record raw valid strength/distance traces, accidental press/release counts, tracking loss and continuous-stroke evidence across all required bands or clearly state which bands were untested. Until those numbers and device captures exist, these thresholds must remain labeled unqualified. No tracking-frequency increase is justified without measured improvement.

## States and copy

| State | Visible treatment / copy |
| --- | --- |
| Hover | Stable fingertip cursor or ray reticle on the intended target; outline plus label rather than color alone. No press animation yet. |
| Pressed | Existing selected/pressed token treatment and clear contact feedback; finish tool action once on the existing edge contract. |
| Selected tool | Tool name plus selected outline; retain when hand tracking drops. Color names accompany ink swatches. |
| Disabled | Preserve label and visible disabled treatment; no app action. Undo without history stays disabled. |
| Tracking lost | Close open stroke, remove stale cursor, “Hands aren’t visible. Move them into view.” No stuck ink or auto-press on recovery. |
| Voice listening | “Listening…” with visible stop action; captions remain available after playback. |
| Clear confirmation | “Clear this page?” / “Keep drawing” / “Clear page”. Name only the content actually cleared. Never clear on the first tray press. |
| Exit confirmation, if needed by actual persistence state | “Leave the Tutor Room?” / “Keep working” / “Leave room”. Describe unsaved work only when the application knows it exists. |

At most three coach steps, once per learner after completion/skip. Persist a learner-scoped completion version through the existing persistence boundary; state uses Zustand, native handles refs. A local device-wide flag must not suppress coaching for another learner. Each step offers “Skip”; finish offers “Start”. Reopen through help, not forced replay on resume.

| Band | Step 1 | Step 2 | Step 3 |
| --- | --- | --- | --- |
| K–2 | “Pinch to pick a button.” | “Touch the paper to write.” | “Pick a tool on the tray.” |
| 3–5 | “Point and pinch to choose.” | “Touch the board to write. Lift your finger to stop.” | “Pinch a tool to change it.” |
| 6–8 | “Aim your hand and pinch to select.” | “Touch the board with your fingertip to write.” | “Select a tool on the tray.” |
| 9–12 | “Aim and pinch to select.” | “Touch the board to write; lift away to end the stroke.” | “Use the tray to change tools.” |

Gate step 2 behind actual direct-touch capability and qualification. If the shipped path is ray-only, replace it with “Pinch and hold to write. Release to stop.” and plainly label direct touch unavailable; do not coach an unimplemented gesture. General room copy should say “Select” or “Use your hand” only where verified; do not blindly replace hardware-specific troubleshooting text needed by controller users.

## Accessibility and action parity

All actions must have a single-hand path, with symmetric left/right behavior. Avoid two-hand confirmation or mandatory wrist rotation. Preserve larger band targets and hysteresis; test tremor and nonstandard reach rather than adding a diagnosis-dependent mode. Allow rests without losing tool/session state. No status conveyed only by audio, color or a cursor animation. Captions remain readable without covering the board.

Voice alternative acceptance matrix: pen, highlighter, eraser, each ink, undo, clear with explicit confirmation, voice stop/start, recenter and exit. This is required functionality to verify, not a claim the voice command grammar currently supports these commands. Hand-accessible “Ask Natalie” must be tested with audible reply and captions. If microphone permission is denied or voice unavailable, all actions still have hand controls. No voice command should bypass clear/exit confirmation.

Native input discovery/measurement and on-device large-text/comfort checks remain pending. Test cold launch with controllers off/unpaired, each hand alone, system gesture mid-stroke, hand loss, off-paper exit, second-hand contention, recenter/exit/re-entry and sleep. Record actual frame pacing and a full run video. Re-run PICO controller input. No physical capture was available for a design critique, so no fixes from a headset critique are claimed.

## Procedure and skill gaps

Read `expo-design-system`, Mobbin `best-practices`/`search`, existing spatial tokens and board layout, and the tailored foldable skill in full from `/Users/mikevocalz/viro-external/.agents/skills/mikevocalz-foldable-layouts/SKILL.md`; required blob hash matches `69a051ad0a924f778ed54f9222fe8af0c5eef701`. Preserve the repository's installed motion layer and shared XR adapters. The named standalone research/handoff/copy/accessibility/critique/frontend skills were absent from inspected local roots; inline outputs above address their requested procedures without claiming they were loaded. The six ViroReact specialist skill sources remain a native-owner gap; this design document does not replace SDK semantics review or authorize an invented native API. No feature code, dependency changes, SDK changes, sends or deployments were made.

---

**Your Mobbin AI usage is high this month**

Usage is unlimited during beta. If your usage stays at this level, you may need to purchase more credits once limits take effect. [View usage and plan options](https://mobbin.com/settings/billing-and-usage?utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp)
