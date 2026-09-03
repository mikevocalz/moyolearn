# Native 3D smoke — go/no-go gate (2026-09-03, demo day)

SOT-KEYWORDS: native-3d, webgpu, go-no-go, demo-day, surface-duo, natalie, smoke-test

## Why this file exists
The native WebGPU avatar lands on demo day. A demo-day change needs a written
abort rule made BEFORE the work starts, not a judgement call made at 05:50 with
a half-built APK on the bench. This is that rule. Times are recorded, not
recalled.

## The clock
| Mark | Time (EDT) | Source |
|---|---|---|
| Work started | 2026-09-03 01:59 | `date` at agent start |
| Doors | 09:00 (ASSUMED — awaiting confirmation) | assumption, tight-window default |
| **HARD CUTOFF (doors − 3h)** | **06:00** | doors − 3h |

If doors move, the cutoff moves with them and this table is amended in place.

## The gate
At the cutoff, exactly one of two things is true.

**GO** — a build containing `react-native-webgpu` is installed AND launching on
the Surface Duo (serial `913949703467`, `com.moyolearn.app`), and the native
smoke below passed. The flag ships **OFF by default in the committed store**;
GO means it *can* be turned on, not that it is on.

**NO-GO** — anything else. The flag stays OFF, the 2D demo runs unchanged, and
the outcome is reported rather than rushed. NO-GO is not a failure state; it is
the designed-for state.

## Hard stop conditions (report, do not push through)
1. The docs' triangle or the example cube will not render on the Duo.
2. Split glTF loads but morph targets or the skin are missing.
3. A Dawn shader-compile failure that cannot be cleanly resolved by stripping a
   single material extension.
4. The phone tier cannot hold the frame budget with a conversation running.
5. No native build on the device by the cutoff.
6. Anything that would require touching the coach prompt, model routing, the
   Safety Plane, or voice egress.

## The 2D path is not on the table
`packages/avatar/src/tutor-stage.ts` already encodes the promotion rules: the 2D
mark is up from frame 1, promotion happens only on a real first rendered frame,
demotion is immediate and permanent, and a download failure is not an error.
Native 3D is an additive consumer of those rules. No edit in this workstream may
change the 2D path's behaviour when the flag is off.

## Log
(appended as the work runs)

- 01:59 — gate written. Cutoff 06:00 EDT on assumed 09:00 doors.
