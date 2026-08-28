/**
 * The build for BOTH surfaces this app serves (deployment §3.1/§3.2): the
 * marketing site, prerendered to real HTML at build time (ADR-001), and the
 * Payload super admin at `/admin` (ADR-003), which must never prerender.
 *
 * `withPayload` owns the base config and instantiates nothing — this is its
 * documented "guest mode", where the host already runs TanStack Start and so
 * must build the one permitted copy of each plugin itself. It deep-merges what
 * the callback returns onto Payload's base (aliases `@payload-config`, adds the
 * RSC/SSR externalisation the admin needs, registers its own workaround
 * plugins). `nitro()` is deliberately NOT instantiated: it is conditional on
 * deploying through Nitro, and this app's build contract is the static
 * `dist/client` tree ADR-001 gates on.
 *
 * Plugin order is load-bearing: `reactNativeWeb` declares itself `enforce:'pre'`
 * and must strip Flow types off React Native's own `.js` sources before any
 * other transform reads them; `rsc` then establishes the server-component
 * environment the admin renders in, `tanstackStart` owns routing/SSR and
 * `viteReact` compiles our JSX last.
 *
 * SOT: node_modules/@tanstack/react-start/dist/esm/plugin/vite.d.ts:tanstackStart
 *      node_modules/@payloadcms/tanstack-start/dist/withPayload/index.d.ts:withPayload,
 *        WithPayloadBuilderContext, payloadTanstackStartOptions
 * SOT-KEYWORDS: web-vite vite config tanstack start ssr prerender react-native-web
 *               payload admin rsc withPayload
 */
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { withPayload } from '@payloadcms/tanstack-start';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import rsc from '@vitejs/plugin-rsc';
import { defineConfig } from 'vite';
import reactNativeWeb from 'vite-plugin-react-native-web';
import tailwindcss from '@tailwindcss/vite';

const src = fileURLToPath(new URL('./src', import.meta.url));

/**
 * The ONE shared Payload config (deployment §5.2). This app consumes it; it
 * never defines a collection and never runs a migration — `apps/web` owns both.
 */
const payloadConfigPath = fileURLToPath(
  new URL('../../packages/payload/src/payload.config.ts', import.meta.url),
);

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

/**
 * The super admin, which this app DOES own and still must not prerender
 * (deployment §3.2 item 2). Two surfaces share this Nitro server and they want
 * opposite things from a cache: marketing wants a static file on a CDN, the
 * admin must be rendered per request behind a session.
 *
 * A prerendered `dist/client/admin/index.html` would be served ahead of the
 * server route by every static host, so the panel would be a stale, logged-out
 * snapshot of someone's dashboard — emitted at build time, when there is no
 * user, and cached publicly. Excluding it here is what keeps that file from
 * existing at all; the `no-store` / `noindex` headers on the route itself are
 * the second line, not the first.
 *
 * `/admin` is not linked from any marketing page, so `crawlLinks` would not
 * reach it today. This filter is the guarantee that stays true after someone
 * adds a staff link to the footer.
 */
const ADMIN_PATHS = ['/admin'];

/**
 * Re-asserts `global` → `globalThis` AFTER every other plugin has had its say.
 *
 * `vite-plugin-react-native-web` defines `global` as `self`
 * (node_modules/vite-plugin-react-native-web/dist/es/index.js:64), which is a
 * browser-only identifier. Vite merges each plugin's `config()` result OVER the
 * user config, so declaring `define.global` at the top level of this file does
 * not win — the plugin does. That was survivable while nothing in the server
 * graph touched `global` at module scope. `@payloadcms/ui` does:
 * `dist/utilities/getClientConfig.js` opens with
 * `var cachedClientConfigs = global._payload_clientConfigs`, which the RNW
 * define rewrote to `self._payload_clientConfigs` and which threw
 * `ReferenceError: self is not defined` the moment the prerenderer loaded the
 * server bundle — killing the MARKETING prerender, not the admin.
 *
 * `enforce: 'post'` is the whole mechanism: config hooks run pre → normal →
 * post, each merging over the last, so this one lands after RNW's `pre`.
 */
const globalAsGlobalThis: Plugin = {
  name: 'moyo:global-is-globalthis',
  enforce: 'post',
  config: () => ({ define: { global: 'globalThis' } }),
};

const isExcludedFromPrerender = (path: string): boolean =>
  [...PRODUCT_APP_PATHS, ...ADMIN_PATHS].some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );

export default defineConfig(
  withPayload(
    ({ pluginOptions }) => ({
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
        /*
          One copy of each, instantiated here because TanStack Start is already
          this app's router and `@vitejs/plugin-rsc` is a hard singleton — two
          instances load two module registries and the admin's Flight payload
          decodes against the wrong one. `pluginOptions.*` carries exactly what
          Payload needs from each; `payloadRscOptions()` sets
          `serverHandler: false` so Start, not the RSC plugin, owns the handler.
        */
        rsc(pluginOptions.rsc),
        tanstackStart({
          /*
            Payload's required Start options MERGED into this app's single call,
            not a second one: `payloadTanstackStartOptions` turns on `rsc.enabled`,
            exempts `@payloadcms/*` `.client.*` files from Start's SSR denial (they
            are Client Components that must still server-render), and disables
            code-splitting for the `/_payload` subtree so the panel is interactive
            on first paint. `routesDirectory` is spelled `routes` because Payload
            defaults to the demo's `app`, and this app predates it.
          */
          ...pluginOptions.tanstackStart,
          // One marketing route today; `crawlLinks` means every route reachable by
          // an <a> from `/` joins the static output without being listed here —
          // except the product-app paths above, which this app does not own, and
          // the admin, which it owns and must never emit as a static file.
          prerender: {
            enabled: true,
            crawlLinks: true,
            failOnError: true,
            filter: (page) => !isExcludedFromPrerender(page.path),
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
        /*
          `pluginOptions.react` widens the transform to every `.[jt]sx?` file with
          no exclusions — Payload's admin ships JSX from inside node_modules, which
          plugin-react's default `exclude` would skip.
        */
        viteReact(pluginOptions.react),
        globalAsGlobalThis,
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
    }),
    {
      payloadConfigPath,
      /*
        This app's routes live in `src/routes`; Payload's adapter defaults to
        the demo's `src/app`. The value has to be given HERE rather than only
        in the `tanstackStart` call, because `withPayload` uses it to build
        `pluginOptions.tanstackStart` in the first place.
      */
      routesDirectory: 'routes',
    },
  ),
);
