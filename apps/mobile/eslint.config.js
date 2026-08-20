// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'gsap',
                'gsap/*',
                'framer-motion',
                'framer-motion/*',
                'lenis',
                'lenis/*',
                '@studio-freight/lenis',
                '@studio-freight/lenis/*',
                '@react-three/fiber',
                '@react-three/fiber/*',
                '@react-three/drei',
                '@react-three/drei/*',
              ],
              message:
                'Browser-only animation/rendering libraries stay out of apps/mobile; use Reanimated, Gesture Handler, Legend Motion, and Skia.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'window',
          message: 'Browser globals are not available in the native app.',
        },
        {
          name: 'document',
          message: 'DOM APIs are not available in the native app.',
        },
      ],
    },
  },
]);
