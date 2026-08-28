# admin-vite — the Moyo **super admin**

One surface: Payload's admin panel for the company-wide super admin, the one
Payload surface with **no host tenant**
([`docs/deploy/moyo-district-tenancy.md`](../../docs/deploy/moyo-district-tenancy.md)
§5). It answers on `admin.moyolearn.com`.

| Surface | Path | Host in production | Rendering |
| --- | --- | --- | --- |
| Payload super admin | `/admin` | `admin.moyolearn.com` | server-rendered per request, never cached, never prerendered |
| Payload REST API | `/payload-api` | `admin.moyolearn.com` | same. REST only — GraphQL stays on `app.moyolearn.com`, see `payload-api.$.ts` |
| Redirect into the panel | `/` | `admin.moyolearn.com` | 307 → `/admin` |

There is no marketing here, no `@acme/ui`, no motion runtime and no globe. That
is the whole point of the app existing —
**[docs/site/adr-004-admin-app-split.md](../../docs/site/adr-004-admin-app-split.md)**
records the measurement that forced the split out of `apps/web-vite`, and
**[adr-003](../../docs/site/adr-003-payload-admin-on-tanstack.md)** records how
the mount itself was built.

## Commands

Run from the repo root (or from this directory with `pnpm <script>`):

```bash
pnpm --filter admin-vite dev        # dev server on :5174, SSR + HMR
pnpm --filter admin-vite build      # client + SSR builds; NO prerender pass
pnpm --filter admin-vite preview    # serve the built output
pnpm --filter admin-vite typecheck  # tsc --noEmit
pnpm --filter admin-vite lint       # eslint (shared flat config)

pnpm --filter admin-vite payload:importmap   # regenerate the import map
```

Node must satisfy the root `engines` field (`>=24.15.0 <26`); the machine's
default `node` may be newer, in which case put the pinned major first:
`export PATH=/opt/homebrew/opt/node@24/bin:$PATH`.

**Port 5174**, declared with `strictPort` in `vite.config.ts`, so this and
`web-vite` (5173) run at the same time and neither silently wanders onto the
other's port. `strictPort` matters more here than it looks: the shared config
derives `cors`/`csrf` from `NEXT_PUBLIC_SITE_URL`, and a reassigned port turns
every login POST into a rejected origin — which presents as "the password is
wrong", not as "the port moved".

## Running it

The panel needs a database and a secret and **will not boot without both** —
Payload connects on the first request, so a missing `DATABASE_URL` is a 500 on
`/admin`, not a build failure. The build itself needs no environment at all.

Those values live in the **repo-root `.env`**, not in this directory. Vite only
auto-loads env from the app directory, and Vite never puts unprefixed variables
into `process.env` in the first place, so the shell has to do it:

```bash
cd apps/admin-vite
(set -a; . ../../.env; set +a; pnpm dev)     # http://localhost:5174/admin
```

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres. The same database `apps/web` uses; the config keeps its tables in the `payload` schema. |
| `PAYLOAD_SECRET` | yes | **Must be byte-identical to `apps/web`'s.** It signs JWTs and encrypts stored field values, so a mismatch means this app cannot decrypt what the other wrote (deployment §5.2 item 4). |
| `NEXT_PUBLIC_SITE_URL` | for login | Becomes Payload's `serverURL` and its single `cors`/`csrf` origin. Set it to `http://localhost:5174` when running here, or the login POST is rejected as a cross-origin request. `GET /admin/login` renders either way, which is why this is easy to miss. |
| `PAYLOAD_PUSH` | no | `true` runs Drizzle push instead of migrations. **Never against a shared database** — it rewrites tables under `apps/web`. Leave unset. |
| `BUNNY_STORAGE_ACCESS_KEY` + `BUNNY_STORAGE_ZONE_NAME` + `NEXT_PUBLIC_BUNNY_CDN_BASE_URL` | no | Admin-panel media uploads. Absent, the storage adapter is not registered at all and uploads fall back to local disk. |
| `PAYLOAD_MCP_ENABLED` | no | `true` registers the MCP endpoint. Off by default and deliberately so. |

**This app never migrates and defines nothing.** `apps/web` owns the schema and
runs `payload migrate` in its build command; `push: false` everywhere in
production. Deployment §5.2 is the rule and it is not negotiable — two apps
migrating one database is schema drift with extra steps. There is no
`collections/` directory here and there must never be one.

### The import map

`src/routes/_payload/importMap.js` is **generated**. Payload derives it from the
shared config, so any change to `admin.components.*` in
`packages/payload/src/payload.config.ts` means regenerating it in **both**
consumers:

```bash
pnpm --filter web payload:importmap          # apps/web/app/(payload)/admin/importMap.js
pnpm --filter admin-vite payload:importmap   # apps/admin-vite/src/routes/_payload/importMap.js
```

