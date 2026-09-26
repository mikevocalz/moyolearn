# The iOS device build, and the three walls between here and an app on hardware

<!--
What it is: an account of what stops `apps/mobile` building for a physical iOS
device on this machine, with the one wall that is fixed separated from the two
that are not.
Why it exists: the WebGPU device change in `eedf35c` cannot be verified without
an app on hardware, and the reasons it cannot be built are worth writing down
once rather than rediscovering per attempt. One of them is a toolchain fault
that makes an unrelated failure look like a configuration problem.
SOT: apps/mobile/ios/Podfile · apps/mobile/ios/Podfile.properties.json
SOT-KEYWORDS: ios build cocoapods ruby filter_map precompiled xcframework
              prebuilt react core header search paths device ipad blocked
-->

Filed: 2026-09-17 · Found on `upgrade/expo-sdk-58-beta` · Status: iOS simulator app builds as of 2026-09-23; device build unverified since, Android still open
Device: `william's iPad (2)`, iPad8,7, iPadOS 26.7, wired, developer mode on

## Fixed — CocoaPods was running on Ruby 2.6

`pod install` printed this for every module and then carried on:

```
[!] [Expo-precompiled] Failed to read spm.config.json at …/unimodules-app-loader/spm.config.json:
    undefined method `filter_map' for []:Array
```

`Array#filter_map` is Ruby 2.7. `/usr/local/bin/pod` is shebanged to
`/System/Library/Frameworks/Ruby.framework/Versions/2.6/usr/bin/ruby` and is
CocoaPods **1.16.2**, while rbenv has **1.17.0** on Ruby 3.4.2 at
`~/.rbenv/shims/pod`.

Every `spm.config.json` read failed, so Expo's precompiled-module list came back
empty and the install reported *"Precompiled modules enabled but no xcframeworks
found"*. That reads as a configuration problem and is not one — it is the wrong
Ruby, and the message never says so.

Running `~/.rbenv/shims/pod install` fixes it: the RN core tarballs download,
checksums verify, and `React-Core-prebuilt` installs with its headers. Two local
podspecs then need `pod update ReactNativeDependencies React-Core-prebuilt
--no-repo-update` once, after which the install exits 0.

**Use `~/.rbenv/shims/pod`, not `pod`, in this repo.**

## Update 2026-09-18 — four walls cleared, one left, and it is not ours

Working through them in order got the build from "fails immediately" to "fails
inside Skia's Graphite bridge". Each step below is a separate cause, not a
retry of the last.

1. **CocoaPods on Ruby 2.6** — fixed, see below. Use `~/.rbenv/shims/pod`.
2. **`react-native-video` 7.0.0-beta.11** — removed. It does not compile against
   RN 0.88.0-rc.0, `latest` still points at the 6.19.2 stable line so there is
   nothing to move to, and **no file imported it**: `grep` across every
   extension in `packages`, `apps` and `tooling` found it only in
   `apps/mobile/package.json` and one Expo plugin entry. Every `<Video />` in the
   app is the lucide icon from `@acme/ui/icons`; recording goes through
   `react-native-vision-camera`. The reasoning for choosing it — Bunny Stream
   HLS, one video stack rather than two — is preserved in `app.config.ts` where
   the plugin entry used to be, so putting it back is a decision rather than
   archaeology.
3. **`react-native-enriched-html`** — this one is used, by `NotesEditor.tsx`,
   `NoteBody.tsx`, `capabilities.ts` and a story, so it gets the header-search
   fix rather than removal. It imports RN headers flat and the prebuilt core
   keeps them inside `React.xcframework/ios-arm64/React.framework/Headers`.
4. **Skia Graphite's Dawn headers** — partially fixed. With
   `react-native-webgpu` installed, Skia stops vendoring Dawn entirely
   ("react-native-webgpu detected, Dawn is provided by its libwebgpu_dawn", and
   its own framework list drops `libwebgpu_dawn`), but its `HEADER_SEARCH_PATHS`
   still points at `cpp/dawn/include` in its own package — a directory only
   `install-skia-graphite` populates, and that script is not in the published
   package. The link is wired and the compile is not, which is why the Dawn
   version guard passes and the build still fails. Pointing Skia at
   react-native-webgpu's headers resolves `webgpu/webgpu_cpp.h` and then
   `dawn/native/DawnNative.h` — note the package's `cpp/` directory carries only
   the first of those, so the full tree in
   `libs/apple/libwebgpu_dawn.xcframework/ios-arm64/Headers` is the right root.

### The wall that was left — fixed 2026-09-23

```
node_modules/@shopify/react-native-skia/cpp/rnskia/RNDawnWindowContext.h:7:10:
  fatal error: 'dawn/native/MetalBackend.h' file not found
```

