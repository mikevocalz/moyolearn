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
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  runtimeVersion: { policy: 'appVersion' },
};

export default config;
