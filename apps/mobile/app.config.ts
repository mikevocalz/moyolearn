import { withPicoOpenXrLoader } from '@expo-pico/core/plugin/viro';
import type { ExpoConfig } from 'expo/config';
import { loadProjectEnv } from '@expo/env';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { palette } from '@acme/theme';

const appDir = dirname(fileURLToPath(import.meta.url));
loadProjectEnv(join(appDir, '../..'), { silent: true, force: true });

const config: ExpoConfig = {
  name: 'Moyo',
  slug: 'moyo',
  scheme: 'moyo',
  // Source of truth is apps/mobile/package.json "version" — keep the two in sync by hand.
  // (Not read dynamically: runtimeVersion policy 'appVersion' derives OTA runtime versions
  // from this field, so it must stay a literal the config loader can resolve without I/O.)
  version: '1.0.0',
  orientation: 'default',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.moyolearn.app',
    supportsTablet: true,
    /*
      ONE STRING PER PERMISSION, covering every use a reviewer will meet. iOS
      shows a purpose string once, whatever asks for the camera — the homework
      photograph and placing the spatial whiteboard in the room are both the
      camera to the system — so it names both rather than describing whichever
      feature happened to ask first. Set here rather than on a plugin because
      `ios.infoPlist` is what the Viro plugin itself falls back FROM.
    */
    infoPlist: {
      NSCameraUsageDescription:
        'Moyo uses the camera so you can photograph your homework, and to place your whiteboard in the room.',
    },
    config: {
      // Doc 07 §2.1: the documented setting when the app's only use of
      // encryption is SecureStore/the platform keychain. Declaring it here keeps
      // every App Store submission from stopping on the export-compliance
      // question with an answer someone has to remember.
      usesNonExemptEncryption: false,
    },
    /*
      THE SOURCE OF `ios/Moyo/PrivacyInfo.xcprivacy`. Until this block existed
      there wasn't one: the manifest was committed under `ios/` and nothing
      regenerated it, so `expo prebuild --clean` deleted it and the next upload
      would have failed ITMS-91053 — an upload-time rejection, which nothing
      reaches review from. The diff that hid it was one deleted file in a
      directory people skim.

      This is `ios.privacyManifests`, which `@expo/prebuild-config` runs as part
      of its default plugin set (IOSConfig.PrivacyInfo.withPrivacyInfo). It
      writes the plist AND adds it to the Xcode target as a resource, which a
      hand-written `withDangerousMod` would have to redo by hand. No plugin file
      under `plugins/` is needed, and `expo-build-properties` does NOT cover it —
      its `privacyManifestAggregationEnabled` flag only merges the manifests that
      CocoaPods dependencies ship for themselves.

      Every reason below is traced to code that actually calls the API. An
      undeclared reason is a rejection; a declared one nothing uses is a
      misdeclaration a reviewer can hold against the App Privacy labels.
    */
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          // react-native-mmkv writes through NSUserDefaults, as does React
          // Native's own settings manager. CA92.1 = data readable only by this
          // app, which is what both do.
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          /*
            C617.1 — files inside the app container: expo-file-system on the
            upload path (features/media/transport.native.ts) and on the board
            export (features/tutor/board-image.native.ts), AND the vendored Viro
            renderer, whose ViroKit.framework binary imports `stat` and `fstat`
            to read its own bundled shaders, textures and .mlmodelc assets.
            That fork ships no PrivacyInfo.xcprivacy of its own — it is a
            framework we vendor, so its required-reason APIs are ours to declare
            here (see vendors/README.md).
            3B52.1 — files the guardian picks explicitly (expo-image-picker).
            0A2A.1 — third-party file-management on the app's behalf.
          */
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['0A2A.1', '3B52.1', 'C617.1'],
        },
        {
          // The upload path checks for room before it writes a 40 MB voice note
          // (E174.1) and reports space in diagnostics (85F4.1). Viro needs
          // neither: its binary references no statfs/statvfs/volume-capacity key.
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1', '85F4.1'],
        },
        {
          // 35F9.1 = elapsed time between in-app events and timers.
          // @sentry/react-native reads boot time to order events, and ViroKit
          // calls `mach_absolute_time` as its frame clock.
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
      ],
      // No SDK on a learner's device tracks anyone: there is no ad SDK, no
      // attribution SDK, no expo-tracking-transparency and no
      // NSUserTrackingUsageDescription. Sentry runs with `attachScreenshot:
      // false` and every event through `scrubTelemetryEvent`.
      NSPrivacyTracking: false,
    },
  },
  android: {
    package: 'com.moyolearn.app',
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: palette.ink[50],
    },
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    /*
      react-native-video 7 is a Nitro module, so it needs native config — it is
      not autolinked into a prebuilt binary by itself. Registering the plugin
      here means `expo prebuild` writes the native bits; without it the JS
      imports resolve and the component fails at runtime, which reads as a
      broken player rather than a missing build step.

      It plays Bunny Stream's HLS output. `expo-video`/`expo-av` are deliberately
      absent — one video stack, not two.
    */
    /*
      VIRO HAS TO BE REGISTERED OR THE SPATIAL WHITEBOARD CANNOT EXIST.
      The fork ships `app.plugin.js`, and without it in this array `prebuild`
      writes no pods and no Gradle linkage, so `VRTSceneNavigatorModule` never
      registers. `xr-capability.ts` checks for exactly that module and fails
      closed, `XrBoardButton` returns null, and the whole feature is invisible
      on a device while every test on the branch stays green — the failure has
      no symptom short of a build.

      `AR` because the board is placed in the room: `ViroXRSceneNavigator` with
      a `ViroARScene` is the passthrough path on Quest and the ARKit/ARCore path
      on a phone. The camera string covers BOTH uses a reviewer will see — the
      homework photograph and placing the paper — because iOS shows one string
      per permission, not one per feature.

      THE OPTION IS NESTED UNDER `android`, AND IT WAS NOT.
      `ViroConfigurationOptions` (the fork's `dist/plugins/withViro.d.ts`) puts
      `xRMode` under `android`, and every one of the four places
      `withViroAndroid` reads it spells it `viroPlugin[1]?.android?.xRMode`. A
      top-level `xRMode` is not a key the plugin has, so it was discarded in
      silence and the module default `["AR", "GVR"]` was written instead —
      verified by reading the generated `MainApplication.kt`, which registered
      `ViroPlatform.AR` and `ViroPlatform.GVR`. `plugins` is typed loosely
      enough that TypeScript could not see it, and nothing else can: the only
      symptom is in generated files nobody reads.

      `QUEST` IS WHAT MAKES A HEADSET ELIGIBLE, AND IT IS NOT OPTIONAL.
      `hasOpenXRSupport` is `NativeModules.VRModuleOpenXR !== undefined`, and
      `ReactViroPackage.createNativeModules` constructs `VRModuleOpenXR` on the
      `QUEST` branch alone (confirmed by disassembling the shipped
      `react_viro-release.aar`). Without it `spatialEligibility` answers
      `no-xr-runtime` on every headset there is, which is the whole feature
      switched off. `PICO` is NOT used even though the plugin's `XrMode` union
      accepts it: the enum inside that same AAR is `GVR | OVR_MOBILE | AR |
      QUEST` with no `PICO` member, so emitting it writes a `MainApplication.kt`
      that does not compile. QUEST is the OpenXR path and PICO is an OpenXR
      headset; the fork's own `ViroXRSceneNavigator` routes `isQuest || isPico`
      down the same branch.

      `GVR` is dropped with it. It adds the Cardboard and Daydream launcher
      categories to a children's app that has no phone-VR mode, and Daydream has
      not existed since 2019.
    */
    /*
      IT REPAIRS VIRO'S GRADLE OUTPUT, SO IT IS LISTED BEFORE VIRO. That reads
      backwards and is not a mistake: `withMod` composes mods as a stack —
      `action(...)` runs and then calls `nextMod(results)`, which is the
      PREVIOUSLY registered mod — so the last plugin in this array edits
      `settings.gradle` first and the first plugin edits it last. Registering
      this after Viro ran it before Viro, and its guard caught exactly that
      ("expected @reactvision/react-viro's config plugin to have written
      projectDir ... It did not").

      What it repairs: the fork's shim projects declare a `device` flavour
      dimension the app module has none of, and its `settings.gradle` paths
      assume `node_modules` sits beside the app, which `node-linker=hoisted`
      means it does not. Both in the plugin's header.
    */
    /*
      THE ONE LINE THAT MAKES PICO OPEN AN XR SESSION AT ALL.

      `pvr.app.type` is meta-data PICO's runtime reads INSIDE `xrCreateInstance`.
      Without it the call returns `XR_ERROR_VALIDATION_FAILURE` and nothing in
      logcat says why; virocore's macro then discards the `XrResult`, dereferences
      a null `XrInstance` and takes the process down — or, with the Fabric path,
      leaves `VRActivity` showing its React root as a flat window. A 2D app
      floating in the headset's launcher IS the symptom: the immersive session
      never started, so what is on screen is the panel, not the scene.

      The manifest this app already had was Meta's — `com.oculus.intent.category.VR`,
      `horizonos.permission.*`, `com.oculus.supportedDevices` — written by Viro's
      own plugin for Quest. A PICO ignores every one of them. What it needs is
      Khronos': the `libopenxr_loader.so` native-library declaration (required once
      `targetSdkVersion >= 31`), `org.khronos.openxr.permission.OPENXR` and
      `OPENXR_SYSTEM` for the runtime broker, the broker's `<provider>` in
      `<queries>` for package visibility, and that `pvr.app.type` meta-data.

      `withPicoOpenXrLoader` writes exactly those four, into the MAIN manifest so
      Viro's own `quest` flavour source set inherits them — Android source sets are
      siblings, not parents, which is why writing them into a pico flavour would
      not reach the flavour Viro compiles. It is idempotent, so prebuild may run
      any number of times.

      ONLY THIS PLUGIN, NOT `@expo-pico/core` ITSELF. The full plugin restructures
      the Android build into `pico`/`mobile` product flavours and takes over the
      launcher activity; this app already builds, installs and runs on the headset
      through Viro's own flavour plumbing, and the failure being fixed is four
      manifest entries. Adopting the flavour model is a separate, bigger change —
      and the place to do it is here, in one line, when there is a reason.

      LISTED BEFORE VIRO, WHICH IS WHY IT RUNS AFTER IT — the same inversion the
      linkage plugin below documents. `withViroAndroid` does
      `contents.manifest.queries = [...]`, an ASSIGNMENT, so whatever wrote a
      `<queries>` entry earlier is discarded. Listed after Viro, the OpenXR
      broker `<provider>` went in and was then thrown away — verified in the
      generated manifest, which kept `pvr.app.type`, both permissions and the
      native-library line but carried only ARCore in `<queries>`.

      SOT: ~/expo-pico/docs/VIRO-ON-PICO.md · node_modules/@expo-pico/core/plugin/build/viro
    */
    /*
      THE PICO CONFIGURATION ITS README SPECIFIES, WITH A 2D LAUNCHER.

      `xrMode: 'pico-os5'` — the headset is a PICO 4 Ultra, which ships PICO OS
      5. That value is not bookkeeping: PICO OS 5 on Android 14+ REFUSES a
      4KB-aligned `libopenxr_loader.so`, and shipping the 16KB-aligned overlay is
      what this plugin does about it. Nothing else in this repo supplies one.

      `buildVariant: 'pico'` writes the pico product flavour, which is the
      documented way to get PICO's Gradle and manifest wiring.

      `appType: '2d'` OPTS OUT OF THE IMMERSIVE LAUNCHER, and that is deliberate
      against the README's own example. A learner opens a tutoring app, reads a
      problem, and enters the board when they choose to — the app must come up as
      a flat panel every time. `appType: 'vr'` puts the immersive categories on
      the LAUNCHER activity, which is what makes a headset start an app in XR.
      Those categories belong on `.VRActivity` alone, and
      `with-viro-android-linkage` puts them exactly there.

      `pvr.app.type` still has to read `vr` — it is what PICO's runtime checks
      inside `xrCreateInstance`, and it says nothing about how the app launches.
      `withPicoOpenXrLoader` writes that value and is listed so it runs last, so
      it wins over the `2d` this plugin would otherwise leave.

      Capabilities are declared, not assumed: hand tracking and passthrough are
      the two the board actually uses. PICO Store review flags over-declared
      features — the plugin's README says so.

      SOT: ~/expo-pico/README.md · ~/expo-pico/packages/expo-pico-core/README.md
    */
    [
      '@expo-pico/core',
      {
        xrMode: 'pico-os5',
        appType: '2d',
        buildVariant: 'pico',
        handTracking: true,
        passthrough: true,
      },
    ],
    withPicoOpenXrLoader,
    './plugins/with-viro-android-linkage',
    [
      '@reactvision/react-viro',
      { android: { xRMode: ['AR', 'QUEST'] } },
    ],
    'react-native-video',
    /*
      Nitro-backed fetch: Cronet on Android, URLSession on iOS, so HTTP/2 and
      HTTP/3-over-QUIC and connection reuse come from the platform rather than
      RN's own stack. It ships a config plugin despite the README not saying so,
      and it needs it — without the native side wired, `prefetchOnAppStart` has
      nothing to run before JS starts, which is the whole reason it is here.
    */
    'react-native-nitro-fetch',
    /*
      The native WebGPU surface (ADR-111). Registering the plugin is what makes
      `expo prebuild` link Dawn and the WebGPU view; the JS side imports fine
      without it and then fails at first render, which reads as a broken avatar
      rather than a missing native build.

      Presence here does NOT turn 3D on. The runtime gate is the avatar tier
      store, which ships OFF: `packages/avatar/src/tutor-stage.ts` keeps the 2D
      mark up from frame one and promotes only on a real first rendered frame.
      This plugin only makes promotion possible.
    */
    'react-native-webgpu',
    // Must follow the line above: it is the same requirement, and Dawn's use of
    // AHardwareBuffer will not compile below API 26. See the plugin's header.
    './plugins/with-webgpu-min-sdk',
    [
      'expo-build-properties',
      {
        ios: {
          /*
            NOT A PREFERENCE — `react-native-executorch`'s podspec declares
            `:ios => '17.0'`, and the Podfile expo generates defaults to 16.4,
            so `pod install` fails outright on a clean prebuild:

              CocoaPods could not find compatible versions for pod
              "react-native-executorch" ... higher minimum deployment target.

            It is set HERE rather than in the Podfile because the Podfile is
            generated: `platform :ios, podfile_properties['ios.deploymentTarget']`
            reads this value, and a number edited into `ios/` directly is gone
            at the next `expo prebuild`. The android half is deliberately left
            alone — `with-webgpu-min-sdk` owns that floor.

            The cost is real and worth naming: iOS 16 devices are dropped. That
            is not this line's decision, it is executorch's, and executorch is
            what reads a child's homework on-device (`read-attachment.native`)
            and transcribes their voice without either leaving the phone. The
            alternative is sending both to a server.
          */
          deploymentTarget: '17.0',
        },
        android: {
          /*
            PINNED BECAUSE THE HEADSET BUILD WAS MADE AT 34, NOT BECAUSE 34 WAS
            CHOSEN. The APK that installs and runs on the PICO 4 Ultra was built
            with `android.targetSdkVersion=34` hand-written into
            `android/gradle.properties`, and that file is REGENERATED by
            `expo prebuild` (see `plugins/with-webgpu-min-sdk.js`, which exists
            for exactly this reason) — so the next `--clean` would have silently
            handed the app back Expo's default target and changed the platform
            behaviour under a renderer that has never run on hardware at any
            other value.

            What is NOT known: whether the default target works on Horizon OS /
            PICO. Nobody tried it. This line preserves the one configuration
            with evidence behind it; raising it is a change to make deliberately,
            with a headset in hand, not by deleting a line.
          */
          targetSdkVersion: 34,
        },
      },
    ],
    [
      'expo-splash-screen',
      {
        /*
          A TRANSPARENT ICON, WHICH IS THE ONLY WAY TO HAVE NONE.

          The native splash used to draw the wordmark, so boot was: wordmark,
          then the animated splash drawing its own mark — the logo twice, the
          second one arriving as if the first had not happened. The animated
          mark is ASSEMBLED FROM NOTHING; a static copy of the finished thing
          flashing first spoils the reveal it is the beginning of.

          Dropping `image` does not remove it. Android 12+ draws the system
          splash itself and falls back to the LAUNCHER ICON when no animated
          icon is named — and this app's launcher icon is the wordmark, so the
          logo came back by a different route, with no config left to point at.
          An 8x8 fully transparent PNG is the icon instead: the platform gets
          its drawable, and the drawable is nothing.

          So the native splash is the PAPER ALONE, which is the animation's
          first frame, and the cut from it to the canvas has nothing in it to
          see. `MoyoSplash` hides it once it has painted that same ground.

          Same value both schemes: this ground is paper in either, and a splash
          that flips to near-black in dark mode would be a different brand for
          half the users.
        */
        image: './assets/images/splash-blank.png',
        imageWidth: 8,
        backgroundColor: palette.ink[50],
        dark: { backgroundColor: palette.ink[50] },
      },
    ],
    [
      'expo-font',
      {
        fonts: [
          '../../packages/assets/fonts/ArchivoBlack-Regular.ttf',
          '../../packages/assets/fonts/SpaceGrotesk-Variable.ttf',
          '../../packages/assets/fonts/ChivoMono-Variable.ttf',
          '../../packages/assets/fonts/ChivoMono-Italic-Variable.ttf',
        ],
      },
    ],
    'expo-image',
    [
      'expo-secure-store',
      {
        // Doc 07 §2.1: Android Auto Backup must exclude the secure prefs, for
        // the same reason every entry is `THIS_DEVICE_ONLY` on iOS — session
        // material must never restore onto a different device. This is the
        // plugin's default; it is written out because a default that is a
        // security control should be visible in the config, not inferred.
        configureAndroidBackup: true,
        // Read on the parent gate (§2.3), so the prompt is worded for the adult
        // being asked rather than with the module's generic default.
        faceIDPermission: 'Confirm it is you before opening billing, permissions, or your child’s AI activity.',
      },
    ],
    'expo-updates',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  runtimeVersion: { policy: 'appVersion' },
  updates: {
    // Doc 07 §2.5: end-to-end code signing on from day one. The certificate is
    // committed (it is public by construction); `keys/` is gitignored and the
    // private key belongs in KMS — see docs/runbooks/update-signing-rotation.md.
    // Certificate validity is one year deliberately: the Expo docs' own guidance
    // is that shorter validity limits the blast radius of a compromised key.
    codeSigningCertificate: './certs/certificate.pem',
    codeSigningMetadata: { keyid: 'main', alg: 'rsa-v1_5-sha256' },
  },
};

export default config;
