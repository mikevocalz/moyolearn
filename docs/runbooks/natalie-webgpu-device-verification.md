# Runbook — verifying Natalie's WebGPU device hand-off on the iPad

<!--
What it is: how to pick up the device verification for `eedf35c`, which hands
Natalie's renderer a GPUDevice from `GPUDeviceProvider` instead of letting three
request its own. Everything up to "launch the app" works; the app cannot reach
Metro.
Why it exists: the build took four separate fixes to go green and the bring-up
has three moving parts (WDA, Metro, devicectl). Rediscovering any of it costs an
hour. Written 2026-09-18 mid-task.
SOT: docs/issues/2026-09-17-ios-device-build-blocked.md ·
     docs/decisions/adr-121-gpu-device-topology.md
SOT-KEYWORDS: runbook handoff ipad wda webdriveragent metro devicectl natalie
              webgpu device graphite verification blocked
-->

**Branch:** `upgrade/expo-sdk-58-beta` at `a8b3a3c`. Tree clean, `pnpm lint` 0,
`turbo build typecheck lint test --force` 54/54.

**The one thing being verified:** `eedf35c` makes `tutor-avatar-3d.native.tsx`
take its device from `GPUDeviceProvider`/`useMainDevice` rather than letting
`WebGPURenderer` request one nobody can reach. Typecheck and lint cannot answer
whether she still draws. Nothing else in this runbook matters except as a means
to seeing that.

## Decide this first, because it changes the build

`4ed6b8c` turned Skia's Graphite backend on. **With Graphite on, the iOS build
does not complete.** With it off, the same tree builds clean and installs.

```
Graphite ON   → RNDawnWindowContext.h:7  fatal error: 'dawn/native/MetalBackend.h' file not found
Graphite OFF  → ** BUILD SUCCEEDED **  0 errors
```

The header ships nowhere: Skia's package has its own Graphite-Dawn interface
headers but no upstream Dawn ones, its `libdawn_combined.xcframework` carries
zero headers, and react-native-webgpu's device slice has `NullBackend.h`,
`OpenGLBackend.h` and `VulkanBackend.h` but not Metal. `react-native-webgpu` is
at `0.10.2`, the newest published, with no `next` tag — this is not a version
behind.

Two ways forward, and it is a product call rather than a technical one:

- **Revert `4ed6b8c`** and re-land when upstream ships the header. Gets a
  working iOS build today; Skia renders on Ganesh, which links no Dawn, so
  ADR-121's Option A stays unmeasurable.
- **Keep Graphite** and verify on Android instead — except the Android build is
  blocked separately (`d38e634`, Kotlin plugin double-registration on Expo SDK
  58 preview.3).

To flip it off locally without touching the commit:

```bash
mv node_modules/@shopify/react-native-skia/libs/.graphite /tmp/graphite.bak
rm -f node_modules/@shopify/react-native-skia/libs/ios/.version   # or the copy is skipped
cd apps/mobile/ios && ~/.rbenv/shims/pod install                  # expect SK_GRAPHITE: OFF
```

Both variants are `154.0.0`, so the podspec skips its framework copy unless that
`.version` marker is deleted — without it you get Graphite defines against
Ganesh binaries and nothing says so.

## Bring-up

**Use `~/.rbenv/shims/pod`, never `pod`.** `/usr/local/bin/pod` is CocoaPods
1.16.2 on system Ruby 2.6; Expo's scripts call `Array#filter_map` (2.7+), fail
silently, and report "Precompiled modules enabled but no xcframeworks found",
which reads as a config problem and is not one.

```bash
# 1. Pods. After any config change two local podspecs go stale; this is expected.
cd apps/mobile/ios
~/.rbenv/shims/pod install
~/.rbenv/shims/pod update ReactNativeDependencies React-Core-prebuilt --no-repo-update

# 2. Build for the iPad (~9 min). Check `df -h /System/Volumes/Data` first —
#    at 95% full the build dies with 97 bogus "SwiftCompile failed" lines whose
#    real cause is `database or disk is full`.
xcodebuild -workspace Moyo.xcworkspace -scheme Moyo -configuration Debug \
  -destination 'id=00008027-001624E01EE3002E' \
  -derivedDataPath /tmp/moyo-dd -allowProvisioningUpdates build

# 3. Install. Uninstall first so the screenshot is never read against an
#    unknown binary.
xcrun devicectl device uninstall app --device FEDB7E5C-2EB7-5925-97B9-7096138FA4FF com.moyolearn.app
xcrun devicectl device install app --device FEDB7E5C-2EB7-5925-97B9-7096138FA4FF \
  /tmp/moyo-dd/Build/Products/Debug-iphoneos/Moyo.app

# 4. Metro, on 8081 — the app's baked ip.txt points there.
cd apps/mobile && EXPO_UNSTABLE_MCP_SERVER=1 npx expo start --clear --port 8081

# 5. Launch.
xcrun devicectl device process launch --device FEDB7E5C-2EB7-5925-97B9-7096138FA4FF com.moyolearn.app
```

