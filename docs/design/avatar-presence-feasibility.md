# Natalie's presence — generated video vs. a driven rig

**Date:** Aug 21, 2026 · **Status:** analysis, not a decision
**Prompted by:** the GNM Head → Decart Lucy 2.5 (FAL) realtime restyle demo

Doc 02 §5.4 names the tutor-presence avatar as the learner shell's single
signature — "tab icon → session stage → future AR body". This note answers one
question about how that gets built: **should Natalie's face be generated video
at runtime, or a locally-rendered rig driven by control signals?**

Conclusion up front: **a driven rig.** Generated video fails on cost by roughly
three orders of magnitude, and it has no screening path. The GNM half of that
demo is directly useful; the Lucy half belongs in asset production, not runtime.

---

## 1. Cost — the decisive one

`decart/lucy-2-5/realtime` on FAL bills **per second of output**, at **$0.04/s**
(read from the endpoint's own billing metadata, Aug 21 2026: `billing_unit:
"seconds"`, `price: 0.04`). So one minute of generated video costs **$2.40**.

Doc 12 §7's Phase-2 load target is **~8,000 learner AI sessions/day**:

| Avatar video per session | $/session | $/day | $/month |
|---|---|---|---|
| 30 s | 1.20 | 9,600 | 288,000 |
| 1 min | 2.40 | 19,200 | 576,000 |
| 3 min | 7.20 | 57,600 | 1,728,000 |
| 5 min | 12.00 | 96,000 | 2,880,000 |

Doc 12 §7 states the system is "designed around token cost, not CPU", with a
per-learner daily inference budget as a binding control. Avatar video at even
**30 seconds a session** would dominate every other cost in the platform
combined, and 30 seconds is not a tutoring session — it is a greeting.

This is not a "revisit when cheaper" trade-off at the current price. It is three
orders of magnitude away from a product whose pricing is $11–15.99/month per
family (doc 05). One 5-minute session would cost most of a month's subscription.

## 2. Safety — there is no screening path

Doc 07's Safety Plane screens learner-facing AI output, and doc 12 §5 puts L5
screening **on the stream**, buffered by sentence window so blocking beats
rendering. That design assumes output is text.

Generated video has no equivalent. There is no sentence window to buffer, no
classifier in the routing table for frames, and the fail-closed rule ("Natalie
is taking a break") has nothing to fail closed *on* — the model is the renderer.
Shipping generated video as a learner surface would mean the one output a child
looks at most is the one output not screened.

A rig is deterministic: it renders what the app tells it to. The control signal
(a viseme stream, a blendshape track) is screenable because it is data we
produced, and the failure mode is a still face rather than an unvetted one.

## 3. Register — the brand guardrail

Doc 02, Addendum B: copy never claims Natalie has a heart, feelings, or love for
the child; she "helps you learn it by heart", she never "loves you". That line is
testable in the red-team suite.

A photoreal human face argues the opposite of that sentence every frame it is on
screen. The stylised blue GNM head in the source demo sits closer to the honest
register than the restyled output does — which is a design finding, not a
consolation prize.

## 4. What IS worth taking

The demo's control layer, not its renderer.

- **GNM-style head control** gives a rig jaw, gaze and expression handles driven
  from a signal rather than hand-animated. That is exactly the input a
  locally-rendered Natalie needs, and it is the half of the pipeline that costs
  nothing per session.
- **Lucy-class restyle belongs in production**, offline: generating a look, a
  reference sheet, or marketing material once, then baking it into textures the
  device renders for free. Cost per session becomes zero because the spend
  happened once.
- **Latency argues the same way.** Doc 12 §7 asks for AI first token < 1.5 s.
  A rig responds in a frame; a hosted video round-trip cannot.

## 5. Open questions

- Which rig runtime — the app already carries Three.js/WebGPU experience, and
  doc 02's "future AR body" implies something that survives into AR.
- Where visemes come from: the TTS provider's timing marks, or a separate
  lipsync pass. This decides whether the Safety Plane screens one stream or two.
- Whether Natalie renders at all on the Cool dial, or is a learner-only surface.

Nothing here blocks Wave 2. It is recorded so the cost question does not get
re-litigated from vibes, and so the GNM control idea is not lost with it.

## 6. Sources

FAL endpoint billing metadata for `decart/lucy-2-5/realtime` (Aug 21 2026).
Pack: doc 02 §5.4 + Addendum B, doc 05 §2, doc 07 §1, doc 12 §5 and §7.
