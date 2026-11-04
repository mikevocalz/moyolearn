# Muse read-only HID diagnostic collector

This is a separate, debuggable, self-targeted instrumentation package `com.moyolearn.museprobe`. It is not linked into Moyo, not a production input provider, and has no Bluetooth permissions declared in its application manifest. It runs only through an explicitly authorized Android instrumentation session. Existing signed APK: `vendors/muse-hid-diagnostic-collector-753d9214.apk`. Exact identities and SDK details are in `provenance.json`.

The public UiAutomation test API temporarily adopts only BLUETOOTH_CONNECT and BLUETOOTH_PRIVILEGED. It uses FLAG_DONT_USE_ACCESSIBILITY, closes its own GATT client, and drops adopted permissions in cleanup. Android14 can still reject registration when another UiAutomation owner exists; coordinate a brief, approved pause of that specific owner and restore it afterward. Do not terminate unrelated services. This permission role does not transfer to Moyo or provide normal production access.

Preflight requires an awake connected Quest, exactly one already-bonded device named Logitech Muse and actual BOND_BONDED immediately before connection. A name alone is not authenticated hardware identity. Fresh Report Map SHA must match `4708e62215883a297c88be41600d2ddea20345ecfbe41213db47f7d6778b3405`. No explicit pairing, unpairing, CCCD writes, feature/control writes, or notification subscription occurs. An encrypted read can nevertheless provoke an OS pairing prompt if keys are stale; stop rather than approving an unreviewed new bond.

`MuseDescriptorInstrumentation` reads the actual map and Report References. `MuseLiveReadInstrumentation` additionally reads feature2 once, persists a ready receipt, then polls input2 sequentially at most4Hz, max100samples and25seconds of planned polling. A40second global callback deadline includes connection and discovery; setup can shorten the available sampling window. A final in-flight read can extend past25seconds but remains bounded by40seconds. Unexpected callbacks or failures stop the diagnostic. Ready/sample/final JSON snapshots use atomic same-directory replacement. Error cleanup is recorded independently; if framework finish fails, only the isolated collector's own process is terminated after persisting the result.

## Scoped operator commands

These are reviewable examples, not an instruction to run automatically. Use the exact authorized device serial; never omit device selection. `metavr` can be replaced with the already verified local executable path. Avoid app/UI automation during the brief test window.

```sh
TASK_DEVICE=340YC10GC3014S
APK=vendors/muse-hid-diagnostic-collector-753d9214.apk
shasum -a 256 "$APK"
# Must equal753d9214a51cad2daeed4b90e21447564178e777fd97cc0fb15767c7283a54d3.
metavr --device "$TASK_DEVICE" adb install -r "$APK"
metavr --device "$TASK_DEVICE" shell 'pm path com.moyolearn.museprobe'
# Take the exact base.apk path returned above and verify installed bytes before running:
metavr --device "$TASK_DEVICE" shell sha256sum /data/app/EXACT_RETURNED_PATH/base.apk
# Installed SHA must match the reviewed APK; stop on mismatch.
metavr --device "$TASK_DEVICE" shell am instrument -w -r com.moyolearn.museprobe/.MuseLiveReadInstrumentation
# Read only this package's private receipt after ready or completion:
metavr --device "$TASK_DEVICE" shell run-as com.moyolearn.museprobe cat files/muse-hid-live-read-test-only.json
```

For descriptor-only collection, replace the class with `.MuseDescriptorInstrumentation` and receipt with `files/muse-hid-report-map-test-only.json`. Do not overlap both classes or multiple collector runs. Wait for actual ready data before asking for controlled physical inputs. Preserve capture timestamps and source hashes; do not infer physical attribution from a delayed confirmation.

Cleanup: allow the collector's finally block to finish, restore the specific paused inspection service, and verify it is usable. If a collector alone is stuck, stop only `com.moyolearn.museprobe` on the selected device. Remove only this disposable package if the operator requests removal; never uninstall or clear `com.moyolearn.app`, change its bond state, or use a destructive reinstall action. Do not remove associations or reset Bluetooth as routine cleanup.

## Rebuilding and interpretation limits

The retained two Java files and manifest are the reviewed source. Compile with the installed SDK36 android.jar, javac release17, d8 min33, aapt2, zipalign and apksigner. Signing material is intentionally not retained here. A rebuild requires a new diagnostic signing identity, can have a new APK hash/signature, and requires review plus explicit correction of the host's pinned identity. Do not promise byte-reproducible output or silently replace the vendor APK.

Successful test reads establish diagnostic access only. Raw force is not calibrated physical pressure, IMU is not tracked pose, and this collector is never a board input producer. Preserve real GATT status and unexpected lengths rather than coercing them into valid samples.
