/**
 * Payload's REST + GraphQL catch-all, on THIS origin.
 *
 * The path is `payload-api`, not the adapter demo's `api`, because the shared
 * config sets `routes.api: '/payload-api'` (packages/payload/src/payload.config.ts)
 * and the panel builds every fetch from that value. A file named `api.$.ts`
 * would mount a route nothing ever calls and leave the admin talking to a 404.
 *
 * The panel cannot work without this: login, list queries, document saves and
 * file uploads are all REST calls the client makes back to the same origin. It
 * inherits `Cache-Control: private, no-store` from the `_payload` layout above.
 *
 * `server.handlers` is spelled as a literal key on the route-options object
 * expression on purpose — that is the exact shape TanStack Start's client
 * compiler recognises and strips. Wrapping the whole options object in a
 * factory call hides the key and leaks the config's module graph (Postgres
 * pool, sharp, the whole collection set) into the browser bundle.
 *
 * SOT: node_modules/@payloadcms/tanstack-start/dist/routes/apiRoute.d.ts:
 *        payloadApiHandlers
 *      packages/payload/src/payload.config.ts (routes.api)
 * SOT-KEYWORDS: web-vite payload api rest graphql route super admin payload-api
 */
import { payloadApiHandlers } from '@payloadcms/tanstack-start/server';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_payload/payload-api/$')({
  server: {
    handlers: payloadApiHandlers({
      getConfig: async () => (await import('@payload-config')).default,
    }),
  },
});
