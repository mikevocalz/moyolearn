/**
 * The marketing site's build. TanStack Start on Vite, prerendering `/` to real
 * HTML at build time (ADR-001) — the kit renders server-side through
 * react-native-web, so a crawler gets the hero copy without running any JS.
 *
 * Plugin order is load-bearing: `reactNativeWeb` declares itself `enforce:'pre'`
 * and must strip Flow types off React Native's own `.js` sources before any
 * other transform reads them; `tanstackStart` then owns routing/SSR and
 * `viteReact` compiles our JSX last.
 *
 * SOT: node_modules/@tanstack/react-start/dist/esm/plugin/vite.d.ts:tanstackStart
 * SOT-KEYWORDS: web-vite vite config tanstack start ssr prerender react-native-web
 */
import { fileURLToPath } from 'node:url';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import reactNativeWeb from 'vite-plugin-react-native-web';
import tailwindcss from '@tailwindcss/vite';

const src = fileURLToPath(new URL('./src', import.meta.url));

/**
 * The CommonJS members of react-native-web's dependency closure, plus
 * @legendapp/motion's. Vite's dev pipelines evaluate modules as ESM with no
 * CommonJS interop, so each of these has to be pre-bundled or the first
 * `module.exports =` throws — `exports is not defined` in the SSR runner, or
 * "does not provide an export named 'default'" in the browser. Both
 * environments need the list; the production build does not, because Rollup's
 * commonjs plugin covers it there.
 *
 * apps/storybook/.storybook/main.ts carries the same list for the client.
 */
const CJS_DEPS = [
  '@legendapp/tools',
  '@legendapp/tools/react',
  '@react-native/normalize-colors',
  'fbjs/lib/invariant',
  'fbjs/lib/warning',
  'inline-style-prefixer/lib/createPrefixer',
  'inline-style-prefixer/lib/plugins/crossFade',
  'inline-style-prefixer/lib/plugins/imageSet',
  'inline-style-prefixer/lib/plugins/logical',
  'inline-style-prefixer/lib/plugins/position',
  'inline-style-prefixer/lib/plugins/sizing',
  'inline-style-prefixer/lib/plugins/transition',
  'memoize-one',
  'nullthrows',
  'postcss-value-parser',
  'styleq',
  'styleq/transform-localize-style',
];

/**
 * Paths that belong to apps/web (the product), not to this site.
 *
 * The marketing chapters link into the real front door — `/onboarding`,
 * `/login`, doc 38's FD-01 — and `crawlLinks` cannot tell a cross-app link from
 * an internal one. `extractLinks` (node_modules/@tanstack/start-plugin-core/
 * dist/esm/prerender.js:43) follows any href starting with `/`, asks THIS app
 * for it, gets a 404, and `failOnError` ends the build.
 *
 * Writing those hrefs as absolute URLs would also dodge the crawler, since it
 * ignores anything that is not relative — but it would point every preview
 * deployment at production, and it would hide a real deployment fact inside a
 * component. The boundary is declared here instead, once, where it belongs.
 *
 * A chapter that adds a new product-app link adds its prefix here.
 */
const PRODUCT_APP_PATHS = ['/login', '/onboarding', '/handoff'];

const isProductAppPath = (path: string): boolean =>
  PRODUCT_APP_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

