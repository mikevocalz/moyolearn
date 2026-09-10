# The face control contract

Machine-readable: `contract.json`. It is the source; `scripts/impossible-face.mjs` reads it directly. This file explains the decisions in it.

## Why one contract

Four producers want the same face: the speech solver (or Audio2Face), the emotion layer, procedural blink, and gaze. Today they meet at `packages/avatar/src/face-bus.ts` for the 2D path and at `packages/avatar/src/presence/humano.ts:735-755` for the 3D one, and both resolve by per-channel `max()`.

`max()` has one property that makes it attractive — it is commutative, so merge order does not matter — and that property is exactly what makes it wrong. A face has ordered structure. The jaw during a `/p/` is not "whichever of speech and emotion happens to be larger"; it is the speech solver's, full stop.

## Owners

| Owner | Owns |
|---|---|
| `speech` | Jaw, lips, tongue — every VIS channel |
| `expression` | Brow, lids as AU5/AU7, cheeks, nose, lip corners inside a cap |
| `blink` | `eyeBlinkLeft`, `eyeBlinkRight` |
| `gaze` | The eight `eyeLook*` channels |

## Resolutions

- **`exclusive`** — one owner. A second writer is a bug; assert it rather than blending it away.
- **`speech-priority`** — speech takes the channel outright while articulating; expression may write it only when speech is inactive, and only up to `expressionMax`.
- **`capped-additive`** — both write. Expression's contribution is clamped to `expressionMax` and added under speech, then the sum is clamped to 1. Additive rather than `max()` so an expression and a speech contribution do not silently cancel into whichever was larger.

## The three conflicts that exist in the code today

These are not hypotheticals. Each is a value in a shipped preset meeting the shipped merge.

**1 · `happiness` eats the lip corners.** `EMOTION_PRESETS.happiness` writes `mouthSmileLeft/Right: 0.55` (`packages/avatar/src/emotion.ts`). Under per-channel `max()`, every viseme corner value below 0.55 loses. The corners stop articulating and hold a smile for the length of the sentence — the "permanent smile" the audit names.

Resolution: `mouthSmileLeft/Right` are `capped-additive` with `expressionMax` 0.45, and viseme **spread** moves off the smile channels entirely onto `mouthStretchLeft/Right` (AU20). Separating the two is what makes the cap survivable: expression holds the corners, speech still stretches them.

**2 · `surprise` floors the jaw.** `EMOTION_PRESETS.surprise` writes `jawOpen: 0.15`. Under `max()` that is a floor the mouth cannot go below, so bilabials stop closing for as long as the tone holds.

Resolution: `jawOpen` is `exclusive` to speech. A surprise-adjacent tone expresses itself through AU1/AU2/AU5, not through the jaw. The palette has no surprise tone anyway — see `tone-to-performance`.

**3 · `sadness` writes the blink channel.** `EMOTION_PRESETS.sadness` writes `eyeBlinkLeft/Right: 0.15`. That is a permanently half-shut lid, not an expression, and it is directly at odds with `blink` owning the channel.

Resolution: `eyeBlink*` is `exclusive` to `blink`. The droop a sad register wants is AU7 (`eyeSquint*`) or AU41-style lid droop, both of which the expression layer owns. Port the value; do not keep the channel.

## Impossible faces

`contract.json` carries 13 conflict rules — antagonist pairs that cannot be simultaneously active on a real face. They are grouped:

- **Mouth closure vs opening** — closed and funnelled, closed and stretched, closed with the jaw open past its ceiling.
- **AU antagonists** — AU12 vs AU15 per corner, AU1/AU2 vs AU4 per brow, AU5 vs AU7 and AU5 vs AU45 per lid.
- **Gaze** — converge and diverge, or up and down, on the same eye. `gazeMorphs` (`packages/avatar/src/presence/humano.ts:234`) cannot produce these by construction; two gaze writers can, which is the point of testing for them.

`scripts/impossible-face.mjs --self-test` proves each rule fires at its thresholds and stays quiet below them. Run it before trusting a clean report.

## Unowned channels

The detector also reports channel names no contract entry owns. That is the other silent failure mode: `directEncoder` drops unknown names (`packages/avatar/src/speech/encoder.ts`) and `setMorph` no-ops on a missing morph, so an unowned channel writes nothing and warns nothing.

**Live example.** `eyesWide` is written by `EMOTION_PRESETS.surprise` and `.fear`, by `IdleFrame`, and by the 2D face bus (`packages/avatar/src/face-bus.ts:144`). It is **not** one of the 52 morph targets in `packages/avatar/rig-manifest.json` — the assets carry `eyeWideLeft` and `eyeWideRight`.

The 3D writer translates it (`packages/avatar/src/presence/humano.ts:751-752`). The 2D path does not: it puts `eyesWide` into the shape and hands it to `encoder.encode()`. Against a rebaked container whose `expressionNames` are the ARKit 52, `directEncoder` drops it and the anticipation beat's eye-widen does nothing. Against the 19-channel authoring map it depends on whether the map lists `eyesWide` — check `arkit-map.json` before assuming either way.

The contract resolves this by naming `eyeWideLeft`/`eyeWideRight` and nothing else. Producers emit contract names; the translation happens once, at the contract boundary.

## Coverage

`contract.json` names **52 channels**, and every one resolves to a morph target present on both shipped assets. No asset morph is left unowned. Verified 2026-09-10 by set-comparing the contract's keys against `packages/avatar/rig-manifest.json`'s `morphTargets`.

Keep it that way. A new morph on the asset without a contract entry is a channel four producers can reach and nobody owns; a contract entry without a morph is a write that silently does nothing. Re-run the comparison after every `avatar-rig-audit`.

## Ranges

Ranges are ARKit's normalized 0..1. Two channels are capped tighter for pedagogical reasons rather than anatomical ones:

- `noseSneerLeft/Right` at 0.3 — AU9 at full is disgust, and no tone in the palette is disgust.
- `tongueOut` at 0.4 — A2F does not fully animate the tongue, and a tutor's tongue showing past a small amount reads as a gesture nobody asked for.

The `expressionMax` caps are **authored for Moyo**. Calibrate them against the legibility gate and record the run; do not cite them as constants. The audit requires exactly that of every gate number.

## Per-AU timing

Onset, apex and release envelopes are not here. They belong to `tone-to-performance`, because the envelope is a property of the tone, not of the channel. This skill says which producer may write a channel and how far; that one says when and for how long.

## Sources

FACS <https://www.paulekman.com/facial-action-coding-system/> · ARKit `BlendShapeLocation` <https://developer.apple.com/documentation/arkit/arfaceanchor/blendshapelocation> · rig facts from `packages/avatar/rig-manifest.json`, generated by the `avatar-rig-audit` skill
