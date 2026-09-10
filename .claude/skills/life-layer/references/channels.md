# Life-layer channels

Values are NOT duplicated here. This records the owner, the ceiling and the
source file, so a reviewer can find the number without a second copy of it
drifting.

| Channel | Owner | Ceiling | Where the value lives | Source |
|---|---|---|---|---|
| Breath | idle engine | `breath.bobM`, `breath.pitchDeg` | `idle/config.ts` `breath` | rate 0.2–0.27 Hz = 12–16 /min |
| Blink | idle engine | hazard-driven, refractory floor | `idle/config.ts` `blink` | close < open (Trutoiu) |
| Saccade | idle engine | `saccade.maxDeg`, tighter while speaking | `idle/config.ts` `saccade` | Eyes Alive |
| Gaze aversion | idle engine | `gaze.aversionYawDeg` / `aversionPitchDeg` | `idle/config.ts` `gaze` | product limit |
| Balance sway | presence writer | `sway.amplitudeM` | `idle/config.ts` `sway` | two octaves, irrational ratio |
| Held weight shift / torso turn | presence writer | posture, not sway | `presence/humano.ts` | audit §"Changes in this branch" |
| Finger rest shape | presence writer | changes with posture, then holds | `presence/humano.ts` | audit — continuous noise read as fidgeting |

## Why the sway ratio matters

The two octaves are set at a ratio of `e`. An irrational ratio has no common
period, so the sum never repeats — which is what stops a viewer's eye locking
onto a cycle. A "nicer" ratio like 2:1 or 3:2 reintroduces exactly the
periodicity the autocorrelation check exists to catch.

## Not measured

Blink and breath rates have not been measured against a rendered capture on this
branch — only the configured rates are known. The distribution check operates on
generated sequences, which validates the generator and not the renderer.
