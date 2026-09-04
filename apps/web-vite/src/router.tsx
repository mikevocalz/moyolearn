/**
 * Start's required router entry — `src/router.tsx` exporting `getRouter`.
 * Resolved by name, not by import: the plugin looks for `router` in the src
 * directory and expects the `RouterEntry` shape.
 *
 * SOT: node_modules/@tanstack/start-client-core/dist/esm/startEntry.d.ts:RouterEntry
 *      node_modules/@tanstack/start-plugin-core/dist/esm/planning.js (defaultEntry: 'router')
 * SOT-KEYWORDS: web-vite router entry getRouter tanstack start routeTree
 */
import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import { NotFound } from './components/not-found';

export function getRouter() {
  return createRouter({
    routeTree,
    /*
      Without this the router has nothing to render for an unmatched path, and
      the miss leaves the server handler as an unhandled `HTTPError` — every
      wrong URL on the site answered a raw `{"status":500,"unhandled":true}`
      instead of a 404. Registering it here rather than as `notFoundComponent`
      on `__root` covers misses thrown from inside a matched route too.
    */
    defaultNotFoundComponent: NotFound,
    defaultPreload: 'intent',
    scrollRestoration: true,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
