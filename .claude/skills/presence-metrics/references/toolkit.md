# Toolkit status

Honest inventory. A tool that does not exist is listed as absent rather than
described as if it did.

| Tool | Status | Where |
|---|---|---|
| Acceptance record + validator | **exists** | `scripts/acceptance.mjs` |
| Idle periodicity / repeat / rate check | **exists** | `life-layer/scripts/check-idle-distribution.mjs` |
| Viseme schedule vs reference | **exists** | `viseme-timing/scripts/check-timing.mjs` |
| Audio↔face offset measurement | **exists** | `viseme-timing/scripts/measure-offset.mjs` |
| Impossible-face detector | **exists** | `face-adapter/scripts/impossible-face.mjs` |
| Tone table / palette drift | **exists** | `tone-to-performance/scripts/check-tone-table.mjs` |
| F0 pitch tracking + head-onset alignment | absent | — |
| Torso energy vs RMS correlation | absent | — |
| Artifact detectors (foot slide, penetration, pose reset, eye detachment) | absent | — |
| Per-device capture harness | absent | — |
| Blinded comparison tooling | absent | — |

## Measured so far

Nothing. Every field in the acceptance record is `not measured`. The tools that
exist validate generators and schedules — none of them has been pointed at a
render on a device.

That is the accurate state and it is why no realism claim appears anywhere in
this branch's commits.
