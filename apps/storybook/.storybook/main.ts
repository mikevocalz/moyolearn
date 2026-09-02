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
    // Sub-barrels need their own pattern — the root glob is not recursive, which
    // is why the audio components were invisible in Storybook despite shipping.
    '../../../packages/ui/audio/*.stories.@(ts|tsx)',
    '../../../packages/ui/html/*.stories.@(ts|tsx)',
    // Same non-recursive-glob bug class as audio above: layout/ shipped with
    // Container.stories.tsx and no pattern here, so it never loaded.
    '../../../packages/ui/layout/*.stories.@(ts|tsx)',
    // PR-146 moved the split-view module into the kit as adaptive-panes; its
    // stories (the AdaptivePanes host + pane chrome + SwipeableRow) moved with
    // it, so the old mobile-src glob is gone.
    '../../../packages/ui/adaptive-panes/*.stories.@(ts|tsx)',
    // Features live at packages/app/features/<name>/, so the glob needs the
    // feature-name level (the old `app/*/components/*` pattern resolved to
    // packages/app/features/components/ and never matched).
    '../../../packages/app/features/*/**/*.stories.@(ts|tsx)',
  ],
  /*
    react-docgen off, deliberately.

    Storybook's default docgen walks a component's prop types through its
    imports, and in this repo every chain ends up inside react-native's own
    index.js — which is Flow source. Its `} as ReactNativePublicAPI` fails the
    babel parse with "Missing semicolon (397:1)", and the plugin surfaces that
    as a full render error, so the story is unusable rather than merely
    undocumented. It is not specific to one component: anything importing from
    @acme/ui reaches react-native eventually.

    Cost: autodocs loses auto-generated prop tables. Props here are documented
    with JSDoc on the interfaces, which is the source of truth anyway, and the
    react-docgen-typescript alternative re-reads the whole TS program per file
    for a dev server that already boots slowly.
  */
  typescript: { reactDocgen: false },
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
        // SolitoImage resolves to next/image on web, which validates remote
        // hosts against next.config.ts — a file Vite never reads, so every
        // story with a remote src failed with "Invalid src prop". The shim
        // renders the image and nothing else.
        'next/image': resolve(here, '../next-image-shim.tsx'),
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
