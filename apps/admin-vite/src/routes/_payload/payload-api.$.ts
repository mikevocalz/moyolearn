/**
 * Payload's REST catch-all, on THIS origin.
 *
 * The path is `payload-api`, not the adapter demo's `api`, because the shared
 * config sets `routes.api: '/payload-api'` (packages/payload/src/payload.config.ts)
 * and the panel builds every fetch from that value. A file named `api.$.ts`
 * would mount a route nothing ever calls and leave the admin talking to a 404.
 *
 * The panel cannot work without this: login, list queries, document saves and
 * file uploads are all REST calls the client makes back to the same origin.
 *
 * **REST only — GraphQL is not served here.** `handleEndpoints` does not route
 * it: in the Next app GraphQL is a separate file
 * (`apps/web/app/(payload)/payload-api/graphql/route.ts`) using
 * `GRAPHQL_POST` from `@payloadcms/next`, and there is no framework-agnostic
 * equivalent in `payload` or in `@payloadcms/tanstack-start`. Reproducing it
 * would mean vendoring ~120 lines of `graphql-http` + `configToSchema` wiring,
 * or taking a dependency on `@payloadcms/next` from a Vite app. The admin panel
 * itself is REST-only, so nothing here needs it, and `app.moyolearn.com`
 * already serves GraphQL for the clients that do. `/payload-api/graphql`
 * returns a Payload 404 on this origin, which is the honest answer.
 *
 * **`payloadApiHandlers` is deliberately not used**, and this is the one place
 * this app departs from the adapter. That helper delegates to
 * `handleAPIRoute` (node_modules/@payloadcms/tanstack-start/dist/utilities/
 * handleAPIRoute.server.js), which hardcodes the api prefix in both directions:
 *
 * ```js
 * const slugParts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)
 * const path = slugParts.length ? `/api/${slugParts.join('/')}` : '/api'
 * ```
 *
 * Against `routes.api: '/payload-api'` the strip matches nothing and the
 * re-prefix stacks, so Payload was handed `/api/payload-api/users/me` and
 * answered `{"message":"Route not found \"/api/payload-api/users/me\""}` for
 * every request — a 404 with a 200-shaped body, and the panel renders fine
 * right up until the first login POST. The helper is correct only when
 * `routes.api === '/api'`.
 *
 * `handleEndpoints` is Payload's own framework-adapter entry point (the one
 * `handleAPIRoute` wraps) and its `path` argument is documented as an
 * *override*: omitted, it reads `new URL(req.url).pathname` and matches it
 * against `config.routes.api`
 * (node_modules/payload/dist/utilities/handleEndpoints.js:108-117). Omitting it
 * is therefore not a workaround, it is the supported call — the route prefix
 * stays a property of the one shared config instead of being asserted twice.
 *
 * `server.handlers` is spelled as a literal key on the route-options object
 * expression on purpose — that is the exact shape TanStack Start's client
 * compiler recognises and strips. Wrapping the whole options object in a
 * factory call hides the key and leaks the config's module graph (Postgres
 * pool, sharp, the whole collection set) into the browser bundle. The dynamic
 * `import('payload')` inside the handler is the second line of that defence.
 *
 * SOT: node_modules/payload/dist/utilities/handleEndpoints.d.ts:handleEndpoints
 *      node_modules/@payloadcms/tanstack-start/dist/routes/apiRoute.d.ts:
 *        payloadApiHandlers (not used — see above)
 *      packages/payload/src/payload.config.ts (routes.api)
 * SOT-KEYWORDS: admin-vite payload api rest route super admin payload-api
 *               handleEndpoints routes.api prefix
 */
import { createFileRoute } from '@tanstack/react-router';

/*
  Spelled out rather than imported: the adapter declares the identical shape as
  a LOCAL type in dist/routes/apiRoute.d.ts and does not export it, and
  `@tanstack/react-start` has no public handler type to borrow either. One
  method handler, reused for all six verbs, exactly as `payloadApiHandlers`
  does — Payload dispatches on the method itself.
*/
type ApiRouteHandler = (ctx: { request: Request }) => Promise<Response>;

/*
  Deployment §3.2 item 1, applied HERE and not inherited. `headers()` on the
  `_payload` layout above sets `no-store` and `noindex` on every *document*
  response under it; a `server.handlers` response is built by the handler and
  never passes through a route's `headers()`, so `GET /payload-api/users/me`
  came back with no `Cache-Control` at all — and a 200 GET with no
  `Cache-Control` is heuristically cacheable. A cached `users/me` is somebody
  else's session. Measured on the running server, not assumed.
*/
const PRIVATE_HEADERS: Readonly<Record<string, string>> = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow',
};

const handler: ApiRouteHandler = async ({ request }) => {
  const { handleEndpoints } = await import('payload');
  const response = await handleEndpoints({
    config: (await import('@payload-config')).default,
    request,
  });
  /*
    Rebuilt rather than mutated: a Response returned from a fetch-style handler
    can carry immutable headers, and `set` on a guarded Headers throws rather
    than no-opping. Payload's own headers — `Set-Cookie` on login,
    `Access-Control-*`, the content type — are copied first and never replaced.
  */
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(PRIVATE_HEADERS)) headers.set(name, value);
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
};

export const Route = createFileRoute('/_payload/payload-api/$')({
  server: {
    handlers: {
      DELETE: handler,
      GET: handler,
      OPTIONS: handler,
      PATCH: handler,
      POST: handler,
      PUT: handler,
    },
  },
});