export default defineConfig({
  plugins: [
    /*
      Tailwind's own Vite plugin rather than the PostCSS one. Vite 8 stopped
      resolving the bare `@import 'tailwindcss'` in src/globals.css through
      node_modules — with `node-linker=hoisted` the package sits at the
      workspace root, so PostCSS looked for `apps/web-vite/tailwindcss` and
      failed with ENOENT. This plugin owns the resolution itself and is
      Tailwind's documented Vite path; it peers `^5.2 || ^6 || ^7 || ^8`, so it
      spans the version we came from and the one Payload's adapter requires.
    */
    tailwindcss(),
    reactNativeWeb(),
    tanstackStart({
      // One marketing route today; `crawlLinks` means every route reachable by
      // an <a> from `/` joins the static output without being listed here —
      // except the product-app paths above, which this app does not own.
      prerender: {
        enabled: true,
        crawlLinks: true,
        failOnError: true,
        filter: (page) => !isProductAppPath(page.path),
      },
      pages: [
        { path: '/' },
        /*
          The motion audit surface. Listed explicitly because nothing links to
          it — `crawlLinks` would never find it — and it has to exist in the
          BUILT output, not just under `vite dev`, or the reduced-motion and
          prerender claims are only ever checked against the dev server.
          It carries `robots: noindex, nofollow` and is excluded from the
          sitemap; being unlinked is what keeps it out of the crawl in the first
          place. Delete this entry, not the route, if it ever needs to go.
        */
        { path: '/motion-lab' },
        /*
          The globe lab, on the same terms and for the same reason. The single
          strongest check on chapter 04 is that a page carrying the R3F island
          still prerenders to real HTML with no `<!--$!-->` marker — which a
          route that is never prerendered cannot demonstrate.
        */
        { path: '/globe-lab' },
      ],
    }),
    viteReact(),
  ],
  resolve: {
    alias: {
      '@': src,
      /*
       * Same alias apps/storybook/.storybook/main.ts carries, for the same
       * reason: @legendapp/motion's `exports["."]` points BOTH `import` and
       * `require` at a CJS index, so Vite's dev SSR module runner evaluates it
       * raw and dies on `exports is not defined`. The package ships an ESM
       * build at lib/module; point at it directly.
       */
      '@legendapp/motion': fileURLToPath(
        new URL('../../node_modules/@legendapp/motion/lib/module/index.js', import.meta.url),
      ),
    },
  },
  define: {
    /*
     * vite-plugin-react-native-web defines `global` as `self`, which is a
     * browser-only identifier — the SSR/prerender pass runs in Node and would
     * throw ReferenceError on the first RN module that touches `global`.
     * `globalThis` is the one spelling both environments answer to. User config
     * wins over a plugin's `config()` hook, so this overrides it.
     */
    global: 'globalThis',
  },
  ssr: {
    /*
     * These must be transformed rather than handed to Node's loader.
     *
     * The @acme/* packages are raw TypeScript. The expo/react-native families
     * are published for Metro, which resolves extensionless relative imports
     * and platform forks; Node's ESM loader does neither, so an externalised
     * expo module dies at prerender time with ERR_MODULE_NOT_FOUND on its own
     * `./build/ExpoX` import. Bundling them puts Vite's resolver in that seat.
     * react-native-web additionally ships no `exports` map, so Node would take
     * the CJS build and lose the named exports.
     */
    noExternal: [
      '@acme/theme',
      '@acme/ui',
      'react-native-web',
      /^@expo\//,
      /^expo(-|$)/,
      /^react-native-/,
      // Same reason apps/storybook aliases it: the published entry is CJS and
      // `require`s React Native's Flow source, which Node cannot parse
      // ("Unexpected token 'typeof'"). Bundling routes it through the
      // react-native → react-native-web alias instead.
      /^@legendapp\//,
      // Metro-shaped again: solito/image imports a DIRECTORY
      // ('./image/expo'), which Node's ESM loader refuses. Rollup resolves it,
      // so this only bites `vite dev` — which is exactly why dev has to be
      // checked separately from the prerender.
      'solito',
      /*
       * react-native-web's own dependency closure. These are CJS modules that
       * set `exports.default` WITHOUT reassigning `module.exports`, so an
       * externalised ESM default import binds the namespace object rather than
       * the function ("createPrefixer is not a function"). Rolled into the
       * bundle, Rollup applies the interop. Listed from react-native-web@0.21.2
       * package.json `dependencies`; @babel/runtime is excluded because its
       * helpers do reassign module.exports and interop correctly.
       */
      '@react-native/normalize-colors',
      'fbjs',
      'inline-style-prefixer',
      'memoize-one',
      'nullthrows',
      'postcss-value-parser',
      'styleq',
    ],
    optimizeDeps: { include: CJS_DEPS },
  },
  optimizeDeps: { include: CJS_DEPS },
});