Neither guess above was the answer. The published package is missing two
directories that upstream's unpublished `install-skia-graphite` fills from one
release asset, `skia-graphite-headers-skia-graphite-m154.tar.gz` on
`Shopify/react-native-skia`: `cpp/dawn/include` (the full Dawn header set —
`MetalBackend.h` included, ten backends where react-native-webgpu's xcframework
ships five) and `cpp/skia/src/gpu/graphite` (`ContextOptionsPriv.h`, which
`RNDawnContext.h` includes and which would have been the next error).
react-native-webgpu was never going to have it: its `webgpu/webgpu_cpp.h` is a
33-line shim over `dawn/webgpu_cpp.h`, and its header set is the public WebGPU
surface, not Dawn's backend headers. The tarball's `dawn/dawn_version.h` is
`3d786993…`, the commit chrome/m154 pins and the one react-native-webgpu's
`dawn-chrome-m154` binary was built from, so compiling against it and linking
webgpu's `libwebgpu_dawn.a` is one Dawn, not two.

`tooling/enable-skia-graphite.mjs` now downloads that tarball (sha256 pinned)
into both directories, and writes `libs/.dawn-version` — the podspec's one-Dawn
guard is wrapped in `if File.exist?(dawn_marker)`, nothing in the published
package wrote it, so the "Dawn version guard passes" line above was the guard
never running. `pod install` now prints `Dawn versions match (dawn-chrome-m154)`.
The Podfile block that pointed Skia at react-native-webgpu's headers is deleted;
it resolved the first include and could never resolve this one.

Verified: `xcodebuild -scheme react-native-skia -sdk iphonesimulator` succeeds,
compiling `RNDawnWindowContext.cpp` and `RNDawnInterop.cpp` with
`SK_GRAPHITE=1` and no `SK_GANESH=1`, `-I…/cpp/dawn/include` on the command
line. `SK_GRAPHITE: ON` from pod install (the "OFF" noted at the bottom of this
doc predates `4ed6b8c`). The full `Moyo` scheme then builds for
`generic/platform=iOS Simulator` with the enriched-html header patch still in
place — the third-party-pod section below was written against the device SDK
and has not been re-run there.

## Open — third-party pods against RN 0.88.0-rc.0's prebuilt core

With the install healthy, the build fails on packages that assume React-Core was
built from source. Three found so far, all the same shape:

| Pod | Failure |
|---|---|
| `react-native-enriched-html` 1.1.1 | `'UIView+React.h' file not found` — it imports RN headers flat; under the prebuilt core they are inside `React-Core-prebuilt/React.xcframework/<slice>/React.framework/Headers` |
| `react-native-video` | `could not build Objective-C module 'ReactNativeVideo'` · `declaration of 'facebook' must be imported from module 'ReactNativeHeaders_react' before it is required` · `missing '#include "jsi/jsi.h"'` |
| `RNSentry` | `'Sentry/Sentry.h' file not found` — this one appears on the *source* path, taken by setting `EXPO_USE_PRECOMPILED_MODULES=0` |

A header-search-path patch in `post_install` clears the first one and the build
then reaches the second. That is the shape of a losing game: the fix is per-pod,
it edits config every developer shares, and each one only reveals the next. Not
committed — `apps/mobile/ios/` is back at its committed state.

Two details worth keeping, because both cost an attempt:

- An xcconfig does not concatenate duplicate keys. Appending a second
  `HEADER_SEARCH_PATHS` line **replaces** the generated one, and `$(inherited)`
  on it refers to the target level rather than to the earlier line in the same
  file — so the pod silently loses every path CocoaPods gave it.
- Xcode expands `**` only as a trailing component. A `**` in the middle of a
  path matches nothing and looks exactly like the setting not being applied.

## Open — the Android half

`./gradlew :app:assembleDebug` needs the wrapper at 9.4.1 (`d38e634` does that;
AGP refuses to load under 9.3.1) and then fails at `app/build.gradle` line 2:
`Cannot add extension with name 'kotlin', as there is an extension already
registered with that name`. That file applies the Kotlin plugin exactly once.
Expo prebuild output; an AGP/Kotlin-plugin collision.

## What this blocks, and what it does not

Blocked: confirming that `eedf35c` — Natalie's renderer taking a device from
`GPUDeviceProvider` instead of requesting its own — still draws her. Typecheck
and lint pass and neither can answer that.

Not blocked: device control. WebDriverAgent builds and runs against the iPad and
answers over HTTP —

```
GET http://192.168.1.66:8100/status      device "ipad", iPadOS 26.7, WDA 16.1.7
GET http://192.168.1.66:8100/screenshot  6.2 MB PNG
```

built from `~/WebDriverAgent` with
`-destination "id=00008027-001624E01EE3002E" -allowProvisioningUpdates
DEVELOPMENT_TEAM=YWGV898K5D`, then `test-without-building` against the generated
`.xctestrun`. argent does not enumerate physical iPads, so drive WDA directly.

## One more thing the install said

`-- SK_GRAPHITE: OFF (detected via libs/.graphite marker file)`

Skia's Graphite backend is off in this pod configuration. ADR-121's Option A
adopts Graphite's device, so that flag has to be understood before that option
can be measured — it is not obviously a defect, but nothing has checked it.

## Environment

```
pod  /usr/local/bin/pod        1.16.2 on Ruby 2.6   <- the trap
pod  ~/.rbenv/shims/pod        1.17.0 on Ruby 3.4.2 <- use this
ruby 3.4.2 (rbenv, .ruby-version)
Xcode iPhoneOS26.4.sdk · disk was at 95%, which surfaced as 97 spurious
  "SwiftCompile failed" lines whose real cause was `database or disk is full`
```
