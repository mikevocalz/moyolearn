/**
 * The Payload admin's layout route — everything this app actually serves
 * (deployment §3.1/§3.2).
 *
 * `_payload` is a PATHLESS layout in TanStack's flat-route convention: it
 * contributes no URL segment, so its children own `/admin` and `/payload-api`
 * directly. The id is what `payloadTanstackStartOptions` keys its
 * `splitBehavior` on (`adminRouteId`, default `'/_payload'`), so this subtree
 * is eager-loaded rather than code-split — a split panel renders but is not
 * interactive until its `?tsr-split=` chunk lands.
 *
 * `headers()` is where deployment §3.2 item 1 lands, declared on the LAYOUT so
 * every admin view inherits it rather than each route restating it.
 *
 * It does NOT reach the API route beside this one, which was the assumption
 * when this file was written for `apps/web-vite` and is measurably false: a
 * `server.handlers` response is constructed by the handler and never passes
 * through a route's `headers()`, so `GET /payload-api/users/me` came back with
 * no `Cache-Control` at all. `payload-api.$.ts` sets both headers on the
 * Response it builds, and says why there.
 *
 * `prerender: { enabled: false }` in vite.config.ts is the other half of this
 * one — headers only matter once a request reaches the server, and a
 * prerendered file never lets it.
 *
 * SOT: node_modules/@payloadcms/tanstack-start/dist/routes/layoutRoute.d.ts:
 *        payloadLayoutRoute
 *      node_modules/@tanstack/router-core/dist/esm/route.d.ts:353 (headers)
 *      docs/deploy/moyo-vercel-deployment.md §3.2
 * SOT-KEYWORDS: admin-vite payload admin layout route pathless no-store noindex
 *               super admin cache headers
 */
import { payloadLayoutRoute } from '@payloadcms/tanstack-start/client';
import { createFileRoute } from '@tanstack/react-router';

/*
  Payload's own panel stylesheet, then the Moyo token layer that re-declares its
  variables. Order matters and only in this direction — `payload-admin.css` is
  generated from packages/theme/tokens.ts, so no hex ever leaves the token
  source, and it must be parsed after the defaults it overrides.

  These two are the whole stylesheet budget of this app. There is no Tailwind
  entry and no `@acme/theme/theme.css`: Preflight would reset Payload's element
  styling, and `theme.css` re-declares `--color-text`, `--color-border` and
  `--color-border-strong`, which Payload owns under different meanings.
*/
import '@payloadcms/ui/css/app.css';
import '@acme/theme/payload-admin.css';

import { getLayoutDataFn, serverFunctionHandler } from './_payload/server.functions';

export const Route = createFileRoute('/_payload')({
  ...payloadLayoutRoute({
    load: getLayoutDataFn,
    serverFunction: serverFunctionHandler,
  }),
  headers: () => ({
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Robots-Tag': 'noindex, nofollow',
  }),
});
