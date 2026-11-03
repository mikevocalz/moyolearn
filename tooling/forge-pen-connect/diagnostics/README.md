# Finite test-role telemetry bridge

This host script forwards fresh real collector samples into the existing DEV
Forge probe telemetry ref. It never produces ink, coordinates, pose or normal
pen readiness. It does not install, launch, pair, stop inspection, start the
collector, change permissions, open GATT or restore services. The main operator
owns those explicitly approved lifecycle actions and the single BLE producer.
No live run has been performed by this implementation agent.

The only device read is the fixed private collector JSON, through the cached
native Meta CLI executable. JavaScript calls use Argent's existing
`debugger-evaluate` tool with structured JSON stdin. Installed Argent 0.31.0 was
reviewed: debugger-connect/evaluate depend only on JsRuntimeDebugger/Metro/CDP;
AndroidDevtools and its UiAutomation instrumentation are separate. Verify that
contract again after tooling changes. Do not call describe/tap or other native
inspection tools during the scoped test-role pause.

The operator must first:

1. Verify the **actually installed** collector APK bytes against SHA256
   `753d9214a51cad2daeed4b90e21447564178e777fd97cc0fb15767c7283a54d3`.
   The main agent pulled `/tmp/moyo-installed-muse-test.apk` and verified that hash.
   Script hashing of this local preflight artifact does not independently attest
   a later device installation; this is trusted local debug plumbing.
2. Mount the existing DEV viewer and locate its real component ref. Supply a
   trusted JavaScript **expression returning that ref.current object**; no app
   global or second controller is registered by this script.
3. Generate a fresh nonce and obtain app `Date.now()` as armTimeMs before starting
   instrumentation. Close the normal Moyo GATT owner. Apply only the separately
   approved, bounded Quest inspection pause and collector run. The script itself
   does not acquire or extend permission approval.
4. Start the script immediately after collector launch. Its first private file
   must belong to a new collector run after armTimeMs. A ready polling timestamp
   must be at most 3 seconds old. Completed captures cannot begin a LIVE session.

Pass one trusted config JSON on stdin (paths/nonce/arm time/locator are operator
values, never derived from collector text):

```json
{
  "deviceId": "YOUR_QUEST_SERIAL",
  "port": 8081,
  "metaCliPath": "/absolute/path/to/cached/native/metavr",
  "argentPath": "/opt/homebrew/bin/argent",
  "installedCollectorApkPath": "/tmp/moyo-installed-muse-test.apk",
  "armTimeMs": 0,
  "sessionId": "REPLACE_WITH_FRESH_NONCE",
  "controllerExpression": "REPLACE_WITH_TRUSTED_EXPRESSION_RETURNING_PROBE_REF"
}
```

The zero arm time and placeholder locator above are intentionally invalid.
Run the prepared configuration with:

```sh
node tooling/forge-pen-connect/diagnostics/live-telemetry-bridge.mjs < /tmp/muse-live-session.json
```

The current cached native Meta binary, located without invoking device operations,
is `/Users/mikevocalz/.metavr/npm/binaries/@meta-quest__metavr-darwin-arm64/1.10.0.30.10/metavr`.
Unlike the npm shim it adds no wrapper process or download resolver. Its help
confirms the argv command `--device SERIAL adb shell run-as PACKAGE cat FILE`.
Package/file are fixed in the script, not configurable.

The bridge validates source provenance flags, connected/bonded status, exact
457-byte Report Map hash, actual unique 0201/0203 Report References in the same
service, successful 8-byte feature2 and successful 65-byte input2 values. It forwards
raw bytes with original sequence/wall/elapsed timestamps. Old/reordered/malformed
source data is rejected; stale samples are omitted and counted in cumulative
gapCount. Repeated cumulative snapshots are not replayed. The collector run cannot
change mid-session. These checks prove contract consistency, not cryptographic
hardware identity; the nonce is session correlation, not native authentication.

Host snapshot polling defaults to 1000ms. A motion-mode configuration may set
`pollingIntervalMs` between 250 and 1000ms; subprocess time adds latency, and
this does not increase the collector's maximum four measured reads per second.
The fixed 40-second host forwarding deadline remains independent of polling rate.
Viewer expiry is independent and no later than polling start plus 40 seconds or
actual collector wall start plus 40 seconds. A fresh final snapshot after the planned 25-second sampling
window is forwarded before immediate completion, within that global bound. End/transport failure attempts finishSession; failed cleanup is
reported, and expiry remains independent. Only the script's own subprocesses
receive SIGTERM then, if needed, SIGKILL after 200 ms grace. Shared ADB/Argent/Metro
processes are never targeted. A CLI may spawn its own short-lived child; the
script does not enumerate or kill unrelated descendants. The standalone bridge does not manage an inspection pause. Future approved
captures use the scoped orchestrator below for automatic restoration. Neither
script authorizes an unbounded live bridge.

