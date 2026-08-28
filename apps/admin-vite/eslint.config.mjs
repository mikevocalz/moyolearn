import { baseConfig } from '@acme/config/eslint/base.mjs';

export default [
  ...baseConfig(),
  /*
    `FORBID_BACKEND_DIRECT` (packages/config/eslint/boundaries.mjs:32) bans
    `payload` and `@payloadcms/*` outside `@acme/payload` and "the web app
    server code". This whole app IS that server code — it is the admin panel and
    it has no feature layer to protect. In `web-vite` the same exemption had to
    be scoped to `src/routes/_payload*` so a marketing chapter reaching for
    `payload` still failed; here there are no marketing chapters, and scoping it
    to `src/**` would only pretend otherwise.

    `src/routes/_payload/importMap.js` is the sharpest case: Payload GENERATES
    it, `pnpm --filter admin-vite payload:importmap` rewrites it wholesale, and
    its imports are the panel's component registry.
  */
  {
    files: ['src/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  /*
    The generated import map emits one `import` statement per registered
    component, so four components from `@payloadcms/ui` arrive as four
    statements from the same module. `import/no-duplicates` is right about the
    shape and there is nobody to tell — the file is overwritten by
    `pnpm --filter admin-vite payload:importmap` on every regeneration.
  */
  {
    files: ['src/routes/_payload/importMap.js'],
    rules: { 'import/no-duplicates': 'off' },
  },
  /*
    routeTree.gen.ts is written by the router plugin on every build.

    `.vercel/**` is this app's OWN build output — it is in .gitignore beside
    `dist`, but it was missing here, so `pnpm lint` crashed for anyone with a
    local build present: ESLint walked the minified Nitro bundles and then died
    formatting the result ("RangeError: Invalid string length"). A build
    artefact is never lintable, and the crash names neither the app nor the
    reason, which is why it reads as a broken repo rather than a stale folder.
  */
  {
    ignores: ['dist/**', '.output/**', '.vercel/**', '.tanstack/**', 'src/routeTree.gen.ts'],
  },
];
