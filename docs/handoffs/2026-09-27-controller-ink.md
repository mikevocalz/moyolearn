# Controller ink continuity

## Source-confirmed problems and changes

- `XrBoardSurface` depended on anchor object identity. `rive-board-panel.tsx`
  passes an inline anchor object, so an unrelated parent render ran the surface
  cleanup and cancelled the open stroke. Placement now depends on scalar
  coordinates. Actual placement/size changes still cancel the old mapping.
- `BoardPointer` ignored invalid owner coordinates, allowing a subsequent valid
  sample to bridge across invalid tracking. It now ends the valid segment;
  movement cannot reopen it until a new press.
- The Quickdraw WebView bridge queued begin/end/cancel until another animation
  frame. Boundaries now flush immediately, including preceding moves in order.
  Moves remain frame-batched. A batch flushes at 256 packets to bound the local
  pending array; this is NOT backpressure on the WebView's native command queue.

## Native companion required

ViroCore `VROInputControllerBase::processDragging` suppresses motion below
`ON_DRAG_DISTANCE_THRESHOLD = 0.01` metres. The companion branch
`codex/precision-controller-ink` makes surfaces with `highAccuracyEvents` and
`dragTransform=None` emit every changed finite hit. Ordinary drags retain the
1 cm threshold. Moyo's board already sets both props.

This companion source change must be built into the Quest/Pico renderer AARs,
packaged in the Viro dependency and consumed by Moyo before its sampling benefit
is present in an installed app. Merely merging the C++ source does not update
the vendored Android binaries. The Apple's pinned ViroKit build also needs a
deliberate source-pin update after native validation. No binary integration is
claimed by this app patch.

## Verification

- UI TypeScript check passed.
- 146 UI XR tests passed, including ownership, tracking discontinuity, spatial
  stylus mapping and rotated-board coordinate tests.
- Companion C++14 sample-policy replay passed with warnings as errors: all 100
  changed samples of a 5 mm trajectory reach the precision policy, versus zero
  under the ordinary 1 cm policy. Invalid/unchanged samples are suppressed.
- These results are software tests, not physical tracking or display latency.

## Remaining device and integration gates

Build and package the companion native change, then test production Tutor Room
on actual Quest and Pico. Record device/OS, refresh rate and final build SHA.
Compare slow small letters, dots, corners, fast loops, edge exits, panel movement,
left/right controller use, repeated entry/exit and drawing while Natalie speaks.
Inspect release frame-time p50/p95/p99, memory trend, event cadence and actual
input-to-visible-ink latency. Native submission time is not display time.

No jitter filter, prediction or simplification was added: parameter choices need
recorded controller trajectories and latency/fidelity comparisons. No claim of
best-in-class or hardware-verified smoothness is made. The remaining JS-to-WebView
crossing and native texture path need profiling under the full tutoring workload.
