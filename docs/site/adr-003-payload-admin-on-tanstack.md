# ADR 003: The Payload super admin on TanStack Start
Status: proposed · Date: 2026-08-28 · **host app superseded by
[ADR-004](adr-004-admin-app-split.md)**

> **Read this first.** ADR-004 took this ADR's own Option C. The super admin no
> longer lives in `apps/web-vite`; it is `apps/admin-vite`, its own app and its
> own Vercel project. **Every `apps/web-vite/src/routes/_payload*` path below
> should be read as `apps/admin-vite/src/routes/_payload*`** — the route files
> moved across unchanged, so everything this ADR records about *how the mount
> works* still stands and this is still the source of truth for it.
>
> Three things below are now wrong, and ADR-004 says why in each case:
> the host app; the claim that `/payload-api` inherits the layout's
> `Cache-Control` (a `server.handlers` response never passes through a route's
> `headers()`); and `payloadApiHandlers` itself, which hardcodes `/api` and
> 404s against this config's `routes.api: '/payload-api'`.
>
> The trigger this ADR asked for — *"a marketing performance budget, not
> taste"* — was the 245.6 kB gz figure in its own Consequences section. The
> split returned `/` to 155.8 kB gz.

<!--
The company-wide super admin's mount decision. Filed under docs/site/ beside
ADR-001 because it changes the same app's build, and because the marketing lane
and the admin lane now share one Vite config that has to satisfy both.
SOT: this file · apps/web-vite/vite.config.ts · apps/web-vite/src/routes/_payload.tsx
     docs/deploy/moyo-vercel-deployment.md §3.1/§3.2/§5.2
SOT-KEYWORDS: adr payload admin super admin tanstack start rsc web-vite
              prerender no-store noindex withPayload plugin-rsc
-->

## Context

`moyo-vercel-deployment.md` §1 puts two surfaces on one Vercel project:
`www.moyolearn.com` (marketing) and `admin.moyolearn.com` (the company-wide
super admin), both served by `apps/web-vite`. There is no `apps/admin` and
deliberately so — rev 2 of that document removed it.

The super admin is the one Payload surface with **no host tenant**.
`moyo-district-tenancy.md` §5 makes the request host authoritative for every
tenant-scoped collection and then carves out exactly one case:

```ts
// Super admins on admin.moyolearn.com: no host tenant, full user scope.
if (!hostTenant) {
  return req.user.roles?.includes('super-admin') ? true : (userConstraint ?? false)
}
```

That is why this panel cannot live inside `apps/web`: every district portal
resolves a tenant from its subdomain, and the super admin's defining property is
that it does not.

Three constraints bound the decision before any option is considered:

1. **§5.2 is law.** One shared config (`packages/payload`, `@acme/payload`),
   `apps/web` owns migrations, `push: false` in production, `PAYLOAD_SECRET`
   identical everywhere. This app consumes the config; it defines no collection
   and runs no migration.
2. **§3.2 is law.** Marketing wants aggressive edge caching; the admin must
   never be cached and never prerender. On one server that is explicit, not
   default.
3. **ADR-001's gate is law.** `/` must prerender to real HTML with a real
   `<h1>` and no `<!--$!-->` suspense-error marker. That gate is what proved the
   React Native kit server-renders on Vite at all, and nothing here may cost it.

The enabling fact is new: `@payloadcms/tanstack-start@4.0.0-canary.29` exists and
pins `payload` to `4.0.0-canary.29` **exactly** — the version already in the
catalog. Its `vite: >=8.0.0` and `@vitejs/plugin-react: ^6.0.0` peers were paid
for in commit `8549187`.

## Options

