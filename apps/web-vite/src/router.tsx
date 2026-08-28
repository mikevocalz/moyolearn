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

export function getRouter() {
  return createRouter({
    routeTree,
    // Marketing pages are prerendered; a client-side miss should land on a real
    // 404 from the host rather than an empty shell.
    defaultPreload: 'intent',
    scrollRestoration: true,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
