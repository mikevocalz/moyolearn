# Motion spec handoff — layers, rates, amplitudes, seeds (design-handoff pass)

SOT-KEYWORDS: audit motion handoff spec layers blend times rates amplitudes seeds

**Seeds.** Stage: `createHumanoPresence(scene, { seed })` — default 12345; beats use `seed ^ 0x5eed`; the body layer uses `seed ^ 0xb0d7`. Golden harness seed is 7 (`GOLDEN_SEED`). Same seed → bit-identical 33-channel frames (`engine.test.ts` determinism).

**Per-frame stack (one pose):** idle engine channels → writer applies in bone-local frames (`rest × Δ`) → morphs cleared and rewritten (face or lips; emotion by max; blink/wide/gaze by idle) → firewall readings recorded.

| Layer | Bones / morphs | Rate | Amplitude | Blend |
|---|---|---|---|---|
| breath | DEF-spine.003/.004 x, head x, shoulders x | 0.20–0.27 Hz, 40/60 inhale/exhale | chest −6·breathY rad (~0.6°), +0.6·breathY m lift | continuous |
| sway | DEF-spine x/y position, spine z counter | two octaves 0.15 / 0.41 Hz | ±10 mm | continuous |
| weight shift | DEF-spine x position + z lean 0.96·shift; spine.001 −0.35, spine.002 −0.25, head −0.3 counter | every 8–20 s | ±22 mm, 8 % follow-through | smoothstep 1.2–2.2 s |
| torso turn | spine.002 y 0.6, chest y 0.4, head y −0.5 counter | 0.05 Hz + events 12–30 s / on send | 1.5° drift, 2–4° events | 0.8 s ease, 3–6 s hold |
| head drift / nod / follow | DEF-spine.005 / .006 x,y | drift 0.2 Hz; nod on cues | drift 0.3°, nod 4–8°, follow 35 % of gaze | nod 2×0.35 s |
| gaze | eye morphs (±15° = full), + gaze-away | saccades 0.3–2 s; away every 3–4 s | saccade box 2°/0.8°, away 4–8° | away 0.15 s ease, 0.3–1.2 s hold |
| shoulders / wrists | DEF-shoulder x, DEF-hand x | 0.12 / 0.18 Hz | 1.5° / 3° | continuous |
| fingers | DEF-{thumb,f_*}.{01,02,03} x | 0.2–0.35 Hz each | 2–5° each, 50/30/20 down the chain, on a resting curl 0.16/0.28/0.24 × finger factor | continuous |
| beats | upper arm x/z, forearm x, hand x (spring k=320 ζ=0.55), browInnerUp 0.2 | 1.15–2.25 s apart while speaking | lift 0.55–0.95 × 0.45 fwd | 35 % stroke / 65 % settle; gated by the speech envelope (τ≈0.17 s) |
| stance | upper arm x 0.05, z ±0.12; forearm x 0.11; shoulder x −0.035 | — | — | constant |
| face | all 52 morphs from A2F, else lips from openness | audio fps (30/60) | as computed | linear between frames; lips rise 22 ms / fall 60 ms |
| emotion | tone baseline (BEAT presets) | on tone change | tone intensity | 0.4 s smoothstep |
| firewall | chest pitch sum ≤ 8°, shoulder flexion ≤ 45° | — | clamp at the write | — |
| reduced motion | every body channel pinned; mouth + blink untouched | — | — | — |

**Not in this pass:** Layer A mocap loops (ADR-113 §Layer A); EMAGE content gestures; the per-route audio output offset.

## Tone → expression → gesture (design-system pass, one table)

The face column is `tutor-tone.ts` `TONE_RENDER` (BEAT category × intensity, eased 0.4 s); the A2F column is `@acme/voice` `TONE_PALETTE[*].a2f` (specified to the host); the gesture column names entries of `PERMITTED_GESTURES` (`safety/gesture-gate.ts`) — the only vocabulary a tone may draw on. Nothing here reads the child (doc 32 §4).

| Tone (lesson moment) | Face baseline | A2F emotion | Gestures allowed | Body register |
|---|---|---|---|---|
| warm-open | happiness 0.25 | joy·low | pre-speech-anticipation, beat, open-palm-offer | weight shift on entry; normal beats |
| thinking-together | neutral 0.10 | neutral | thinking-pause, beat, indicate-board | gaze averted while processing; fewer beats |
| gentle-after-miss | sadness 0.20 | concern·low | backchannel-nod, thinking-pause | slower beats (envelope ×0.7), no torso event |
| naming-the-mistake | neutral 0.15 | neutral | indicate-board, trace-shape, beat | steady; beats on stress only |
| quiet-encourage | happiness 0.20 | warmth·low | backchannel-nod, open-palm-offer | slower, smaller |
| celebrate-small | happiness 0.50 | joy·med | beat, open-palm-offer | brighter beats, one brow accent |
| celebrate-big | happiness 0.75 | joy·high | beat (both hands), open-palm-offer | two beats close together permitted |
| calm-refocus | neutral 0.10 | neutral | indicate-board, turn-yield | still torso; no beats until the redirect lands |
| safety-serious | (not on the 3D path — baked S4) | concern·med | none | calm idle |

The "Body register" column is the tuning intent for layer C and is NOT yet a code path — the writer currently scales beats by the speech envelope only. Wiring tone into beat amplitude is a `humano.ts` input (`HumanoInput.beatScale`) once Mike signs off the table.