| Option | How it works | Verified seam (file:symbol) | Pros | Cons |
| --- | --- | --- | --- | --- |
| **A. `@payloadcms/tanstack-start` in `apps/web-vite`, guest mode** (chosen) | `withPayload(build, { payloadConfigPath, routesDirectory: 'routes' })` returns a Vite config function. The `build` callback instantiates the one permitted copy of `rsc`, `tanstackStart` and `viteReact`; `withPayload` deep-merges Payload's base (the `@payload-config` alias, RSC/SSR externalisation, seven workaround plugins) underneath. The panel mounts as four route files under a pathless `_payload` layout. | `node_modules/@payloadcms/tanstack-start/dist/withPayload/index.d.ts:withPayload, WithPayloadBuilderContext, PayloadPluginOptions, payloadTanstackStartOptions, payloadRscOptions, payloadReactOptions` · `dist/exports/client.d.ts:withPayloadRoot, payloadLayoutRoute, payloadAdminIndexRoute, payloadAdminSplatRoute, createServerFunctionClient` · `dist/exports/server.d.ts:loadAdminPage, handleServerFunctions, payloadApiHandlers, SerializableRecord` · `dist/exports/layouts.d.ts:loadLayoutData` · `node_modules/@tanstack/router-core/dist/esm/route.d.ts:353 (headers)` | Matches the deployment doc's topology with no new project, no new app and no second Payload config. The admin route tree is four files, all adapter-owned. `withPayloadRoot` gives Payload its own `<html>` on `/admin` and leaves the marketing document untouched, so ADR-001's gate is structurally protected rather than defended by conditionals. | Turns on `@vitejs/plugin-rsc` for the WHOLE app — one client entry, one RSC runtime, marketing included. Measured cost below, and it is the real one. `nitro()` stays uninstantiated, so the Vercel Build Output path in deployment §3.1 is still unexercised. |
| **B. Payload admin in `apps/web` (Next), reached at `admin.moyolearn.com`** | Point the `admin.` subdomain at `moyo-app` and let `@payloadcms/next` serve it; `apps/web-vite` keeps only marketing. | `apps/web/app/(payload)/admin/[[...segments]]/page.tsx:RootPage` · `apps/web/app/(payload)/layout.tsx:RootLayout` — installed and working today | Zero new dependencies, zero new build surface. The panel already runs there. | Contradicts deployment §1 rev 2, which assigns `admin.moyolearn.com` to `moyo-www`. Worse, it puts the untenanted super admin behind the same middleware and host-rewrite chain that exists to make every request tenant-scoped (`moyo-district-tenancy.md` §5/§6) — the one surface whose correctness depends on NOT resolving a tenant would be the one exception threaded through that machinery. The tenancy doc's §6 selector-pinning override is written for `apps/web/app/(payload)/admin/layout.tsx`; a super admin there means that file has two mutually exclusive jobs. |
| **C. A third app + third Vercel project for the super admin** | The shape deployment §2.5 specs for district portals, applied to the super admin instead: `apps/admin`, its own project, its own domain. | none — nothing of this shape exists; §2.5 describes it for `moyo-district`, and the deployment doc's rev 2 explicitly REMOVED `apps/admin` | Perfect isolation: marketing never pays a byte for the admin, and the admin never pays for react-native-web. It is the only option that fixes the bundle cost recorded below. | A third Vercel project, a third build, a third env-var set to keep `PAYLOAD_SECRET` identical across (§5.2 item 4), and a reversal of a documented decision. Rejected for now, not forever — see Consequences. |

Option B lost on the tenancy seam, not on effort. Option C is the mitigation for
A's one real cost and is deliberately left on the table.

## Decision

**Option A.** `apps/web-vite` mounts the Payload super admin at `/admin` through
`@payloadcms/tanstack-start@4.0.0-canary.29`, consuming `packages/payload`'s
single `buildConfig()` and defining nothing of its own.

**Files:**

