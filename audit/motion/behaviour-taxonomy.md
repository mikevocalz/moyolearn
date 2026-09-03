# Listener / speaker behaviour taxonomy — the numbers layers A–C run on

SOT-KEYWORDS: audit motion behaviour taxonomy listener speaker weight shift nod gaze aversion finger micro-motion statistics seamless interaction

**Status of the numbers.** Meta's Seamless Interaction dataset (4,000+ h of dyadic interaction; SMPL-H body + hands at 30 Hz; CC-BY-NC 4.0, non-commercial; weights not released) is the reference the prompt names, and the rule is: **use it as a spec, never as training data** — no frames, poses or derived models ship in Moyo. This session could not run the explorer (no browser session on aidemos.meta.com), so the ranges below are from the published literature on conversational listening behaviour, with the Seamless paper cited for the vocabulary. Each range is a parameter in `idle/config.ts` (`body` block), so replacing a number with one measured from the explorer is a one-line, golden-tested change.

Paper: *Seamless Interaction: Dyadic Audiovisual Motion Modeling and Large-Scale Dataset* (Meta FAIR, 2025) — https://ai.meta.com/research/publications/seamless-interaction-dyadic-audiovisual-motion-modeling-and-large-scale-dataset/ · explorer https://www.aidemos.meta.com/seamless_interaction_dataset/explorer

| Behaviour | Range used | Source / reasoning | Config |
|---|---|---|---|
| Postural weight shift (standing) | every 8–20 s, irregular; transfer 1.2–2.2 s; hip travel ~2 cm | standing posture studies report spontaneous weight transfers on the order of tens of seconds, more frequent while listening than while speaking; the amplitude is what keeps the feet planted without a step | `body.weightShift` |
| Backchannel nod | 2–4 s timer while the partner speaks; nod 4–8°, 2 cycles of 0.35 s | already in `nod`; matches the literature's 3–5 s backchannel rate in attentive listening | `nod` |
| Gaze aversion | every 3–4 s (capped by the firewall) for 0.3–1.2 s; 4–8° yaw | mutual gaze in conversation runs ~3 s before it reads as a stare (Argyle & Cook); listeners look away less than speakers, but never hold | `body.gazeAway` |
| Head follows gaze | 35 % of the eye deflection, τ ≈ 0.35 s | eye–head coordination: the head contributes a fraction of a gaze shift and lags the saccade | `body.headFollow` |
| Torso re-orientation on a turn end | 2–4° held 3–6 s, 0.8 s ease | listener re-orients toward the speaker at turn boundaries; small, because doc 22 §7 forbids lean-in | `body.torsoTurn` |
| Shoulder / wrist tremor | 1.5° / 3° band-limited noise, independent per side | physiological postural tremor plus "not-a-plank" asymmetry | `body.shoulder`, `body.wrist` |
| Finger micro-motion | 2–5° per finger, 0.2–0.35 Hz, never in phase | resting hands are never still; two fingers sharing a rate read as a glove | `body.finger` |
| Thinking posture | gaze averted 2.5° yaw / −1.2° pitch while processing; anticipation 0.25–0.4 s before onset | already in `gaze`, `anticipation` | — |
| Speaker beats | every 1.15–2.25 s while speaking; 0.75–1.25 s bell; 35 % stroke / 65 % settle | beat gestures ride prosodic stress; the asymmetry is the retraction phase | `humano.ts` beat |
| Blink | 14–21/min, clustered at speech gaps and after saccades, 20 % doubles | already in `blink` | `blink` |

What the explorer should be used for next (someone with a browser session): the *actual* distribution of weight-shift intervals for a standing listener, listener gaze-away durations by band-equivalent age, and what hands do during a 20-second listen — the three ranges above with the widest uncertainty.
