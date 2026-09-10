# Audio2Face-3D → contract

## What arrives

`FacePerformance` — `packages/voice/src/a2f.ts:31`:

```
{ fps: number
  names: readonly string[]        // blendshape names, in each frame's value order
  frames: readonly (readonly number[])[]   // frames[k][i] is names[i] at k / fps seconds
  emotion: string | null }        // what A2E read off HER voice, telemetry only
```

Validated by `isPerformance` before it is returned (`packages/voice/src/a2f.ts:113`): every frame must be exactly `names.length` wide and every value finite. Malformed means `null`, which means no face and the audio still plays.

Sampled client-side by `sampleFace()` (`packages/app/features/tutor/tutor-audio.ts:394`), linearly between frames because at 30 fps a held frame is a visible stutter, on the audio playback clock.

## Map by name. Never by index.

`names` travels in the payload precisely because the order is the host's, not a constant. The a2f.ts header says so and gives the reason:

> `names` is carried rather than assumed because the SDK's `mouthClose` deviates from ARKit (it includes jaw opening) and several shapes are always zero — the client maps by name, never by index.

An index map survives exactly until the host is redeployed with a different model variant, and then produces a face that moves and is not the face you asked for, with no error anywhere.

## The deviations

| Deviation | Handling |
|---|---|
| `mouthClose` includes jaw opening | Do not write A2F's `mouthClose` straight to the contract's `mouthClose`. Subtract the jaw component, or gate the write on `jawOpen` being below the closure ceiling, then verify with the bilabial case in `viseme-timing`'s test set. Measure the relationship on real output before choosing which — do not assume a coefficient. |
| Several ARKit shapes are always zero from A2F | Expect zeros on tongue and on the shapes A2F does not drive. A zero is a real value; do not fall back to another producer for that channel, because that reintroduces two writers. |
| A2F does not animate head, eyes, or (fully) tongue | `GAZE` and `BLINK` stay with their own owners. There is no contention here, only a boundary: never let an A2F frame write an `eyeLook*` or `eyeBlink*` channel even if the host starts emitting one. |

Sources for all three: `packages/voice/src/a2f.ts` header, and `docs/pack/32-tutor-voice-tone.md` §1 citing the A2F-3D microservice docs.

## Per-channel gain and limit

Apply in this order, per frame, per channel:

1. **Name lookup.** A2F name → contract channel. Unmapped names are dropped and counted; a rising drop count means the host changed.
2. **Gain.** A per-channel scalar, default 1.0.
3. **Limit.** Clamp to the channel's contract `range`.
4. **Ownership check.** If the channel's owner is not `speech`, the frame does not get to write it. Assert rather than clamp — an A2F frame carrying a brow value means the host is running a model this contract was not written for, and silently discarding it hides that.

The gain table is per deployment, because it depends on the model variant (regression v2.3 vs diffusion v3.0) and on how the head was rebaked. Record it beside the host's model version. Do not carry gains from one variant to another.

Where to measure gains: run the fixed test set through the host, then score the mouth against `viseme-timing`'s behaviour assertions. A gain that makes bilabials close and sibilants not gape is correct for that head; a gain copied from a sample project is not.

## Emotion is telemetry, not a control

`FacePerformance.emotion` is what Audio2Emotion read off Natalie's synthetic voice. The face already carries it — A2F was called with the tone's explicit emotion in the request headers (`x-a2f-emotion`, `x-a2f-emotion-intensity`, `packages/voice/src/a2f.ts:71`), per doc 32 §3's "specified, never inferred-only, so face and voice cannot disagree".

Do not feed `emotion` back into the expression layer. That is a second, unsynchronised writer for channels the tone already owns, and it can disagree with the tone that produced the audio.

**A2E reads Natalie's voice only.** Never a learner's audio. Three independent things say this: doc 19's no-emotion-recognition-of-minors decision, the Audio2Emotion licence term, and `tooling/check-voice-egress.mjs` rule 3's import fence. None of them is redundant.

## Failure

Every A2F failure is "no face", never "no voice" (`renderFace` returns `null` on unconfigured, timeout, non-2xx, or malformed, and never throws — `packages/voice/src/a2f.ts:104`). `A2F_TIMEOUT_MS = 2500` (`packages/voice/src/a2f.ts:66`) is the hard bound that stops a hung host costing the child the sentence.

The fallback is the viseme schedule, then the energy-analysis mouth. Both are mouth-only; the upper face falls back to the tone's expression alone, which is correct — a missing A2F frame should not also cost the brows.

Log which tier ran. A silent downgrade is how "her face looks wrong" becomes unreproducible.

## Sources

Audio2Face-3D SDK <https://github.com/NVIDIA/Audio2Face-3D-SDK> · ARKit `BlendShapeLocation` <https://developer.apple.com/documentation/arkit/arfaceanchor/blendshapelocation> · repo: `packages/voice/src/a2f.ts`, `packages/app/features/tutor/tutor-audio.ts`, `docs/pack/32-tutor-voice-tone.md` §1, §3, `docs/decisions/adr-112-live-audio2face.md`
