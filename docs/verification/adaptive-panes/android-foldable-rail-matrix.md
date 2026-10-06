# Android foldable + rail verification matrix

This is the verification contract for the native Android foldable work landed in #81 and the row-coordinate correction in #82.

## What is actually implemented

- Jetpack WindowManager `FoldingFeature` is bridged through the local Expo Modules 2 `ReservedRegions` module.
- Android large-window navigation uses Expo Router's JavaScript tabs with the Material sidebar variant.
- `AdaptivePanes` uses the native fold rectangle to place pane boundaries and the inspector.
- Expo Router `SplitView` itself is **iOS-only** in SDK 58; Android must use Moyo's `AdaptivePanes` composition rather than assuming the Expo SplitView native host exists. The current implementation intentionally preserves SplitView.Inspector semantics on Android instead of trying to instantiate the iOS-only API.

## Automated gates

The adaptive contract tests cover:

- compact / medium / expanded / large / extra-large width bands
- Android compact-height landscape
- Android tabletop posture
- Android book posture geometry
- physical right-edge rail (no RTL mirroring)
- physical Apple hardware columns
- window-space → pane-row-local fold conversion
- off-row hinge filtering
- zero-width hinges
- single-hinge pane planning
- multi-hinge / trifold planning
- inspector sizing and RTL direction
- non-separating fold fallback

The Android native workflow also runs the focused adaptive contract suite before assembling the Quest debug application. This prevents the native build from being considered sufficient proof of the JS layout contract.

## Physical device matrix — still required

CI cannot prove hinge behavior, touchability around the hinge, visual alignment, or actual rail placement on physical foldable hardware. A human device pass is still required.

| Device / form factor | State | Expected result |
| --- | --- | --- |
| Android foldable | fully open / FLAT | normal expanded layout; no phantom hinge |
| Android foldable | half-open / VERTICAL | book posture; panes split at the physical hinge |
| Android foldable | half-open / HORIZONTAL | tabletop posture; navigation remains bottom |
| Android dual-screen | FLAT + separating hinge | panes never straddle the hinge |
| Android foldable | fold → unfold → fold | route, selected pane, scroll/draft state survive |
| Android foldable | rotate while folded/unfolded | rail/bottom policy follows current window size |
| Android tablet | medium/expanded | physical right-edge Material rail |
| Android tablet | RTL | rail stays on the physical right edge |
| Android large/desktop window | >=1600dp | expanded labeled rail |
| Android compact landscape | height <480dp | bottom navigation, even when width is wide |
| Android foldable + inspector | book/trifold | inspector stays inside the trailing physical region |
| Android foldable + keyboard | rail/bottom | IME does not cover the active navigation or composer |

### Pass/fail evidence to capture

For each physical run record:

1. device/model and Android version
2. window width × height in dp
3. posture and FoldingFeature orientation/state/occlusion/separating values
4. navigation placement (bottom/left/right)
5. whether any pane crosses the hinge
6. whether the inspector crosses or overlays the hinge
7. whether navigation/pane state survives fold/unfold
8. screenshots of open, half-open and folded states
9. any crash, remount, visual jump, or lost input

## Known verification gap

As of this PR, the repository contains strong pure-layout coverage and a native Android compile gate, but there is no connected physical-foldable/device-farm run in CI. Do **not** mark physical foldable support "device verified" based only on a green GitHub build.

