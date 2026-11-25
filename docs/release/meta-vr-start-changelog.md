# Meta VR Start release work

## 2026-11-14 — local work, not released

Homework: added parent-selected “Already done before upload” marks, first-undone selection, skipped prior-complete problems, prestart correction, all-done reopening, distinct progress/timeline presentation and exclusion from learning reports. Automatic detection is off. Additive migration and generated Payload types are in the local patch; production migration and phone acceptance are pending.

Tutor safety: authoritative start responses now refresh the device worksheet; stale hydration and coaching output cannot revive a worksheet ended because every problem was already marked done.

Hands: built and locally pinned a far-input renderer prototype from commit `1471b3faf`, with distinct hand IDs, pinch hysteresis and cancellation/rearm on tracking loss or system gestures. Enabled the existing navigator hand gate. Native arm64 compilation and ABI checks pass. No direct-touch, hands-only runtime completion, PICO Java regression or recording claim is approved for the competition entry.

## 2026-11-25 — deadline passed, nothing released

The competition deadline (2026-11-18) passed. The repository holds no record that an entry was submitted; the only entry-related statement is the 2026-11-14 section above, which approved no runtime or recording claim. `release/meta-vr-start-2026` still points at `599456a7`, the same commit as `main`, so none of the homework or hands work reached it.

Disposition: the three lines are merged on `integrate/v1-main-20261125` (merges `423e4bda`, `27944225`, `fe324044`, `1457ff92`). Once that lands on `main`, retire `release/meta-vr-start-2026`; deleting it needs Mike's approval.