Tests run exclusively against local fixtures and injected IO, plus two owned
Node subprocess timeout/output-limit cases:

```sh
node --test tooling/forge-pen-connect/diagnostics/live-telemetry-bridge.test.mjs
```

Each debugger result now includes a sanitized `viewer` acknowledgement containing
only phase, accepted sample count, last sequence, missing-sequence count and the
five mapped control values. The host records these acknowledgements with
`started`, `forwarded` and `viewer-finished` entries. It never copies raw IMU,
vendor bytes, authentication state or the viewer's broader state into the journal.
This distinguishes actual app acceptance from merely sending a host payload.

The first physical bridge run delivered 97 samples, and independent app-state
inspection observed 71 samples while LIVE. Its last three reports exposed a
host lease bug: using preflight arm time for expiry consumed time spent preparing
CDP before capture. Expiry is now anchored to the actual collector wall start
and polling start, each bounded at 40 seconds; arm time only excludes older
capture files. The fixed 40-second host monotonic deadline remains independent.
A regression covers a 14-second preparation lead and a final fresh snapshot after
25.5 seconds, including final sequence99 delivery and explicit completion. Old
completed files still cannot initiate LIVE. The corrected physical run subsequently reached100/100 samples and sequence99
with zero gaps in the actual Moyo viewer. This establishes finite diagnostic
telemetry acceptance; production input readiness is not established.


## Automatic scoped restoration

`scoped-telemetry-orchestrator.mjs` is the fixed lifecycle for a future explicitly
approved capture. It requires `approvedFiniteQuestInspectionPause: true`, plus
operator attestations that the normal Moyo GATT owner is closed and the isolated
collector is inactive. It verifies the actual installed-APK pull and reviewed
collector-source hashes before pausing. The collector remains bounded to the
reviewed25-second poll/40-second global deadline; source and APK pins are fixed.

The orchestrator pauses only the configured Quest's services, reconnects the
independent Metro/CDP debugger, launches the reviewed collector through REA and
the finite host bridge, and restores inspection immediately after completion.
Normal completion, errors, cancellation and a45-second watchdog all enter the
same cleanup path exactly once. Only this invocation's host processes and, when
needed, `com.moyolearn.museprobe` are terminated. An8-second describe budget must
return a nonempty `android-devtools` acknowledgement; offline/timeouts are
reported as restoration unconfirmed, never successful. Measured viewer values
are retained as historical without zero/release synthesis. No shared ADB daemon,
other device, learner board, app data or firmware is reset.

Run only a freshly approved and attested config, with a new nonce and unused
output directory:

```sh
node tooling/forge-pen-connect/diagnostics/scoped-telemetry-orchestrator.mjs < /tmp/approved-muse-scoped-config.json
node --test tooling/forge-pen-connect/diagnostics/scoped-telemetry-orchestrator.test.mjs
```

The config extends the bridge fields with `reaScriptPath`, `collectorSourcePath`,
`outputDirectory` and the three explicit approval/ownership booleans. The prepared
example was left non-armed. The actual REA CLI documents `--format json` as a
supported option. Collector process output can contain stderr progress records
as well as final JSON, so future captures store it as `collector-rea.log`, a mixed
journal, rather than claiming one canonical JSON document. Existing evidence
files retain their original names and bytes.

A manually restored100-sample run exceeded the approved60-second pause, taking
85.493 seconds. That overrun was disclosed and is retained as a failure; successful
telemetry did not excuse it. The automatic physical proof then completed100/100,
last sequence99, zero gaps, and actual viewer phase completed. Its final bridge
ACK and restored accessibility tree both retain measured values as historical.
The scoped `android-devtools` restoration acknowledgement arrived33,876.573ms
(33.877 seconds) after pause initiation, within the approved60 seconds. Artifacts
remain at `/tmp/moyo-muse-auto-restore-proof`; the existing collector output there
keeps its original `collector-rea.json` filename despite containing a mixed
journal. This normal-path physical proof complements seven injected-IO lifecycle
tests covering completion, failure, cancellation, watchdog, partial pause failure,
offline restoration and preflight rejection. It does not physically validate all
failure paths or guarantee recovery after host loss/SIGKILL or device disconnection.
