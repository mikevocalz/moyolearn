# ADR 004: The super admin moves to its own app
Status: proposed · Date: 2026-08-28 · Supersedes the host-app decision in ADR-003

<!--
The follow-through on ADR-003's own Option C, taken because the number ADR-003
recorded as "the price of this decision" turned out to be a price nobody was
buying anything with. Filed under docs/site/ beside ADR-001 and ADR-003 because
it changes the same app's build.
SOT: this file · apps/admin-vite/vite.config.ts · apps/web-vite/vite.config.ts
     docs/deploy/moyo-vercel-deployment.md §1/§2.5/§3.1/§3.2/§5.2/§6
     docs/site/adr-003-payload-admin-on-tanstack.md
SOT-KEYWORDS: adr admin app split payload super admin admin-vite web-vite
              plugin-rsc initial js bundle three projects moyo-admin
-->

## Context

ADR-003 mounted the Payload super admin inside `apps/web-vite` and measured what
it cost: **initial JS on `/` went from 155.8 kB gz to 245.6 kB gz.** That ADR
also named the cause precisely and named the only fix.

The cause is not Payload. `@payloadcms/tanstack-start` requires
`tanstackStart({ rsc: { enabled: true } })`, and Start builds **one** client
entry for the whole app. Turning RSC on for `/admin` ships `@vitejs/plugin-rsc`'s
browser runtime — React's Flight client — to every marketing visitor.
ADR-003 proved the entry contains no Payload code at all (`payloadcms`,
`PayloadAdminShell`, `RootProvider`, `_payload_clientConfigs`: zero occurrences)
and that no chunk matching `admin|payload` is referenced by `index.html`. The
panel splits correctly; the runtime that makes splitting-by-RSC possible cannot,
and there is no per-route opt-out.

ADR-003 left the decision open, deliberately: *"the trigger for taking it should
be a marketing performance budget, not taste."* Three things make it a budget
question rather than a taste one.

1. **ADR-001 built this app to be read without JavaScript**, and its recorded
   Lighthouse performance was already 73 with FCP 4.4 s at the *155.8* number.
   A 58% increase in initial JS lands on the surface whose entire justification
   is that a crawler and a slow connection get the hero.
2. **The 89.8 kB buys the marketing app nothing.** Not a feature, not a route,
   not a byte of the panel. It is the fixed overhead of a capability only the
   other surface uses.
3. **Co-hosting also moved the credentials.** ADR-003's own consequences list it:
   `moyo-www` had to hold `DATABASE_URL`, `PAYLOAD_SECRET` and
   `BLOB_READ_WRITE_TOKEN`, and the public marketing origin began serving a
   Payload API against the production database. That is a second cost, paid in a
   different currency, and it was never the point of the marketing project.

The measurement was re-run before anything was changed, from the committed build
at `c5b7d46`: **245.6 kB gz across 13 files**, `dist/client/index.js` 546.7 kB
raw / 173.6 kB gz. Identical to ADR-003 to the tenth of a kilobyte, which also
fixes the method as reproducible — resolve `<script src>` plus every
`modulepreload` link out of the prerendered `dist/client/index.html`, gzip those
files, sum.

## Options

