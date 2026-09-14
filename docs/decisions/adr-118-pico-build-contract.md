# ADR-118 · What a PICO build actually requires

Status: accepted · 2026-09-13 · Supersedes nothing; extends ADR-117.

ADR-117 chose the spatial whiteboard's architecture. This one records what it
takes to make that scene reach a PICO 4 Ultra at all, because four separate
things had to be true before a single frame rendered and **each one fails
silently**. Every symptom below was diagnosed on hardware, in this order, and
each looked like a rendering bug until it wasn't.

## The four requirements

### 1. `pvr.app.type` meta-data, or there is no XR session

```xml
<application>
  <meta-data android:name="pvr.app.type" android:value="vr"/>
</application>
```

PICO's runtime reads this **inside `xrCreateInstance`**. Without it the call
returns `XR_ERROR_VALIDATION_FAILURE` and logcat says nothing about why.

The symptom is not an error. With no OpenXR instance, `VRActivity` falls back to
drawing its React root as a **flat 2D window**, so the headset shows the phone UI
floating in the launcher where a scene should be. "The 2D app is in my XR scene"
is this bug, every time.

### 2. A 16KB-aligned `libopenxr_loader.so`

PICO OS 5 on Android 14+ **refuses** a 4KB-aligned loader. `@expo-pico/core`
ships a 16KB-aligned overlay and drops it into `jniLibs`. Nothing else in this
repo supplies one, and `@reactvision/react-viro` does not.

This is why the **main** `@expo-pico/core` plugin is required and its Viro
interop plugin alone is not enough. Verify with
`~/expo-pico/scripts/verify-16kb-alignment.py <apk>`.

### 3. Khronos' manifest, not Meta's

Viro's plugin writes Meta's: `com.oculus.intent.category.VR`,
`horizonos.permission.*`, `com.oculus.supportedDevices`. A PICO knows none of
them. What it needs is:

- `<uses-native-library android:name="libopenxr_loader.so" android:required="false"/>`
  — mandatory once `targetSdkVersion >= 31`
- `org.khronos.openxr.permission.OPENXR` and `OPENXR_SYSTEM` — the runtime broker
- `<queries><provider android:authorities="org.khronos.openxr.runtime_broker;org.khronos.openxr.system_runtime_broker"/></queries>`
  — package visibility from `targetSdkVersion >= 30`

`withPicoOpenXrLoader` writes all four (including §1's meta-data).

### 4. The immersive categories on `.VRActivity`, and nowhere else

`com.pico.intent.category.VR`, the pre-migration `com.picovr.intent.category.VR`,
and Khronos `org.khronos.openxr.intent.category.IMMERSIVE_HMD`, added by
`plugins/with-viro-android-linkage.js`.

**They must not reach `MainActivity`.** An app whose launcher activity is
immersive starts in XR, and this one never may — a learner opens a tutoring app,
reads a problem, and enters the board when they choose to.

### `pvr.app.type` is SCOPED, which is the whole mechanism

This took two wrong turns to see. The plugin writes it twice, at two levels, and
that is not a duplicate:

```xml
<application>                     <meta-data name="pvr.app.type" value="mr"/>
  <activity android:name=".VRActivity">
                                  <meta-data name="pvr.app.type" value="vr"/>
```

- `withPicoLauncherActivity.js` writes the APPLICATION-scope value from
  `appType`, and dedupes it. It declares what the app IS.
- `withPicoVRActivity.js` upserts `vr` scoped to `.VRActivity` alone. It declares
  what that one activity is.

So `appType: 'mr'` with an immersive `.VRActivity` is exactly "a flat panel that
can enter XR", and no override is needed or wanted. Both wrong turns came from
reading the value without its scope:

- `appType: '2d'` opts out of the launcher contract entirely. On device that is a
  black window with the JS runtime up and `Running "main"` in the log — an app
  rendering nowhere. `mr` is what makes PICO composite a panel: the camera feed
  is the background and the app draws on top.
- Forcing application-scope `vr` via `withPicoOpenXrLoader` told PICO the WHOLE
  app was immersive, which is the opposite of a 2D start. That plugin is not used
  here; `@expo-pico/core` owns the loader linkage, as in the example app.

## Plugin order, which is inverted and load-bearing

`withMod` composes mods as a stack: each runs its action then calls the
PREVIOUSLY registered mod. **The last plugin listed edits a file first, and the
first plugin listed edits it last.**

Both PICO plugins are listed BEFORE `@reactvision/react-viro` so they run AFTER
it. `withViroAndroid` does `contents.manifest.queries = [...]` — an assignment,
not a push — so anything that wrote a `<queries>` entry earlier is discarded.
Listed after Viro, the OpenXR broker `<provider>` went in and was thrown away;
the generated manifest kept `pvr.app.type`, both permissions and the
native-library line, and carried only ARCore in `<queries>`.

## Verifying a build, without trusting a claim

```bash
cd apps/mobile && npx expo prebuild --platform android --clean
python3 - <<'PY'
import re, io
m = io.open('android/app/src/main/AndroidManifest.xml').read()
assert 'pvr.app.type" android:value="vr"' in m
assert m.count('org.khronos.openxr.permission') == 2
assert 'org.khronos.openxr.runtime_broker' in m
main_activity = re.search(r'<activity android:name="\.MainActivity".*?</activity>', m, re.S).group(0)
assert 'IMMERSIVE_HMD' not in main_activity   # the launcher stays 2D
vr = re.search(r'<activity android:name="\.VRActivity".*?</activity>', m, re.S).group(0)
assert 'com.pico.intent.category.VR' in vr
print('manifest ok')
PY
find android -name libopenxr_loader.so    # must exist, from the overlay
```

Build and run the **pico flavour**: `./gradlew assemblePicoDebug`, or
`npx expo run:android --variant picoDebug`.

## Reading the device, without fooling yourself

Two mistakes cost hours in the session that produced this ADR, and both produce
confident-looking nonsense:

- **`am start -n <pkg>/.MainActivity` does not open the board.** It restores the
  2D route. `VRActivity` never launches and the screen you screenshot is
  `MainActivity`. Enter the route:
  `adb shell am start -a android.intent.action.VIEW -d "moyo:///tutor-xr"`.
- **`topResumedActivity` in `dumpsys` is not evidence that a scene rendered.**
  Only the frame is. Check `adb shell dumpsys activity activities | grep
  topResumedActivity` to know WHICH activity you are looking at, then look at the
  frame to know what it drew — never the other way round.

`Running "VRQuestScene"` in the Metro log is the honest signal that the immersive
surface started; grep for it rather than inferring.

## Known, still open

The app restores `/tutor-xr` on a cold start, `ViroXRSceneNavigator` mounts and
calls `VRLauncher.launchVRScene()`, and the headset comes up in a black
`VRActivity`. Launching `.MainActivity` bounces straight back, because the
navigator re-launches VR on background→active. Only `am force-stop` plus a
deep link to `moyo:///` breaks out. The XR route must not be restorable on cold
start — that is the fix, and it is JS-side, not plugin-side.

SOT: `~/expo-pico/README.md` · `~/expo-pico/docs/VIRO-ON-PICO.md` ·
`apps/mobile/app.config.ts` · `apps/mobile/plugins/with-viro-android-linkage.js`
