import { baseConfig } from '@acme/config/eslint/base.mjs';

export default [
  ...baseConfig(),
  /*
    react/no-unknown-property checks JSX attributes against the DOM. The globe
    scene's elements are not DOM at all — `<mesh>`, `<group>`, `<ringGeometry>`
    and their props are react-three-fiber's reconciler intrinsics, typed by
    `@react-three/fiber`'s own JSX augmentation. Scoped to the one file that
    renders them so a real unknown DOM prop anywhere else still fails.
  */
  {
    files: ['src/globe/scene.tsx'],
    rules: { 'react/no-unknown-property': 'off' },
  },
  // routeTree.gen.ts is written by the router plugin on every build.
  { ignores: ['dist/**', '.output/**', '.tanstack/**', 'src/routeTree.gen.ts'] },
];
