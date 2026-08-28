import { baseConfig } from '@acme/config/eslint/base.mjs';

export default [
  ...baseConfig(),
  // routeTree.gen.ts is written by the router plugin on every build.
  { ignores: ['dist/**', '.output/**', '.tanstack/**', 'src/routeTree.gen.ts'] },
];
