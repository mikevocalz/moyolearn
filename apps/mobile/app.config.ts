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
    config: {
      // Doc 07 §2.1: the documented setting when the app's only use of
      // encryption is SecureStore/the platform keychain. Declaring it here keeps
      // every App Store submission from stopping on the export-compliance
      // question with an answer someone has to remember.
      usesNonExemptEncryption: false,
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
    /*
      FIRST, and that is load-bearing. It strips the splash-screen ICON item
      that expo-splash-screen writes into styles.xml unconditionally — see the
      plugin's header for the aapt failure it prevents. Mods touching one file
      compose as WRAPPERS: the earliest registration is the outermost, so it is
      the one that gets the last word after the inner mods have written.
    */
    './plugins/with-splash-no-icon',
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
      'expo-splash-screen',
      {
        /*
          NO IMAGE, AND THAT IS THE WHOLE POINT.

          The native splash used to draw the wordmark, so boot was: wordmark,
          then the animated splash drawing its own mark — the logo twice, the
          second one arriving as if the first had not happened. The animated
          mark is DRAWN IN FROM NOTHING; a static copy of the finished thing
          flashing first spoils the reveal it is the beginning of.

          So the native splash is now the PAPER ALONE, which is the animation's
          first frame, and the cut from native splash to canvas has nothing in
          it to see. `MoyoSplash` hides it once it has painted that same ground.

          Same value both schemes: this ground is paper in either, and a splash
          that flips to near-black in dark mode would be a different brand for
          half the users.
        */
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
