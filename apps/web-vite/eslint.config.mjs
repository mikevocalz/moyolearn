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
    files: ['src/globe/scene.tsx', 'src/components/chapters/natalie-scene.tsx'],
    rules: { 'react/no-unknown-property': 'off' },
  },
  /*
    No `no-restricted-imports` exemption here, and that is deliberate. Between
    ADR-003 and ADR-004 this file opened FORBID_BACKEND_DIRECT
    (packages/config/eslint/boundaries.mjs:32) for `src/routes/_payload*`,
    because the Payload mount IS "the web app server code" the rule exempts.
    The mount lives in apps/admin-vite now, so this app is back to the workspace
    baseline: a marketing chapter that reaches for `payload` or `@payloadcms/*`
    fails, with nothing carved out of the rule to argue about.
  */
  // routeTree.gen.ts is written by the router plugin on every build.
  { ignores: ['dist/**', '.output/**', '.vercel/**', '.tanstack/**', 'public/draco/**', 'src/routeTree.gen.ts'] },
];
