/**
 * The super admin's build, and nothing else (ADR-004, deployment §2.5).
 *
 * This app exists because `tanstackStart({ rsc: { enabled: true } })` builds ONE
 * client entry for the whole app with no per-route opt-out, so mounting the
 * panel beside marketing put `@vitejs/plugin-rsc`'s browser runtime on the
 * marketing critical path (ADR-003 measured it: 155.8 → 245.6 kB gz on `/`).
 * A separate app is the only place that runtime can be paid for by the surface
 * that needs it.
 *
 * `withPayload` owns the base config and instantiates nothing — this is its
 * documented "guest mode", where the host already runs TanStack Start and so
 * must build the one permitted copy of each plugin itself. It deep-merges what
 * the callback returns onto Payload's base (aliases `@payload-config`, adds the
 * RSC/SSR externalisation the admin needs, registers its own workaround
 * plugins). `nitro()` is left unconfigured: it detects Vercel and emits Build
 * Output API v3 to `.vercel/output`, which is the deployment §3.1 output.
 *
 * What is NOT here is the point of the file. No `vite-plugin-react-native-web`,
 * no `@tailwindcss/vite`, no `ssr.noExternal` list, no `optimizeDeps` CJS
 * shims — the panel is Payload's own React, and the only Moyo components it
 * renders (`packages/payload/src/components/{Logo,Icon}.tsx`) are plain `<span>`
 * markup with no `@acme/ui` import. Dropping RNW also removes the
 * `define: { global: 'self' }` hazard ADR-003 had to counter with an
 * `enforce: 'post'` plugin: nothing here redefines `global`, so
 * `@payloadcms/ui`'s `global._payload_clientConfigs` reads what it means to.
 *
 * SOT: node_modules/@payloadcms/tanstack-start/dist/withPayload/index.d.ts:withPayload,
 *        WithPayloadBuilderContext, payloadTanstackStartOptions
 *      node_modules/@tanstack/react-start/dist/esm/plugin/vite.d.ts:tanstackStart
 *      docs/site/adr-004-admin-app-split.md
 * SOT-KEYWORDS: admin-vite vite config payload admin rsc withPayload super admin
 *               no prerender port 5174
 */
import { fileURLToPath } from 'node:url';
import { withPayload } from '@payloadcms/tanstack-start';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import rsc from '@vitejs/plugin-rsc';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

const src = fileURLToPath(new URL('./src', import.meta.url));

/**
 * The ONE shared Payload config (deployment §5.2). This app consumes it; it
 * never defines a collection and never runs a migration — `apps/web` owns both.
 */
const payloadConfigPath = fileURLToPath(
  new URL('../../packages/payload/src/payload.config.ts', import.meta.url),
);

/**
 * 5174 so this and `web-vite` (5173) can run at once, which is the normal case:
 * the marketing site links staff at the panel and the panel is where the
 * content those pages read comes from.
 *
 * `strictPort` rather than Vite's default hunt-for-a-free-port, because the
 * shared Payload config derives `cors`/`csrf` from `NEXT_PUBLIC_SITE_URL` and a
 * silently reassigned port turns every login POST into a rejected origin —
 * which presents as "the password is wrong", not as "the port moved".
 */
const DEV_PORT = 5174;

export default defineConfig(
  withPayload(
    ({ pluginOptions }) => ({
      plugins: [
        /*
          One copy of each. `@vitejs/plugin-rsc` is a hard singleton — two
          instances load two module registries and the admin's Flight payload
          decodes against the wrong one. `pluginOptions.*` carries exactly what
          Payload needs from each; `payloadRscOptions()` sets
          `serverHandler: false` so Start, not the RSC plugin, owns the handler.
        */
        rsc(pluginOptions.rsc),
        tanstackStart({
          /*
            Payload's required Start options: `rsc.enabled`, the exemption that
            lets `@payloadcms/*` `.client.*` files server-render, and the
            code-splitting opt-out for the `/_payload` subtree so the panel is
            interactive on first paint. `routesDirectory` is spelled `routes`
            (Payload defaults to the demo's `app`) and is passed to `withPayload`
            below as well, because that is where `pluginOptions.tanstackStart`
            is built in the first place.
          */
          ...pluginOptions.tanstackStart,
          /*
            Explicit, though it is also the default. Deployment §3.2 item 2 is
            law here and nowhere more so than in the app that serves ONLY the
            admin: a prerendered `dist/client/admin/index.html` is a stale,
            logged-out dashboard emitted at build time and then served by every
            static host ahead of the server route. `web-vite` needed a path
            filter to say this; this app says it by having nothing to prerender.
          */
          prerender: { enabled: false },
        }),
        /*
          `pluginOptions.react` widens the transform to every `.[jt]sx?` file with
          no exclusions — Payload's admin ships JSX from inside node_modules, which
          plugin-react's default `exclude` would skip.
        */
        viteReact(pluginOptions.react),
        /*
          Nitro compiles the server into Vercel Functions and emits Build Output
          API v3 to .vercel/output. Deliberately unconfigured — it detects the
          platform itself, and deployment §3.1 warns that overriding
          outputDirectory in vercel.json breaks the pickup.
        */
        nitro(),
      ],
      resolve: { alias: { '@': src } },
      server: { port: DEV_PORT, strictPort: true },
      preview: { port: DEV_PORT, strictPort: true },
    }),
    {
      payloadConfigPath,
      /*
        This app's routes live in `src/routes`; Payload's adapter defaults to
        the demo's `src/app`.
      */
      routesDirectory: 'routes',
    },
  ),
);
