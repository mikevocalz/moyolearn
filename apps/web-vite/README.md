# web-vite — the Moyo marketing site **and the super admin**

Two surfaces on one TanStack Start server, exactly as
[`docs/deploy/moyo-vercel-deployment.md`](../../docs/deploy/moyo-vercel-deployment.md)
§1 lays them out:

| Surface | Path | Host in production | Rendering |
| --- | --- | --- | --- |
| Marketing | `/`, `/motion-lab`, `/globe-lab`, `/chapters-lab` | `www.moyolearn.com` | prerendered to static HTML at build time |
| Payload super admin | `/admin`, `/payload-api` | `admin.moyolearn.com` | server-rendered per request, never cached, never prerendered |

Marketing pages are built from the shared kit (`@acme/ui`) rather than a parallel
set of marketing components, and a crawler reads their copy without executing
JavaScript. The admin is Payload's own panel, mounted through
`@payloadcms/tanstack-start`, consuming the **one shared config** in
`packages/payload`.

Decisions, what was measured, and what each costs:
**[docs/site/adr-001-ssr-lane.md](../../docs/site/adr-001-ssr-lane.md)** (the SSR
lane) and
**[docs/site/adr-003-payload-admin-on-tanstack.md](../../docs/site/adr-003-payload-admin-on-tanstack.md)**
(the admin).

## Commands

Run from the repo root (or from this directory with `pnpm <script>`):

```bash
pnpm --filter web-vite dev        # dev server with SSR, HMR and Fast Refresh
pnpm --filter web-vite build      # client + SSR builds, then the prerender pass
pnpm --filter web-vite preview    # serve the built output
pnpm --filter web-vite typecheck  # tsc --noEmit
pnpm --filter web-vite lint       # eslint (shared flat config)

pnpm --filter web-vite payload:importmap   # regenerate the admin's import map
```

Node must satisfy the root `engines` field (`>=24.15.0 <26`); the machine's
default `node` may be newer, in which case put the pinned major first:
`export PATH=/opt/homebrew/opt/node@24/bin:$PATH`.

## Running the admin locally

The marketing side needs no environment at all. The admin needs a database and a
secret, and **will not boot without both** — Payload connects on the first
request, so a missing `DATABASE_URL` is a 500 on `/admin`, not a build failure.

Put these in `apps/web-vite/.env` (not committed, and there is no `.env` in this
repo — get the values from the same place `apps/web` gets them):

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres. Same database `apps/web` uses; the config keeps its tables in the `payload` schema. |
| `PAYLOAD_SECRET` | yes | **Must be byte-identical to `apps/web`'s.** It signs JWTs and encrypts stored field values, so a mismatch means this app cannot decrypt what the other wrote (deployment §5.2 item 4). |
| `NEXT_PUBLIC_SITE_URL` | no | Becomes Payload's `serverURL` and its single `cors`/`csrf` origin. Defaults to `http://localhost:3000`; set it if you run on another port or auth will be rejected. |
| `PAYLOAD_PUSH` | no | `true` runs Drizzle push instead of migrations. **Never against a shared database** — it rewrites tables under `apps/web`. Leave unset. |
| `BUNNY_STORAGE_ACCESS_KEY` + `BUNNY_STORAGE_ZONE_NAME` + `NEXT_PUBLIC_BUNNY_CDN_BASE_URL` | no | Admin-panel media uploads. Absent, the storage adapter is not registered at all and uploads fall back to local disk. |
| `PAYLOAD_MCP_ENABLED` | no | `true` registers the MCP endpoint. Off by default and deliberately so. |

Then:

```bash
pnpm --filter web-vite dev     # http://localhost:3000/admin
```

**This app never migrates.** `apps/web` owns the schema and runs
`payload migrate` in its build command; `push: false` everywhere in production.
Deployment §5.2 is the rule and it is not negotiable — two apps migrating one
database is schema drift with extra steps.

### The import map

`src/routes/_payload/importMap.js` is **generated**. Payload derives it from the
shared config, so any change to `admin.components.*` in
`packages/payload/src/payload.config.ts` means regenerating it in **both**
consumers:

```bash
pnpm --filter web payload:importmap        # apps/web/app/(payload)/admin/importMap.js
pnpm --filter web-vite payload:importmap   # apps/web-vite/src/routes/_payload/importMap.js
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
    __root.tsx      the <html> document, wrapped by withPayloadRoot: Payload owns
                    its own shell on /admin, RootDocument owns everything else
    index.tsx       "/" — the hero
    _payload.tsx    pathless layout for the admin; sets no-store + noindex
    _payload/
      admin.index.tsx     /admin
      admin.$.tsx         /admin/*      every panel view
      payload-api.$.ts    /payload-api/*  REST + GraphQL
      server.functions.ts the three createServerFn handlers
      importMap.js        GENERATED — see above; never hand-edited
  routeTree.gen.ts  generated on every dev/build; never edited, never linted
  globals.css       Tailwind 4 entry + @acme/theme tokens + fonts + @source globs
  fonts.css         @font-face for the four self-hosted site faces
public/
  fonts/            the woff2 files + their licence texts
vite.config.ts      withPayload guest mode: plugins, react-native-web SSR wiring,
                    and the prerender exclusion that keeps /admin off disk
```