### WebDriverAgent, for screenshots

argent does not enumerate physical iPads, so drive WDA over HTTP directly. It is
already built at `/tmp/wdadd`; rebuild only if that is gone.

```bash
# Rebuild only if /tmp/wdadd is missing (~4 min)
cd ~/WebDriverAgent && xcodebuild -project WebDriverAgent.xcodeproj \
  -scheme WebDriverAgentRunner -destination "id=00008027-001624E01EE3002E" \
  -allowProvisioningUpdates DEVELOPMENT_TEAM=YWGV898K5D \
  -derivedDataPath /tmp/wdadd build-for-testing

# Start the runner. It exits after a while; restart it when /status stops answering.
cd ~/WebDriverAgent && nohup xcodebuild test-without-building \
  -xctestrun /tmp/wdadd/Build/Products/WebDriverAgentRunner_iphoneos*.xctestrun \
  -destination "id=00008027-001624E01EE3002E" > /tmp/wda-run.log 2>&1 &
grep -oE 'ServerURLHere->http://[0-9.]+:8100' /tmp/wda-run.log   # prints the URL

curl -s http://192.168.1.66:8100/status
curl -s http://192.168.1.66:8100/screenshot | python3 -c \
  "import sys,json,base64;d=json.load(sys.stdin);open('/tmp/s.png','wb').write(base64.b64decode(d['value']))"
```

## Where it stops

The app installs and launches and shows:

```
No script URL provided. Make sure the packager is running or you have embedded
a JS bundle in your application bundle.
unsanitizedScriptURLString = (null)
```

Traced through `node_modules/react-native/React/Base/RCTBundleURLProvider.mm`:
`guessPackagerHost` (line 207) reads `ip.txt`, then returns nil unless
`isPackagerRunning:` succeeds; that probe (line 97) GETs `<host>/status` and
requires the body to equal `packager-status:running` exactly.

Every link checks out from the Mac:

| Check | Result |
|---|---|
| `ip.txt` inside the built `.app` | `192.168.1.169` — matches the Mac |
| `curl http://192.168.1.169:8081/status` | `packager-status:running`, exact |
| `curl .../.expo/.virtual-metro-entry.bundle?platform=ios&dev=true` | `200`, 45,046,469 bytes |
| macOS application firewall | disabled |
| `lsof -nP -iTCP:8081 -sTCP:LISTEN` | `node *:8081` — all interfaces |
| `grep -c '192.168.1.66' <metro log>` | **0 — the iPad has never reached Metro** |

Mac→iPad works (`ping 192.168.1.66`, 0% loss, though at 97-116 ms, which is not
a normal LAN round trip). iPad→Mac is the direction that fails. That is network
topology, not code — check both are on the same SSID without client isolation,
and watch the Metro log for a request from `192.168.1.66` as the signal.

If they cannot be put on one network, the alternative is forwarding 8081 over
USB with `ios forward 8081 8081 --udid 00008027-001624E01EE3002E` — but note
`guessPackagerHost` only falls back to `localhost` when `ip.txt` is ABSENT, so
that path needs `ip.txt` removed from the built app or the probe will keep
asking for `192.168.1.169`.

## What to look for once it loads

Natalie on the tutor stage. If she renders, `eedf35c` holds and ADR-121's
prerequisite is met. If the pane is black, the device hand-off is where to look
first — the renderer now refuses to construct without a device
(`fail('GPUDeviceProvider mounted the stage without a device')`) rather than
silently requesting its own, so that message in the logs is the tell.

## Fixed along the way, so nobody re-finds them

| | |
|---|---|
| CocoaPods on Ruby 2.6 | `~/.rbenv/shims/pod`, see above |
| `react-native-video` 7.0.0-beta.11 | Removed. Does not build against RN 0.88.0-rc.0, nothing newer published, and no file imported it. Why it was chosen is preserved in `app.config.ts`. |
| `react-native-enriched-html` | Used by four files, so header-search fix in the Podfile rather than removal |
| Skia Graphite's Dawn headers | Podfile points Skia at react-native-webgpu's xcframework slice; the package's `cpp/` has only `webgpu_cpp.h`, not the `dawn/` tree |
| three r186 `QuadMesh` | The leak workaround it broke was deleted, not patched — r186 caches the quad per renderer, so the module-level object it reached for is gone |

## Still open elsewhere

Android build: Kotlin plugin double-registration (`d38e634`). ADR-121 and
ADR-122 are `proposed` and need Scenario J/K numbers from hardware, which is
what this runbook exists to unblock.
