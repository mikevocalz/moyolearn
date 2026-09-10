---
name: life-layer
description: The involuntary motion that makes a still avatar look alive — breathing, blinks, saccades, weight shifts, held posture changes. Use this whenever idle, listening, breathing, gaze or blink behaviour is touched, whenever someone says "she looks frozen", "she should turn a little", "she's twitchy" or "she's fidgeting", and before adding any new ambient motion. It owns which channels may move when nobody asked.
---

# Life layer

A person waiting is not still, and they are not busy either. This layer is the
difference, and it is the easiest place in the product to make Natalie look
worse: motion with no cause reads as fidgeting, and motion on a timer reads as a
tic. Both are more alarming than stillness.

## It is mostly already built

`packages/avatar/src/idle/config.ts` holds the parameters and
`packages/avatar/src/idle/engine.ts` runs them. Read those before proposing
anything — the values are chosen, not defaults, and several encode a source:

- Blinks close faster than they open. That asymmetry is the finding from
  Trutoiu et al.; a symmetric blink reads as a doll's.
- The two sway octaves sit at an irrational frequency ratio so they can never
  phase-lock into a loop a viewer starts predicting.
- Breath has an anticipation boost at speech onset, because a person fills their
  lungs slightly before they talk.

Change a number in `idleConfig` rather than adding a channel beside it. A second
source of ambient motion is how you get two systems fighting over one joint.

## Every motion has a cause

Speech timing, prosody, conversation state, or this layer's own non-repeating
noise. **A timer is not a cause.** Cooldowns may only suppress a movement —
expiry must never start one, or the behaviour is a metronome wearing a
justification.

That rule is why nods moved out of the idle engine: a nod every 2–4 seconds
during sustained typing is not acknowledgment, it is a clock. Acknowledgment
belongs to the listening state and needs a real cue.

## Bounded, owned, tier-aware

Each channel has one owner and a ceiling. Amplitudes here are millimetres and
fractions of a degree; anything a viewer can consciously see in a still frame is
too large. When a device tier cannot afford a channel, drop the channel — never
scale every channel down, which turns a person into a slow person.

## Reduced motion keeps the blinks

`packages/avatar/src/reduced-motion.ts` states the policy and its reasoning:
a face that never blinks is not calm, it is unsettling. Reduced motion pins the
procedural body channels and keeps articulation and blink timing. It is a render
mode, not a shorter duration.

## Verify by distribution, not by watching

Run `scripts/check-idle-distribution.mjs` over a generated sequence. Watching an
idle for thirty seconds cannot detect a period, and a period is the failure mode
that matters — the eye finds it at minute three and cannot unsee it.

The check asserts: blink and breath rates inside their ranges, no identical
curve inside a five-minute window, and no autocorrelation peak in thirty seconds
of idle.

## Rules

- No new ambient channel without an owner and a ceiling recorded in
  `references/channels.md`.
- No motion without a cause. Timers suppress; they do not start.
- Numbers live in `idleConfig`, never in this body and never in a literal at a
  call site.
- Reduced motion keeps articulation and blinks. Removing them is a bug, not a
  stronger setting.

## References

- `references/channels.md` — owners, ceilings, and where each value lives.
- `packages/avatar/src/idle/config.ts` · `engine.ts` · `reduced-motion.ts`
- Eyes Alive (saccade statistics) · https://dl.acm.org/doi/10.1145/566654.566629
- Trutoiu et al., eye blinks · https://la.disneyresearch.com/publication/modeling-and-animating-eye-blinks/
- Perlin & Goldberg, Improv (layered non-repeating motion) · https://dl.acm.org/doi/10.1145/237170.237258
- Audit, source of truth · `audit/motion/realism-2026-09-10.md`
