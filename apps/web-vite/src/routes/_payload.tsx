/**
 * The Payload admin's layout route, and the boundary between this app's two
 * surfaces (deployment §3.1/§3.2).
 *
 * `_payload` is a PATHLESS layout in TanStack's flat-route convention: it
 * contributes no URL segment, so its children own `/admin` and `/payload-api`
 * directly. The id is what `payloadTanstackStartOptions` keys its
 * `splitBehavior` on (`adminRouteId`, default `'/_payload'`), so this subtree
 * is eager-loaded rather than code-split — a split panel renders but is not
 * interactive until its `?tsr-split=` chunk lands.
 *
 * `headers()` is where deployment §3.2 item 1 lands, and it is declared on the
 * LAYOUT rather than on each admin route so the API route inherits it too: a
 * cached REST response is the same leak as a cached dashboard, and there is no
 * version of this app where one wants `no-store` and the other does not. The
 * prerender exclusion in vite.config.ts is the other half — headers only
 * matter once a request reaches the server, and a prerendered file never lets
 * it.
 *
 * SOT: node_modules/@payloadcms/tanstack-start/dist/routes/layoutRoute.d.ts:
 *        payloadLayoutRoute
 *      node_modules/@tanstack/router-core/dist/esm/route.d.ts:353 (headers)
 *      docs/deploy/moyo-vercel-deployment.md §3.2
 * SOT-KEYWORDS: web-vite payload admin layout route pathless no-store noindex
 *               super admin cache headers
 */
import { payloadLayoutRoute } from '@payloadcms/tanstack-start/client';
import { createFileRoute } from '@tanstack/react-router';

/*
  Payload's own panel stylesheet, then the Moyo token layer that re-declares its
  variables. Order matters and only in this direction — `payload-admin.css` is
  generated from packages/theme/tokens.ts, so no hex ever leaves the token
  source, and it must be parsed after the defaults it overrides.

  The marketing stylesheet is deliberately absent: `withPayloadRoot` swaps the
  document shell on `/admin`, so `globals.css` is never linked here and
  Tailwind's Preflight never gets the chance to reset Payload's element styling.
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