| File | Role |
| --- | --- |
| `apps/web-vite/vite.config.ts` | `withPayload` guest mode; admin excluded from prerender |
| `apps/web-vite/src/routes/__root.tsx` | `shellComponent: withPayloadRoot(RootDocument)` |
| `apps/web-vite/src/routes/_payload.tsx` | pathless layout; `Cache-Control` + `X-Robots-Tag` |
| `apps/web-vite/src/routes/_payload/admin.index.tsx` | `/admin` |
| `apps/web-vite/src/routes/_payload/admin.$.tsx` | `/admin/*` |
| `apps/web-vite/src/routes/_payload/payload-api.$.ts` | `/payload-api/*` REST + GraphQL |
| `apps/web-vite/src/routes/_payload/server.functions.ts` | the three `createServerFn`s |
| `apps/web-vite/src/routes/_payload/importMap.js` | generated; `pnpm --filter web-vite payload:importmap` |

**Catalog additions** (`pnpm-workspace.yaml`, referenced as `catalog:`):

- `@payloadcms/tanstack-start@4.0.0-canary.29` — its `payload` peer is an exact
  pin, so it and the existing `payload` line move together or install fails.
- `@vitejs/plugin-rsc@0.5.26` — peered `^0.5.21`; 0.5.26 is what the adapter's
  own demo ships against.

`react-server-dom-webpack` was added and then removed. It is plugin-rsc's
*optional* peer and the Payload demo declares it, but plugin-rsc vendors its own
copy at `node_modules/@vitejs/plugin-rsc/dist/vendor/react-server-dom/` and never
resolves the bare specifier. Building with and without it produced a
byte-identical `dist/client/index.js` (md5 `e5d5b495ab5af2c6e4f1438395de8dc5`),
so it was install weight and an unmet `webpack` peer and nothing else.

`nitro/vite` was **not** instantiated. `withPayload`'s own JSDoc marks it
conditional ("only if the app deploys through Nitro"), and this app's build
contract is the static `dist/client` tree ADR-001 gates on. Wiring Nitro is the
separate step deployment §3.1 describes, and it changes the output directory.

### Two non-obvious things this required

**1. `global` was being defined as `self`, and had been all along.**

`vite-plugin-react-native-web` sets `define: { global: 'self' }` in its `config()`
hook (`node_modules/vite-plugin-react-native-web/dist/es/index.js:64`). The old
config carried `define: { global: 'globalThis' }` at the top level with a comment
claiming "user config wins over a plugin's `config()` hook". It does not — Vite
merges each plugin's config result *over* the user's. The bug was invisible for
as long as nothing in the server graph touched `global` at module scope.
`@payloadcms/ui` does: `dist/utilities/getClientConfig.js` opens with
`var cachedClientConfigs = global._payload_clientConfigs`, which came out of the
bundler as `self._payload_clientConfigs` and threw
`ReferenceError: self is not defined` the instant the prerenderer loaded the
server bundle — killing the **marketing** prerender, not the admin. The fix is a
four-line `enforce: 'post'` plugin (`moyo:global-is-globalthis`), because config
hooks run pre → normal → post and the last one merged wins.

**2. One config, two import maps.**

Payload generates the import map from the config and writes module specifiers
*relative to the file it emits*, but `admin.importMap.importMapFile` is a single
static value. `packages/payload/src/payload.config.ts` now reads
`PAYLOAD_IMPORT_MAP_FILE` when set and falls back to the `apps/web` path
otherwise, so the second consumer points the generator at itself for the length
of one command instead of getting a config of its own. Unset — which is every
runtime and every build — behaviour is byte-identical to before.

`path.resolve()` around the env value is load-bearing: the first run emitted
`../../../../../../MoyoLearn/packages/payload/src/components/Icon`, because the
CWD spelled the repo root `moyolearn` and `import.meta.url` spelled it
`MoyoLearn`. Same directory on APFS, different strings, and a relative path that
climbs out of the repo and back in by name resolves locally and fails on the
Linux builder.

### What was proved, and how

Every number below is from a build run on 2026-08-28, not asserted.

1. **`pnpm --filter web-vite build` green**, both surfaces emitted:
   `dist/server/assets/payload.config-CwtuPUMB.js` (1 374.73 kB / 304.55 kB gz)
   and `dist/server/assets/Edit-Bfuf6Yic.js` (1 933.15 kB / 431.43 kB gz) are the
   admin; the marketing chunks are unchanged in kind.
