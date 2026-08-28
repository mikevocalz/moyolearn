/**
 * Start's required router entry — `src/router.tsx` exporting `getRouter`.
 * Resolved by name, not by import: the plugin looks for `router` in the src
 * directory and expects the `RouterEntry` shape.
 *
 * No `defaultPreload` here, unlike `web-vite`. Marketing preloads on intent
 * because its routes are static files on a CDN; every route in this app is a
 * per-request server render behind a session, so preloading on hover would fire
 * authenticated Flight requests for views nobody opened.
 *
 * SOT: node_modules/@tanstack/start-client-core/dist/esm/startEntry.d.ts:RouterEntry
 *      node_modules/@tanstack/start-plugin-core/dist/esm/planning.js (defaultEntry: 'router')
 * SOT-KEYWORDS: admin-vite router entry getRouter tanstack start routeTree
 */
import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
