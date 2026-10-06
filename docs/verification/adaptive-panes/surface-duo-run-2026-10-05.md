# Physical foldable run — Surface Duo, 2026-10-05

The physical-device pass the matrix in
`android-foldable-rail-matrix.md` (PR #85) requires. Everything below was
observed on hardware, driven via `adb` + the Argent device tooling. Nothing
here is inferred from unit tests.

## Device / environment

- **Device:** Microsoft Surface Duo (dual 1350×1800 px panels, hinge at x=1350)
- **Window size during tests:** 2700×1800 px spanned, and 1350×1800 px forced
  (`wm size`) for the compact path
- **Density:** 2.5
- **Build:** Expo dev client, JS bundle over Metro
- **Posture control:** `cmd device_state state {0,1,2,3}` overrides —
  CLOSED / HALF_OPENED / OPENED / FOLDED, driving the real Jetpack
  WindowManager `FoldingFeature` pipeline, not a mocked size class

## Raw hinge data (the attribution layer)

`ReservedRegionsModule.kt` logs every `FoldingFeature` to logcat
(tag `ReservedRegions`, TEMP-DEBUG block — remove when this file graduates
from active validation):

| Posture (device_state) | Reported FoldingFeature |
|---|---|
| OPENED (2), flat | `bounds=[1350,0,1350,1800] size=0x1800 orientation=VERTICAL state=FLAT occlusion=NONE separating=false` |
| HALF_OPENED (1), book | `bounds=[1350,0,1350,1800] size=0x1800 orientation=VERTICAL state=HALF_OPENED occlusion=NONE separating=true` |
| FOLDED (3) | no emission — flow held last report; `wm size` stayed 2700×1800 and layout kept the flat composition |

Observations:

- The Duo reports a **zero-width** hinge rect in both flat and half-opened
  states. `separating` — not rect width — is the posture signal on this OEM.
- A zero-width *separating* crease still drives `splitAfter` planning; the
  boundary lands exactly on the hinge x.
- FOLDED (folded back 360°) produced no feature change — on this device
  folded-back keeps the same flat layout, which is correct.

## Results by matrix row

| Matrix row | Result | Evidence |
|---|---|---|
| FLAT / fully open | **PASS** | All adaptive surfaces render width-class layouts; no phantom hinge treatment (separating=false ignored, correctly) |
| HALF_OPENED / VERTICAL (book) | **PASS** | TutorStage 3-pane snapped: conversation alone on left display (0→0.485), hinge divider at x=0.500 exactly, board + Natalie share right display. `splitAfter: 'primary'` — no pane straddles the crease |
| Fold → unfold → fold continuity | **PASS** | Reports: selected report survives 2700→1350→2700 round trip, detail restores in place. TutorStage: thread + composer + saved turn survive — one `AdaptivePanes` tree, no remount |
| FLAT + separating hinge, no straddle | **PASS** | Book-posture snap puts every pane entirely inside one physical display region |
| Rotation | **NOT RUN** | Not exercised this pass |
| RTL | **NOT RUN** | Automated contract coverage only |
| Medium/expanded rail | **PASS** | Material edge rail present at 1080dp+ in guardian/teacher/learner shells; compact widths fall to bottom nav or single-column + rail per surface |
| >=1600dp expanded labeled rail | **PASS** | 2700px run shows labeled edge rail |
| Compact landscape <480dp height | **NOT RUN** | Not exercised this pass |
| Inspector inside trailing region | **UNTESTED — no shipped screen authors `AdaptivePanes.Inspector`** | Machinery exists (`resolveTrailingInspectorLayout` caps at trailing region); zero non-story consumers. Guardian `/calendar`, org `/schedule`, family-calendar are all contracted single-column. Flagging as unbuilt scope, not a foldable regression |
| IME vs navigation/composer | **PASS** | TutorStage composer sat above keyboard region; no overlap observed |

## Navigation / shell findings from this run

- **Pushed-route trap — FIXED + VERIFIED.** A report pressed at compact width
  used to push `/reports/[id]` with no history underneath: `GO_BACK`
  unhandled, hardware back exited the app, no rail, no chevron. Fixes:
  `unstable_settings.initialRouteName` on each role group + tabs layout, and
  `ShellBackRail` — an edge column matching rail chrome with Back anchored
  above the menu-button slot, `replace()`-ing to the parent path so it can
  never dead-end. Verified: fold→push→unfold shows rail + chevron; Back lands
  on the two-pane list.
- **Detail-pane bleed — FIXED + VERIFIED.** `CollapsiblePane` pinned its inner
  child to a stale grown width after the rail opened; report detail content
  was offset ~0.17 into its pane and clipped mid-glyph. `measured` is now
  invalidated in the same render-phase reset that drops `grown`, and both
  forks `grow shrink` so re-layout wins. Verified at 2700px: content flush
  inside `0.374→0.926`.
- **Schedule body collapse — FIXED + VERIFIED.** `Schedule`'s `Dial` wrapper
  lacked `flex-1`, collapsing the grid to a 5px line. `uiautomator` bounds
  showed a 2380×5px element below the controls and nothing else. One-class
  fix; heading, badge and the full resource grid now render.
- **Stray scrollbars — FIXED + VERIFIED.** Capture/camera-adjacent screens
  showed persistent vertical scrollbar tracks. Indicators now default off at
  the `tw` ScrollView primitive (established `showsVerticalScrollIndicator={false}`
  convention centralized).
- **XR pane-chrome overlay — FIXED + VERIFIED.** "Open spatial whiteboard"
  rendered as a 56px block over Natalie's face at `group` inset. Now
  `inset-hair` (4px) corner placement at the `sm`/44px target.
- **Known residual:** once, after a `wm size` change, every tap was eaten
  while scrolls still worked — suspected stale drawer scrim desync on resize.
  Hardware back cleared it; not reproduced after the nav fixes. Watching.

## Verdict

**PASS WITH ISSUES — functional but fixes remain.**

Blocking class issues found this pass were fixed and re-verified on device.
Outstanding: rotation matrix, RTL physical pass, inspector has no consumer to
test, the one-time post-resize dead-tap episode is unresolved-but-unreproduced,
and `HALF_OPENED` verification used `device_state` overrides on a physically
flat Duo — a manual hand-fold pass is still worth one look.
