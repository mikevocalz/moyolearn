# Review drafts

Prepared 2026-11-14. The requested release branches were created from the audited app and renderer baselines. Nothing was merged or deployed.

Created drafts: [homework data/API #153](https://github.com/mikevocalz/moyolearn/pull/153), [stacked homework UI #154](https://github.com/mikevocalz/moyolearn/pull/154), and [native renderer #121](https://github.com/mikevocalz/virocore/pull/121). The Moyo artifact integration is a separate review draft.

## Homework draft

Title: Let guardians mark homework completed before upload

Parents can mark questions finished before tutoring. Learner start and advance skip those marks while retaining them in progress and the guardian timeline. Reports exclude pre-finished work from Moyo outcomes. An all-marked sheet offers guardian correction and ends the learner view without reviving late coach output.

This fallback is guardian-selected and prestart-only. Automatic detection is OFF; crop/classifier linkage, precision evaluation and between-problems editing remain unresolved. Separate prior-work fields, additive SQL and regenerated Payload types preserve existing outcomes and crop retention. Submission row locking serializes start, mark revision and advance; the cache adopts authoritative start selection. Native checkbox labels use the installed Expo API.

Owner-run validation: 708 app unit tests, 132 server tests, app/mobile/web/Payload TypeScript and targeted changed-file lint passed. Independent source review corrected cursor adoption, timeline double-counting and stale stream/hydrate resurrection. Scratch database initialization was denied before SQL. Migration/concurrency/retention integration, production schema, deployed phone flow, native accessibility and production builds remain unverified. See `docs/verification/homework-upload-2026-11.md` and `build-prompts-gates-2026-11.md`.

## Native hands draft

Title: Prototype independent hand rays and pinch hysteresis in Tutor Room

Native hand and grip sources use separate IDs from controllers and enter the existing click/drag dispatch. Candidate pinch hysteresis separates press/release; tracking loss and system/menu gestures cancel input and require release before rearming. The Tutor Room explicitly enables hand tracking. No parallel drawing engine or new event API was introduced.

The arm64 renderer was rebuilt from reviewed commit `1471b3faf4470b91710db573a37634e4ab65161c` on the pinned baseline, packaged with provenance and selected by app/prebuild checksum pins. The existing `.1` bridge supports numeric source fields; the mobile declaration now matches its root override. Window dimensions, orientation, manifest metadata and scene geometry remain unchanged.

Owner-run validation: all 307 native tasks, host C++14 tests and ABI checks passed. Independent archive comparison found only the renderer shared object changed. All 9,750 baseline exports/JNI remain; no new undefined imports. Sixteen pin/config tests and four bridge checks passed; merged-APK manifest test was skipped. Package TypeScript checks passed. This qualifies build/packaging scope only.

Direct touch is not implemented. Thresholds remain unqualified and the candidate APK has not run on the headset. Controller-free hand/tray/voice/left-hand/one-hand/seated/lifecycle runs, PICO regression, frame pacing, coach and entry recording remain open. Do not present the prototype as completed hands-first acceptance. See `docs/verification/hands-first-2026-11.md`, adjacent AAR provenance and the gate report.