2. **The admin does not prerender.** `dist/client` contains exactly four HTML
   files — `index.html`, `chapters-lab/`, `globe-lab/`, `motion-lab/`. There is no
   `dist/client/admin/index.html` and no admin HTML anywhere in the tree. The
   only admin artefact under `dist/client` is a stylesheet chunk
   (`assets/adminViews-*.css`), which is a client asset, not a page.
3. **ADR-001's gate holds.** All four prerendered pages carry exactly one real
   `<h1>` and zero `<!--$!-->` markers. `/`'s is
   `Learning has a heart.`; the lab pages carry `Motion lab`, `Globe lab`,
   `Chapters lab`. The prerender configuration is byte-identical to HEAD apart
   from the admin exclusion — same `pages`, same `crawlLinks: true`, same
   `failOnError: true`.
4. **`pnpm typecheck` green from a cold cache** — 17/17 tasks, 0 cached
   (`--force`).
5. **`pnpm --filter web-vite lint` clean** — 0 errors, 0 warnings.
6. **`pnpm --filter web build` and `pnpm --filter storybook build` still green**
   after the Vite/toolchain changes.
7. **Initial JS on `/` went from 155.8 kB gz to 245.6 kB gz** — see below. No
   Payload or admin chunk is on that critical path.

**Not proved: the running admin.** There is no `.env` in this repo and no
credentials were invented. Payload needs `DATABASE_URL` and `PAYLOAD_SECRET`
before the panel can boot, so nothing in this ADR claims the admin renders,
authenticates, or reads a row. The build is green and the wiring matches the
reference implementation symbol for symbol; that is the whole of the claim.

## Consequences

- **Easier:**
  - The super admin exists where the deployment doc says it does, with no new
    Vercel project and no second Payload config.
  - Marketing and admin cannot bleed into each other's document. `withPayloadRoot`
    swaps the shell by path, so `globals.css`, the `moyo-site` ground, the font
    preload and `MotionRuntime` are absent from the admin, and Payload's
    stylesheet plus `@acme/theme/payload-admin.css` are absent from marketing.
    That separation is structural, not a set of conditionals someone can forget.
  - The panel is branded on arrival: the shared config's
    `admin.components.graphics.Logo`/`.Icon` resolve through the generated import
    map here exactly as they do in `apps/web`.
  - Adding an admin view is adding nothing — Payload resolves views from the path
    and ships them as Flight payloads through one splat route.

