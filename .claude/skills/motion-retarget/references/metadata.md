# Clip metadata

Each field exists because something downstream cannot work without it.

| Field | Why |
|---|---|
| `source`, `license`, `licenseUrl` | Proves the clip is yours to ship. See `scripts/ledger.mjs`. |
| `skeletonHash` | A clip retargeted against one rig and played on another moves the wrong joints. Compare against `rig-manifest.json`. |
| `posture` | The compositor cannot blend a seated clip into a standing base. |
| `hands` | `none` / `partial` / `full`. A clip with no finger tracks leaves the hand to the life layer; one with partial tracks will fight it unless the compositor knows. |
| `tags` | How the behaviour planner retrieves a candidate at all. |
| `prepMs`, `strokeMs`, `holdMs`, `retractMs` | McNeill's gesture phases. The stroke apex has to land on or just before the stressed syllable, so a clip whose stroke time is unknown cannot be scheduled — only played, which is the thing that reads as a robot. |
| `entryPose`, `exitPose` | Transition planning. A clip that cannot be entered from rest is unusable however good its middle is. |
| `contactAnchors` | Where the hand must actually meet a surface. Without it an IK target is a guess and the hand floats or penetrates. |
| `affectedJoints` | The ownership table. Two clips that claim one joint is the double-driving the compositor exists to prevent. |
| `bounds` | Cheap rejection before a blend is attempted, and the reach cap the safety firewall applies. |

## Not measured

The retarget inputs `avatar-rig-audit` lists as unmeasured — units as loaded,
reference-pose pelvis height, shoulder offsets, joint limits, twist distribution
— are all required here. Measure them first. A wrong reference pose produces a
clip that looks nearly right and slides, which is harder to diagnose than one
that is obviously broken.
