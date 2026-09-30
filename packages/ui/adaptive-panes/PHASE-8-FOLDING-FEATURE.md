# Phase 8 — native fold awareness

**Implemented on Android with Expo Modules 2 + Jetpack WindowManager.**

## What changed

The original width-class layout is still the base policy. That remains correct for
ordinary phones, tablets, desktop windowing, rotation, and Android multi-window.

The missing physical-display signal now comes from the existing
`ReservedRegions` capability:

- **iOS 27.1+** — UIKit reserved `division` / `occlusion` regions.
- **Android** — Jetpack WindowManager `WindowInfoTracker` /
  `FoldingFeature`, normalized to a `division` region.

The Android implementation lives at:

`apps/mobile/modules/reserved-regions/android/`

and is an **Expo Modules 2** module, not a legacy `ModuleDefinition` module:

- `expoModule { v2 true }`
- `@ExpoModule(name = "ReservedRegions")`
- `@JS suspend fun query()`
- `@Event val onChanged`
- `@Record` payloads

SDK 58 exposes the Android module through
`globalThis.expoV2.modules.ReservedRegions`. The shared UI hook keeps the
existing iOS module path and consumes Android v2 directly.

## Native data

WindowManager contributes the data that JavaScript cannot derive from width:

- `bounds` — hinge/fold rectangle in application-window coordinates
- `orientation` — vertical / horizontal
- `state` — flat / half-opened
- `occlusionType` — none / full
- `isSeparating` — whether the feature creates two logical display regions

The native record is converted from px to dp before crossing the bridge, so all
consumers stay in React Native layout units.

**There is deliberately no hinge-angle field.** WindowManager's
`FoldingFeature` does not expose a continuous angle. Moyo uses posture and
geometry rather than inventing an angle from vendor-specific sensors.

## Live changes

Android does not poll `Dimensions` for posture.

The Modules 2 event's `onStartObserving` hook begins collecting
`WindowInfoTracker.windowLayoutInfo(activity)`; `onStopObserving` cancels the
Flow when the last JS listener disappears. The UI hook also calls `query()`
when the RN window dimensions change so a configuration change can rebind the
Flow to a replacement Activity.

That catches:

- fold / unfold
- flat ↔ half-opened transitions
- book posture
- tabletop posture
- dual-screen separating hinges
- rotation / multi-window changes

## AdaptivePanes behavior

`AdaptivePanes` still uses the four Moyo width classes to decide **which**
panes may be visible.

A separating **vertical** fold then decides **where** an already-visible pane
boundary lands:

1. Prefer primary + supplementary on the leading physical region and detail on
   the trailing region when both leading panes fit.
2. Otherwise put primary on the leading region and supplementary + detail on the
   trailing region when that still defends the detail minimum.
3. If neither arrangement fits, keep the existing width-class composition.
   The fold layer never silently chooses which product pane to hide.

For a fully occluding hinge, its physical width is inserted as layout space.
The draggable divider is suppressed when the physical hinge itself is the pane
boundary.

A flat, non-separating flexible fold does **not** rearrange the panes.

## Inspector behavior

Expo Router's `SplitView.Inspector` is a supplementary surface that slides in
from the trailing edge. Android follows that same semantic contract in
`AdaptivePanes.Inspector`:

- overlay, never a fourth tiled column
- logical trailing edge, including RTL
- `showInspector` gates the authored inspector
- width capped to the trailing physical region on a separating vertical fold
- hidden state stays mounted/frozen so local state and render surfaces survive

The inspector uses the same normalized fold geometry as the main pane planner,
so there is no second hinge implementation to keep in sync.

## Tabletop and book posture

`foldLayoutFromRegions()` derives:

- `halfOpened + horizontal` → `tabletop`
- `halfOpened + vertical` → `book`
- otherwise → `flat`

AdaptivePanes does not globally turn a horizontal/tabletop fold into a vertical
stack because the semantic assignment is screen-specific. A media screen may
want content above / controls below; a tutor screen may want lesson above /
composer below. Those surfaces can consume the exported posture signal without
adding another native bridge.

## Dependency policy

Android uses stable:

`androidx.window:window:1.5.1`

The experimental WindowManager 1.6 Window Area APIs are not pulled into this
core hinge path. Secondary/rear-display presentation should be a separate
capability because it has a different lifecycle and hardware-availability
contract from fold geometry.

## Tests

Pure geometry stays outside React Native and runs in the existing Node test
suite:

`packages/ui/adaptive-panes/fold-layout.test.ts`

It covers tabletop detection, flat dual-screen separation, UIKit orientation
inference, hinge snapping, the two three-pane placement strategies, and the
non-separating fallback.

Device verification still matters. Run the Android Studio foldable emulator
posture controls and at least one physical foldable before calling a specific
hardware matrix certified.