| Option | How it works | Verified seam (file:symbol) | Pros | Cons |
| --- | --- | --- | --- | --- |
| **A. `apps/admin-vite`, a third Vercel project** (chosen) | ADR-003's Option C and deployment §2.5's shape, applied to the super admin instead of to districts. A second TanStack Start app whose only surface is the panel: the four `_payload*` route files move across unchanged, `withPayload` runs in the same guest mode, and `apps/web-vite` reverts to its pre-ADR-003 plugin list. `admin.moyolearn.com` re-points from `moyo-www` to a new `moyo-admin`. | `node_modules/@payloadcms/tanstack-start/dist/withPayload/index.d.ts:withPayload, WithPayloadBuilderContext, payloadTanstackStartOptions` · `dist/exports/client.d.ts:withPayloadRoot, payloadLayoutRoute, payloadAdminIndexRoute, payloadAdminSplatRoute, createServerFunctionClient` · `dist/exports/server.d.ts:loadAdminPage, handleServerFunctions` · `dist/exports/layouts.d.ts:loadLayoutData` · `node_modules/payload/dist/utilities/handleEndpoints.d.ts:handleEndpoints` | The only option that returns the marketing number, and it returns it exactly: **155.8 kB gz**, byte-comparable to the pre-ADR-003 figure. Marketing stops holding database credentials and stops serving a Payload API. The admin stops paying for `react-native-web`, Tailwind, and the whole `ssr.noExternal` maintenance list. Each app's `vite.config.ts` serves one master again. | A third Vercel project, a third build, a third env-var set with `PAYLOAD_SECRET` kept identical (§5.2 item 4). Two TanStack Start apps to keep on the same versions. A documented decision reversed for the second time (deployment rev 2 → rev 4). |
| **B. Keep co-hosting, cut the marketing bundle elsewhere** | Absorb the 89.8 kB by paying it back somewhere else — ADR-001's own follow-up notes `@acme/ui/primitives` reaches the same elements without the root barrel, and `typography-*.js` is 41.8 kB gz of the critical path. | `packages/ui/package.json` (`./primitives` export, declared) — real and unused | No new project, no new build, no reversal. Would improve the number whether or not the admin stays. | Does not address the cause: the RSC runtime is fixed overhead that grows with plugin-rsc, not with our code, and it would still be there after the diet. It also spends a genuine marketing optimisation on cancelling out an unrelated cost, so the budget looks met while the regression is still in it. And it leaves the credential and API-surface consequences untouched. |
| **C. Move the super admin into `apps/web` (Next)** | ADR-003's Option B, revisited: `@payloadcms/next` is already installed and working there. | `apps/web/app/(payload)/admin/[[...segments]]/page.tsx:RootPage` · `apps/web/app/(payload)/layout.tsx:RootLayout` | Zero new build surface. The panel already runs there. | Rejected in ADR-003 on the tenancy seam and the seam has not moved: every district portal resolves a tenant from its host, and the super admin's defining property is that it does not (`moyo-district-tenancy.md` §5). `§6`'s selector-pinning override targets `apps/web/app/(payload)/admin/layout.tsx`; a super admin there gives that one file two mutually exclusive jobs. Re-rejected for the original reason, not re-litigated. |

Option B lost because it treats a symptom as a budget line. Option C lost in
ADR-003 and nothing about it changed.

## Decision

**Option A.** The Payload super admin is `apps/admin-vite`, its own workspace app
and its own Vercel project (`moyo-admin`), serving `admin.moyolearn.com`.
`apps/web-vite` is the marketing site and only the marketing site.

**Files created** (`apps/admin-vite/`):

| File | Role |
| --- | --- |
| `package.json` | `admin-vite`; every dep `catalog:`, no catalog entry added |
| `vite.config.ts` | `withPayload` guest mode; `prerender: { enabled: false }`; port 5174 `strictPort` |
| `tsconfig.json` | `allowJs`, `@payload-config` path |
| `eslint.config.mjs` | `no-restricted-imports` off for `src/**` — this app *is* the exempt server code |
| `src/router.tsx` | Start's `getRouter` entry; no `defaultPreload` |
| `src/routes/__root.tsx` | `withPayloadRoot(FallbackDocument)` |
| `src/routes/index.tsx` | `/` → 307 → `/admin` |
| `src/routes/_payload.tsx` | pathless layout; `Cache-Control` + `X-Robots-Tag` |
| `src/routes/_payload/admin.index.tsx` · `admin.$.tsx` | `/admin`, `/admin/*` |
| `src/routes/_payload/payload-api.$.ts` | `/payload-api/*` REST — **rewritten**, see below |
| `src/routes/_payload/server.functions.ts` | the three `createServerFn`s |
| `src/routes/_payload/importMap.js` | generated; byte-identical to `web-vite`'s (same directory depth) |
| `README.md` | how to run it, and the four things that will bite |

**Files deleted** from `apps/web-vite/`: `src/routes/_payload.tsx` and the whole
`src/routes/_payload/` directory (five files).

**Files edited:** `apps/web-vite/{vite.config.ts,package.json,tsconfig.json,eslint.config.mjs,README.md}`
and `src/routes/__root.tsx`; `turbo.json` (an `admin-vite#build` input list);
`docs/deploy/moyo-vercel-deployment.md` (rev 4).

