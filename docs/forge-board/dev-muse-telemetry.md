# Finite Muse diagnostic viewer

The existing development-only Forge board probe displays mapped control values
from a separate temporary test reader. It does not emit Whiteboard/Yjs input,
change the normal pen connection controller, or establish production readiness.
No position or orientation fields are decoded. Native resources remain owned by
the external collector and host bridge.

`ForgeBoardProbe` retains `museTelemetry` in a component ref. The host debugger
locates the ref whose current object exposes `startSession`, `ingestCapture`,
`finishSession`, and `state.getState`. No app global is registered.

`startSession(metadata)` requires:

- `schemaVersion: 1`, a fresh `sessionId` nonce of 16–128 alphanumeric/underscore/
  hyphen characters, and `capability: 'external-test-telemetry'`.
- `collectorApkSha256` equal to
  `753d9214a51cad2daeed4b90e21447564178e777fd97cc0fb15767c7283a54d3`;
  `reportMapSha256` equal to
  `4708e62215883a297c88be41600d2ddea20345ecfbe41213db47f7d6778b3405`;
  `reportReferenceHex: '0201'`; and `maxSamples: 100`.
- `startedAtWallTimeMs` from the actual collector polling-start timestamp, at
  most three seconds old and two seconds in the future relative to the app.
  `expiresAtWallTimeMs` must still be future and no more than 40 seconds after
  polling start. An independent monotonic deadline also bounds the session if
  the system wall clock changes.

The host must attest the actual installed collector before arming, obtain app
arm time, and start only a newly observed, still-running hardware capture.
Matching metadata is a trusted host contract, not cryptographic proof that an
arbitrary supplied payload came from hardware. Completed files must not be
replayed as LIVE. Model tests use fixtures only in the Node test process.

`ingestCapture(envelope)` repeats the schema version, session ID and source pins,
and supplies cumulative `gapCount` plus `samples`. Each sample contains
`sequence`, `gattStatus`, `byteLength`, `rawHex`, `wallTimeMs`, and
`elapsedPollingMs`. Only status 0, exactly 65 bytes/130 hex digits, sequence
indices 0–99 in increasing order, and increasing elapsed times are accepted.
Source wall time must agree with polling-start plus elapsed time within 250ms.
Samples older than three seconds or more than two seconds in the future are
rejected. Batches validate atomically. The viewer counts observed sequence holes
and preserves the maximum of those holes and the host's monotonic gap receipt;
it never hides losses or double-counts overlapping reports.

The decoder retains only tip byte 0, tip-associated force byte 1, round-button
byte 4 bit 1, oval byte 2, and oval-associated force byte 3. Force values remain
raw descriptor values; calibration and analog resolution are not established.
Unknown vendor fields and IMU payloads are not retained in viewer state.

`finishSession(sessionId)` marks the last readings captured/historical. At 100
accepted samples the viewer also completes automatically. Expiry, stale data,
and viewer teardown retain the last measured values but mark them unavailable;
they never synthesize zero values or release events. A new session requires a
new nonce. Each mounted controller accepts at most 64 distinct sessions.
An active LIVE session owns the viewer; a different nonce cannot replace it
until it completes or becomes unavailable.

Validation: `node --test apps/mobile/src/forge-board-probe/muse-telemetry.test.ts`
checks the retained actual descriptor hash, controlled-prefix mappings,
malformed/reordered/stale inputs, nonce/source boundaries, expiry including wall
clock rollback, bounded completion, and gap accounting. These checks do not
constitute physical validation by themselves or establish a production input
driver. Separate [recorded physical viewer evidence](evidence/quest-muse-live-viewer.json)
documents the user-confirmed changing-value demonstration and the final
100/100, zero-gap completed capture. Its test-only authority and prior manual
restoration timing overruns remain explicit.

Automatic host orchestration now restores the scoped inspection service on
completion, error, cancellation or watchdog. A separate
[physical completion-path receipt](evidence/quest-automatic-inspection-restore.json)
records acknowledged restoration at 33,876.573ms, below the approved 60-second
window. Earlier manual overruns remain part of the validation record.