`@` is aliased to `./src`; `@payload-config` to `packages/payload/src/payload.config.ts`.

Tailwind is wired through `@tailwindcss/vite`, not PostCSS — there is no
`postcss.config.mjs`. Vite 8 stopped resolving the bare `@import 'tailwindcss'`
through `node_modules` under `node-linker=hoisted`.

## The site's design layer

Colour, shape and type for moyolearn.com are a **semantic layer inside the shared
token pipeline** (`packages/theme/tokens.ts` → `build-css.mjs` → `theme.css`),
not a second system. Every token, its usage rule, and the measured contrast
ratios: **[docs/site/tokens.md](../../docs/site/tokens.md)**. What to build from
the kit versus what must live in `src/components/`:
**[docs/site/component-inventory.md](../../docs/site/component-inventory.md)**.

Two things about this app in particular:

- **The site does not follow dark mode.** `.moyo-site` on `<body>` pins
  `color-scheme: light` and re-points the product's chrome variables at the site
  palette. That is deliberate: the ground is warm cream paper, and the hard
  offset shadows are drawn in the outline colour, so an inverted page loses the
  design language rather than adapting it. Do not "fix" a page by reaching for a
  `light-dark()` product token.
- **Fonts are self-hosted and there is no CDN request.** Four faces in
  `public/fonts/`, declared in `src/fonts.css`, each shadowed by a
  `size-adjust`ed `local()` fallback so `font-display: swap` costs no layout
  shift. The metrics are measured, not guessed — remeasure (don't hand-edit) if a
  font file is ever replaced.

## Adding a page

Add a file under `src/routes/`. `routeTree.gen.ts` regenerates itself, and the
route joins the prerender set automatically as long as something links to it —
`crawlLinks` is on. Give it a `head()` returning `meta` and a canonical `link`,
the way `src/routes/index.tsx` does; that is what puts the title and description
in the emitted HTML rather than in a client-side effect.

## Build output

```
dist/client/index.html   the prerendered page — grep it to check your copy shipped
dist/client/**           client bundle + the compiled stylesheet
dist/server/server.js    the SSR fetch handler — now REQUIRED, the admin lives here
```

`dist/client` is a plain static directory, and it must contain **exactly four**
HTML files: `index.html`, `chapters-lab/`, `globe-lab/`, `motion-lab/`. If
`dist/client/admin/index.html` ever appears, the prerender exclusion in
`vite.config.ts` has been broken and the panel is about to be served as a stale,
logged-out snapshot from a CDN:

```bash
pnpm --filter web-vite build
find apps/web-vite/dist/client -name '*.html'   # four files, none of them admin
```

If a page ever renders empty, look for `<!--$!-->` in the HTML: that is React's
marker for an SSR throw that fell back to client rendering, and it is the only
symptom — the build still exits 0.

## Things that will bite you

The kit renders through `react-native-web`, and the packages underneath it are
published for Metro, not for Node. Anything Metro-shaped that reaches this app's
import tree has to be named in `ssr.noExternal` **and** in `optimizeDeps.include`
for both environments, or the page silently client-renders. `vite.config.ts`
documents each failure mode with the exact error text it produces. Check
`pnpm dev` as well as `pnpm build` after touching that config — they fail
differently and independently.

Tokens only, as everywhere: spacing and colour come from
`packages/theme/tokens.ts` through `@acme/theme/theme.css`. Tailwind 4 means
there is no `tailwind.config.js` — new sources are registered with `@source` in
`src/globals.css`.

Two more, now that Payload shares the config:

- **`define` belongs in a plugin here, not at the top level.**
  `vite-plugin-react-native-web` sets `global: 'self'` in its `config()` hook, and
  Vite merges plugin config *over* the user's — the opposite of what you would
  expect. The `moyo:global-is-globalthis` plugin (`enforce: 'post'`) is what
  actually wins. Removing it does not fail the build; it fails the *prerender*,
  with `ReferenceError: self is not defined` from a server chunk.
- **Three canary versions move together.** `payload`, `@payloadcms/ui` and
  `@payloadcms/tanstack-start` are all `4.0.0-canary.29`, and the adapter's
  `payload` peer is an exact pin rather than a range. Bump one, bump all three in
  `pnpm-workspace.yaml`, or `pnpm install` fails outright — which is the good
  outcome.