**No catalog changes.** Every dependency `apps/admin-vite` needs was already in
`pnpm-workspace.yaml` from ADR-003 — `payload`, `@payloadcms/ui`,
`@payloadcms/tanstack-start`, `@vitejs/plugin-rsc`, `@vitejs/plugin-react`,
`vite`, `@tanstack/react-*`, `graphql` (`payload`'s only peer). Nothing was
added and nothing was removed, so the canary pin set is untouched.

**`packages/payload` is unchanged.** The `PAYLOAD_IMPORT_MAP_FILE` branch
ADR-003 added still reads correctly — `apps/admin-vite/src/routes/_payload/` sits
at the same depth below the repo root as `apps/web-vite/src/routes/_payload/`
did, so the generated `importMap.js` is byte-identical and regenerating it
reports `No new imports found`. One config, three consumers, still no fork.

### Two things this cost that the split did not cause

Neither is a consequence of moving the app. Both were latent in the ADR-003 code
and only surfaced because this was the first time the panel was exercised past
the login screen.

**1. `/payload-api/*` was returning 404 for every request.**

`payloadApiHandlers` delegates to `handleAPIRoute`
(`node_modules/@payloadcms/tanstack-start/dist/utilities/handleAPIRoute.server.js`),
which hardcodes the api prefix in both directions:

```js
const slugParts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)
const path = slugParts.length ? `/api/${slugParts.join('/')}` : '/api'
```

The shared config sets `routes.api: '/payload-api'` (deployment §5.2's one
config). The strip matches nothing, the re-prefix stacks, and Payload was handed
`/api/payload-api/users/me` — answering
`{"message":"Route not found \"/api/payload-api/users/me\""}`. The helper is
correct only when `routes.api === '/api'`.

The route now calls `handleEndpoints` — Payload's own framework-adapter entry
point, the one `handleAPIRoute` wraps — and **omits** its `path` argument, which
the `.d.ts` documents as an *override*. Omitted, `handleEndpoints` reads
`new URL(req.url).pathname` and matches it against `config.routes.api`
(`node_modules/payload/dist/utilities/handleEndpoints.js:108-117`). That is not
a workaround; it is the supported call, and it keeps the route prefix a property
of the shared config rather than a string asserted twice. `GET
/payload-api/users/me` now returns `200 {"user":null}` and a login POST with bad
credentials returns a real `401 The email or password provided is incorrect`,
which is the whole REST path proven end to end.

`/payload-api/graphql` is **not** served here and now says so in the file. In the
Next app GraphQL is a separate route using `GRAPHQL_POST` from
`@payloadcms/next`; there is no framework-agnostic equivalent in `payload` or in
the TanStack adapter, and reproducing it means vendoring `graphql-http` +
`configToSchema` wiring or taking a Next dependency into a Vite app. The admin
panel is REST-only, and `app.moyolearn.com` already serves GraphQL for clients
that need it.

**2. Route `headers()` does not reach a `server.handlers` response.**

ADR-003 put `Cache-Control: private, no-store` and `X-Robots-Tag: noindex` on
the `_payload` layout specifically so `/payload-api` would inherit them — *"a
cached REST response is the same leak as a cached dashboard"*. Measured on the
running server, it does not: a `server.handlers` response is constructed by the
handler and never passes through a route's `headers()`, so
`GET /payload-api/users/me` came back with no `Cache-Control` at all, and a 200
GET with no `Cache-Control` is heuristically cacheable. A cached `users/me` is
somebody else's session. `payload-api.$.ts` now sets both headers on the Response
it builds, copying Payload's own (`Set-Cookie`, `Access-Control-*`) first.

A third, smaller gap is recorded and **not** fixed: the two 307s
(`/` → `/admin`, `/admin` → `/admin/login`) carry neither header, because
TanStack Start does not run `headers()` for a redirect thrown from `beforeLoad`.
Both `Location` targets do carry them and neither redirect has a body, so it is
tidiness rather than a leak — but a CDN may hold the redirect.

### The RNW decision

**`vite-plugin-react-native-web` is not installed in `apps/admin-vite`, and
neither is Tailwind.** This was the open question going in and it resolves
cleanly: the panel renders Payload's own React, and the only Moyo components in
it — `packages/payload/src/components/Logo.tsx` and `Icon.tsx`, reached through
the generated import map — are plain `<span>` markup carrying Payload theme
class names. No `@acme/ui`, no `react-native-web`, no `@expo/html-elements`.

Dropping RNW removes ADR-003's hardest-won finding as a *problem* rather than
carrying it: RNW sets `define: { global: 'self' }` in its `config()` hook, Vite
merges plugin config over user config, and `@payloadcms/ui` reads
`global._payload_clientConfigs` at module scope — which is what threw
`ReferenceError: self is not defined` out of a server chunk mid-prerender. With
no RNW there is nothing redefining `global`, so the `enforce: 'post'` counter-
plugin has nothing to counter and is absent. Tailwind is absent for a different
reason: Preflight would reset Payload's element styling, and
`@acme/theme/theme.css` re-declares `--color-text`, `--color-border` and
`--color-border-strong`, which Payload owns under different meanings. The
panel's token layer is `@acme/theme/payload-admin.css` and nothing else.

`web-vite` **keeps** the `moyo:global-is-globalthis` plugin, and that is a
judgement call made against a measurement rather than a guess. The marketing
build was run both ways: green either way, `/` at 155.8 kB gz either way (502.9
vs 502.8 kB raw — the `globalThis`/`self` spelling difference). So it is not
required today. It is kept because `self` is a browser-only identifier, the
SSR/prerender pass runs in Node, RNW is still in that app, and the failure mode
is not a build error but a silent prerender throw. It replaces a top-level
`define: { global: 'globalThis' }` that had been in that file, believed
effective, and a no-op the entire time. Removing it is a one-line change if that
call is wrong.

### What was proved, and how

Every number below is from a run on 2026-08-28.

1. **THE NUMBER. Initial JS on `/` is back to 155.8 kB gz** — 502.9 kB raw across
   six files, `dist/client/index.js` 315.2 kB raw / 99.9 kB gz. Before the split,
   measured from the same tree by the same method: 245.6 kB gz, 774.4 kB raw,
   thirteen files, `index.js` 546.7 kB raw / 173.6 kB gz. The seven files that
   disappeared are the RSC runtime's chunk graph
   (`floating-ui.utils.dom`, `react`, `react-dom`, `Link`, `jsx-runtime`,
   `compiler-runtime`, `preload-helper`).
2. **ADR-001's gate holds.** Four prerendered pages, each with exactly one real
   `<h1>` and zero `<!--$!-->` markers: `/` → `Learning has a heart.`, plus
   `Motion lab`, `Globe lab`, `Chapters lab`. `find dist/client -name '*.html'`
   returns those four and nothing else.
3. **The admin does not prerender.** `find apps/admin-vite/dist/client -name
   '*.html'` returns nothing at all. Not a filter this time — there is no
   prerender pass.
4. **The panel runs against the real database.** `GET /admin` 307s to
   `/admin/login`, which returns 200 and 237 051 bytes titled `Login - Payload`,
   with `data-theme="light" dir="ltr"` on `<html>` from `PayloadAdminShell` and
   the Moyo lockup present (`moyo-lockup` ×8), so the shared config's branding
   resolves through the import map. It sent us to login rather than
   create-first-user, so the connection is real. `/admin/collections/users` 307s
   to `/admin/login?redirect=…`, so the auth guard is live.
5. **Deployment §3.2's contract holds as emitted bytes.**
   `/admin/login` and `/payload-api/users/me` both carry
   `cache-control: private, no-store, max-age=0` and
   `x-robots-tag: noindex, nofollow`. `web-vite`'s `/` carries **neither**, and
   `web-vite`'s `/admin` and `/payload-api/users/me` are now 404.
6. **`pnpm typecheck` green from a cold cache** — 18/18 tasks, 0 cached
   (`--force`); 17 before, +1 for the new app.
7. **Lint clean.** `pnpm --filter web-vite lint`, `pnpm --filter admin-vite lint`
   and root `pnpm lint` all exit 0, 0 errors.
8. **`pnpm --filter web build` and `pnpm --filter storybook build` still green.**

## Consequences

- **Easier:**
  - The marketing app is a marketing app again: one surface, one document, one
    prerender contract, and a `vite.config.ts` that answers to ADR-001 alone.
    Its eslint file has no `no-restricted-imports` carve-out, so a chapter that
    reaches for `payload` fails with nothing to argue about.
  - **`moyo-www` no longer holds `DATABASE_URL` or `PAYLOAD_SECRET`,** because
    `apps/web-vite` contains no code that opens a database. That is not a policy;
    it is a property of the build. Marketing preview deployments cannot carry
    live credentials.
  - The public marketing origin no longer serves a Payload REST API against
    production.
  - The admin stops paying for `react-native-web`: no Flow-stripping pre-plugin,
    no `optimizeDeps` CommonJS shim list, no `ssr.noExternal` maintenance. When a
    kit component drags in a new Metro-shaped package, only one app has to care.
  - Both apps run at once (5173 / 5174), which is the normal case — the site
    links staff at the panel and the panel owns the content the site reads.

- **Harder / costs:**
  - **A third Vercel project.** Third build, third env-var set, and
    `PAYLOAD_SECRET` identical across all three or one app cannot decrypt what
    another wrote (§5.2 item 4). Deployment §6's table now has four columns.
  - **Two TanStack Start apps on the same canary pins.** `payload`,
    `@payloadcms/*` and `@payloadcms/tanstack-start` at `4.0.0-canary.29` with an
    exact peer; `vite`, `@tanstack/react-start` and `@vitejs/plugin-rsc` shared
    through the catalog. A bump is now a two-app regression test.
  - **A documented decision reversed twice.** Deployment rev 1 assumed a separate
    admin app, rev 2 removed it, rev 4 brings it back for a reason rev 2 could not
    have known. The doc carries all four rows rather than being rewritten, and
    ADR-003 stays in the folder for the same reason.
  - **`apps/admin-vite` departs from the adapter in one file.** `payload-api.$.ts`
    does not use `payloadApiHandlers`, because that helper is wrong for this
    config. That is one place to re-check when the adapter is upgraded, and the
    file says so in its header.
  - **`/payload-api/graphql` 404s on this origin.** Not a regression — it never
    worked in `web-vite` either — but it is now written down instead of assumed.
  - **`admin.moyolearn.com` must be re-pointed** from `moyo-www` to `moyo-admin`
    at cutover, and `moyo-www`'s Payload env vars removed. Both are on deployment
    §8's checklist.

- **Follow-ups:**
  - **Prove a write.** Login with a real super-admin account, save a document,
    and put a file through the Bunny adapter. The REST path is proven to a 401
    and the auth guard is proven to a redirect; nothing here claims a row was
    written.
  - **GraphQL on the admin origin, if anything ever needs it.** The seam is
    `configToSchema` from `@payloadcms/graphql` plus `graphql-http/lib/use/fetch`
    — what `@payloadcms/next`'s `GRAPHQL_POST` composes. Not built on
    speculation.
  - **Headers on the 307s**, if a CDN holding one turns out to matter.
  - **Upstream the `handleAPIRoute` prefix bug** to `@payloadcms/tanstack-start`.
    It is a two-line fix there (`config.routes.api` instead of the `/api`
    literal) and it would let this app drop its one departure.
  - **Nitro.** Deployment §3.1 deploys both TanStack apps through the Nitro Vite
    plugin to Build Output API v3. `pluginOptions.nitro` exists and carries the
    `tslib*` trace Payload's server build needs; wiring it changes the output
    directory and therefore the shape of ADR-001's gate, so it belongs to the
    deployment task — now for two apps rather than one.
  - **Admin visual parity.** `apps/web/app/(payload)/custom.css` carries the login
    framing, button press physics and tabular figures, and is reachable only from
    that app. Globalising it into `packages/theme` would give all three hosts one
    panel. Unchanged by this ADR and still owed.
  - **CSP on `admin.moyolearn.com`.** §3.2 item 3 asks for a strict one. The
    routes set `Cache-Control` and `X-Robots-Tag`; nothing sets
    `Content-Security-Policy`. Easier now that the origin is not shared with
    marketing.
  - **The marketing budget itself.** 155.8 kB gz is the restored baseline, not a
    good number. ADR-001's follow-up — `@acme/ui/primitives` instead of the root
    barrel — is still the honest next move, and `typography-*.js` at 42.3 kB gz
    is 27% of the critical path.

## Constraints honored

Zustand-only (no component state introduced; the admin's state is Payload's) ·
tokens-only (no raw values added; the panel's colour, shape and type come from
`@acme/theme/payload-admin.css`, generated from `packages/theme/tokens.ts`) ·
no invented APIs — every adapter and Payload symbol was read out of the installed
`.d.ts` before it was imported, and the one place the adapter is bypassed cites
the shipped `.js` line range that makes it wrong · no `any` (the one unavoidable
widening at the server-function boundary is asserted to the adapter's own
`SerializableRecord` transport brand) · all dependencies referenced as `catalog:`,
with no catalog entry added or changed · one shared Payload config, no collections
defined here, no migration step added (deployment §5.2) · doc references:
`CLAUDE.md`, `docs/deploy/moyo-vercel-deployment.md` §1/§2.5/§3.1/§3.2/§5.2/§6/§8,
`docs/deploy/moyo-district-tenancy.md` §5/§6, `docs/site/adr-001-ssr-lane.md`,
`docs/site/adr-003-payload-admin-on-tanstack.md`.
