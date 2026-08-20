import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-vite';
import react from '@vitejs/plugin-react';
import reactNativeWeb from 'vite-plugin-react-native-web';

const here = dirname(fileURLToPath(import.meta.url));

// Stories live co-located with components in packages/* (§3.2);
// this app only configures and aggregates.
const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  addons: ['@storybook/addon-a11y'],
  stories: [
    '../../../packages/ui/*.stories.@(ts|tsx)',
    '../../../packages/ui/primitives/*.stories.@(ts|tsx)',
    // packages/app has no stories yet, and Storybook warns on every pattern
    // that matches nothing. Re-add this line when the first feature story
    // lands (features live at packages/app/features/<name>/, so the glob
    // needs the feature-name level — the old `app/*/components/*` pattern
    // resolved to packages/app/features/components/ and never matched):
    //   '../../../packages/app/features/*/**/*.stories.@(ts|tsx)',
  ],
  viteFinal: async (viteConfig) => {
    viteConfig.plugins = [
      ...(viteConfig.plugins ?? []),
      react(),
      reactNativeWeb(),
    ];
    viteConfig.resolve = {
      ...(viteConfig.resolve ?? {}),
      alias: {
        ...(viteConfig.resolve?.alias ?? {}),
        // The package root re-exports through CJS, which Vite's optimizer
        // can't statically analyze — point straight at the ESM build (absolute
        // path: the deep specifier isn't in the package's exports map).
        '@legendapp/motion': resolve(
          here,
          '../../../node_modules/@legendapp/motion/lib/module/index.js',
        ),
      },
    };
    viteConfig.server = { ...(viteConfig.server ?? {}), hmr: false };
    viteConfig.optimizeDeps = {
      ...(viteConfig.optimizeDeps ?? {}),
      // @expo/html-elements has a .tsx entry Vite refuses to optimize, so its
      // import chain into react-native-web/dist is served raw. Every CJS dep
      // that chain touches must be pre-bundled explicitly (exact subpaths) or
      // the browser gets CJS files with no ESM exports.
      include: [
        ...(viteConfig.optimizeDeps?.include ?? []),
        // CJS deps of the ESM-aliased @legendapp/motion
        '@legendapp/tools',
        '@legendapp/tools/react',
        'react-native-web',
        '@react-native/normalize-colors',
        'styleq',
        'styleq/transform-localize-style',
        'postcss-value-parser',
        'memoize-one',
        'nullthrows',
        'fbjs/lib/invariant',
        'inline-style-prefixer/lib/createPrefixer',
        'inline-style-prefixer/lib/plugins/crossFade',
        'inline-style-prefixer/lib/plugins/imageSet',
        'inline-style-prefixer/lib/plugins/logical',
        'inline-style-prefixer/lib/plugins/position',
        'inline-style-prefixer/lib/plugins/sizing',
        'inline-style-prefixer/lib/plugins/transition',
      ],
    };
    return viteConfig;
  },
};

export default config;