- **Harder / costs:**
  - **The marketing critical path grew by 89.8 kB gzipped, and that is the price
    of this decision.** Initial JS on `/` measured 155.8 kB gz at HEAD and
    245.6 kB gz now; `dist/client/index.js` alone went 315.1 kB → 546.7 kB raw
    (99.9 → 173.6 kB gz). The new bytes are `@vitejs/plugin-rsc`'s browser
    runtime — React's Flight client (`__vite_rsc`, `createFromReadableStream`,
    `temporaryReferences` all appear 0 times in the HEAD entry and 2–7 times in
    this one). It is **not** Payload code: the entry contains zero occurrences of
    `payloadcms`, `PayloadAdminShell`, `RootProvider` or `_payload_clientConfigs`,
    and no chunk matching `admin|payload` is referenced by `index.html`. The admin
    is properly split; the *runtime that makes splitting-by-RSC possible* is not,
    because `tanstackStart({ rsc: { enabled: true } })` builds one client entry
    for the app. There is no per-route opt-out. Option C is the only fix, and the
    trigger for taking it should be a marketing performance budget, not taste.
  - **`vite.config.ts` now serves two masters.** `ssr.noExternal` was already a
    maintained list (ADR-001); it now merges under Payload's own externalisation
    rules and its seven workaround plugins. A failure in that merge presents as
    either a client-rendered marketing page or a 500 in the admin, and the two
    look nothing alike.
  - **`packages/payload` gained an env-conditional path.** It is one branch with a
    documented default, but the shared config is no longer a pure function of the
    repo — `PAYLOAD_IMPORT_MAP_FILE` set in the wrong shell writes an import map
    into the wrong app.
  - **This origin now serves a Payload REST + GraphQL API.** `/payload-api/*` on
    `www.moyolearn.com` reaches the same database `apps/web` does. Access control
    lives in the shared config so the rules are identical, but the attack surface
    of the marketing origin is not what it was — deployment §3.2 item 1 (Production-
    scoped secrets) and item 3 (strict CSP, `HttpOnly; Secure; SameSite=Lax`) stop
    being advice and become required.
  - **An eslint boundary had to be opened.** `FORBID_BACKEND_DIRECT`
    (`packages/config/eslint/boundaries.mjs:32`) bans `payload` and `@payloadcms/*`
    outside `@acme/payload` and "the web app server code". The Payload mount *is*
    that server code, so `no-restricted-imports` is off for
    `src/routes/_payload.tsx` and `src/routes/_payload/**` — and nowhere else, so a
    marketing chapter reaching for `payload` still fails.
  - **`allowJs: true` in `apps/web-vite/tsconfig.json`**, for the generated
    `importMap.js`. Same setting `apps/web` carries for the same file.
  - **Three canary versions now move as one.** `payload`, `@payloadcms/*` and
    `@payloadcms/tanstack-start` are pinned to `4.0.0-canary.29` and the adapter's
    peer is an exact match, not a range. Deployment §3.2's closing note — pin
    exactly, do not refresh the lockfile the week of the demo — now has teeth.

- **Follow-ups:**
  - **Boot the admin against a real database.** `DATABASE_URL` and
    `PAYLOAD_SECRET` (identical to `apps/web`'s, §5.2 item 4), then: login,
    a list view, a document save, an upload through the Bunny adapter, and a
    GraphQL query — all against `/payload-api`. Nothing about the running panel is
    verified until that happens.
  - **Decide the bundle question with the number in hand.** 245.6 kB gz is the
    measurement; a marketing budget is what turns it into a decision. Option C
    (a third app/project) is specced in this ADR and in deployment §2.5.
  - **Admin visual parity.** `apps/web/app/(payload)/custom.css` carries the login
    framing, button press physics and tabular figures, and is reachable only from
    that app. `@acme/theme/payload-admin.css` (the token layer) is shared and is
    imported here; the panel-specific rules are not. Globalising that file into
    `packages/theme` would give both hosts one panel — it is an `apps/web` edit and
    was out of scope here.
  - **Nitro.** Deployment §3.1 deploys this app through the Nitro Vite plugin to
    Build Output API v3. `pluginOptions.nitro` exists and carries the `tslib*`
    trace Payload's server build needs; wiring it changes the output directory and
    therefore the ADR-001 gate's shape, so it belongs to the deployment task.
  - **CSP on `/admin`.** §3.2 item 3 asks for a strict one. The route sets
    `Cache-Control` and `X-Robots-Tag`; it does not set `Content-Security-Policy`.

## Constraints honored

Zustand-only (no component state introduced; the admin's state is Payload's) ·
tokens-only (no raw values added; the admin's colour, shape and type come from
`@acme/theme/payload-admin.css`, generated from `packages/theme/tokens.ts`) ·
no invented APIs — every adapter symbol was read out of the installed `.d.ts`
before it was imported, and every one is cited in the Options table above ·
no `any` (the one unavoidable widening at the server-function boundary is
asserted to the adapter's own `SerializableRecord` transport brand, not to `any`) ·
all new dependencies declared once in the `pnpm-workspace.yaml` catalog and
referenced as `catalog:` · one shared Payload config, no collections defined
here, no migration step added (deployment §5.2) · doc references: `CLAUDE.md`,
`docs/deploy/moyo-vercel-deployment.md` §1/§3.1/§3.2/§5.2,
`docs/deploy/moyo-district-tenancy.md` §2/§5/§6, `docs/site/adr-001-ssr-lane.md`.