The second script sets `PAYLOAD_IMPORT_MAP_FILE`, which is the only reason one
config can serve two maps. Run it from the repo root or via `pnpm --filter`, not
by hand from a shell whose CWD spells the repo root differently — the generator
writes paths relative to the file it emits, and a case-mismatched root produces
specifiers that resolve on macOS and fail on the Linux builder.

## Layout

```
src/
  router.tsx        required Start entry — exports getRouter()
  routes/
    __root.tsx      the <html> document; withPayloadRoot gives Payload its own
                    shell on /admin and FallbackDocument covers / and 404s
    index.tsx       "/" — 307 into /admin, so the bare host is not a dead end
    _payload.tsx    pathless layout for the panel; sets no-store + noindex
    _payload/
      admin.index.tsx     /admin
      admin.$.tsx         /admin/*        every panel view
      payload-api.$.ts    /payload-api/*  REST (no GraphQL — see the file)
      server.functions.ts the three createServerFn handlers
      importMap.js        GENERATED — see above; never hand-edited
  routeTree.gen.ts  generated on every dev/build; never edited, never linted
vite.config.ts      withPayload guest mode; prerender explicitly off
```

`@` is aliased to `./src`; `@payload-config` to
`packages/payload/src/payload.config.ts`.

## Build output

```
dist/client/**        client bundle + Payload's stylesheets
dist/server/server.js the SSR fetch handler — this app IS the server
```

`dist/client` must contain **zero** HTML files. There is no prerender pass and
`prerender: { enabled: false }` says so out loud, because a prerendered
`dist/client/admin/index.html` is a stale, logged-out dashboard rendered at build
time — when there is no user — and then served by every static host ahead of the
server route:

```bash
pnpm --filter admin-vite build
find apps/admin-vite/dist/client -name '*.html'   # must print nothing
```

The two headers that make deployment §3.2 real are set in **two** places, and
both are load-bearing. `headers()` on the `_payload` layout covers every
*document* response under it; a `server.handlers` response never passes through
a route's `headers()`, so `payload-api.$.ts` sets them on the Response it
builds. Check both, and check that neither leaks onto marketing:

```bash
curl -sI http://localhost:5174/admin/login | grep -Ei 'cache-control|x-robots-tag'

# NOT -I here: curl -I sends HEAD, and Payload's REST router registers
# DELETE/GET/OPTIONS/PATCH/POST/PUT and not HEAD, so HEAD is a genuine 404.
curl -s -D- -o /dev/null http://localhost:5174/payload-api/users/me \
  | grep -Ei 'HTTP/|cache-control|x-robots-tag'
# cache-control: private, no-store, max-age=0
# x-robots-tag: noindex, nofollow

curl -sI http://localhost:5173/ | grep -Ei 'cache-control|x-robots-tag'
# nothing — web-vite is a public, cacheable surface
```

One gap, recorded rather than papered over: the **307s do not carry them**.
`GET /` → `/admin` and `GET /admin` → `/admin/login` are redirects thrown from
`beforeLoad`, and TanStack Start does not run a route's `headers()` for a
redirect response. Both `Location` targets do carry the headers, and neither
redirect body contains anything, so this is a tidiness gap rather than a leak —
but a CDN may hold the redirect itself.

## Things that will bite you

- **Do not add `vite-plugin-react-native-web`.** It is absent on purpose. It sets
  `define: { global: 'self' }` in its `config()` hook, Vite merges plugin config
  *over* user config, and `@payloadcms/ui` reads `global._payload_clientConfigs`
  at module scope — the combination throws `ReferenceError: self is not defined`
  out of a server chunk. `web-vite` carries an `enforce: 'post'` plugin to undo
  it; this app has nothing to undo because the panel renders no kit components.
  The two Moyo components it *does* render — `packages/payload/src/components/`
  `Logo.tsx` and `Icon.tsx` — are plain `<span>` markup, styled by Payload theme
  variables.
- **Do not add Tailwind.** Preflight would reset Payload's element styling, and
  `@acme/theme/theme.css` re-declares `--color-text`, `--color-border` and
  `--color-border-strong`, which Payload owns under different meanings. The panel's
  token layer is `@acme/theme/payload-admin.css` and it is the only Moyo
  stylesheet here.
- **`@vitejs/plugin-rsc` is a hard singleton.** One instance, instantiated in
  `vite.config.ts` under `withPayload`'s guest mode. Two load two module
  registries and the panel's Flight payload decodes against the wrong one.
- **Three canary versions move together.** `payload`, `@payloadcms/ui` and
  `@payloadcms/tanstack-start` are all `4.0.0-canary.29`, and the adapter's
  `payload` peer is an exact pin rather than a range. Bump one, bump all three in
  `pnpm-workspace.yaml`, or `pnpm install` fails outright — which is the good
  outcome.
