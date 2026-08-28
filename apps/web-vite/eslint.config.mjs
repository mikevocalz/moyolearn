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
  /*
    The Payload mount (ADR-003) IS "the web app server code" that
    FORBID_BACKEND_DIRECT names as its exemption (packages/config/eslint/
    boundaries.mjs:32) — the rule exists so features reach content through
    @acme/payload's client instead of the SDK, and this subtree is not a
    feature, it is the admin panel itself. `src/routes/_payload/importMap.js`
    is the sharpest case: Payload GENERATES it, `pnpm --filter web-vite
    payload:importmap` rewrites it wholesale, and its imports are the panel's
    component registry.

    Scoped to the mount and nothing else, so a marketing chapter that reaches
    for `payload` still fails.
  */
  {
    files: ['src/routes/_payload.tsx', 'src/routes/_payload/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  /*
    The generated import map emits one `import` statement per registered
    component, so four components from `@payloadcms/ui` arrive as four
    statements from the same module. `import/no-duplicates` is right about the
    shape and there is nobody to tell — the file is overwritten by
    `pnpm --filter web-vite payload:importmap` on every regeneration.
  */
  {
    files: ['src/routes/_payload/importMap.js'],
    rules: { 'import/no-duplicates': 'off' },
  },
  // routeTree.gen.ts is written by the router plugin on every build.
  { ignores: ['dist/**', '.output/**', '.tanstack/**', 'src/routeTree.gen.ts'] },
];
