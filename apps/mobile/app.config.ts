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
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
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
    'expo-screen-capture',
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
