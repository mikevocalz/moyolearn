# web-vite — the Moyo marketing site

One surface, as
[`docs/deploy/moyo-vercel-deployment.md`](../../docs/deploy/moyo-vercel-deployment.md)
§1 lays it out:

| Surface | Path | Host in production | Rendering |
| --- | --- | --- | --- |
| Marketing | `/`, `/motion-lab`, `/globe-lab`, `/chapters-lab` | `www.moyolearn.com` | prerendered to static HTML at build time |

Pages are built from the shared kit (`@acme/ui`) rather than a parallel set of
marketing components, and a crawler reads their copy without executing
JavaScript.

**The Payload super admin used to live here** and does not any more. It is
[`apps/admin-vite`](../admin-vite/README.md), on its own Vercel project, and the
reason is a measurement: `tanstackStart({ rsc: { enabled: true } })` builds one
client entry for the whole app, so turning RSC on for the panel put
`@vitejs/plugin-rsc`'s browser runtime on this app's critical path — 155.8 →
245.6 kB gz of initial JS on `/`, none of it Payload code, with no per-route
opt-out. The split put it back to 155.8 kB gz.

Decisions, what was measured, and what each costs:
**[adr-001](../../docs/site/adr-001-ssr-lane.md)** (the SSR lane),
**[adr-003](../../docs/site/adr-003-payload-admin-on-tanstack.md)** (how the
admin was built) and
**[adr-004](../../docs/site/adr-004-admin-app-split.md)** (why it moved out).

## Commands

Run from the repo root (or from this directory with `pnpm <script>`):

```bash
pnpm --filter web-vite dev        # dev server with SSR, HMR and Fast Refresh
pnpm --filter web-vite build      # client + SSR builds, then the prerender pass
pnpm --filter web-vite preview    # serve the built output
pnpm --filter web-vite typecheck  # tsc --noEmit
pnpm --filter web-vite lint       # eslint (shared flat config)
```

Node must satisfy the root `engines` field (`>=24.15.0 <26`); the machine's
default `node` may be newer, in which case put the pinned major first:
`export PATH=/opt/homebrew/opt/node@24/bin:$PATH`.

The dev server is on **5173**; the super admin is on 5174, so both run at once.
This app needs no environment at all — there is nothing here that reads a
database.

## Layout

```
src/
  router.tsx        required Start entry — exports getRouter()
  routes/
    __root.tsx      the <html> document — one shell, one surface
    index.tsx       "/" — the hero
    chapters-lab.tsx · globe-lab.tsx · motion-lab.tsx   unlinked audit surfaces
  routeTree.gen.ts  generated on every dev/build; never edited, never linted
  globals.css       Tailwind 4 entry + @acme/theme tokens + fonts + @source globs
  fonts.css         @font-face for the four self-hosted site faces
public/
  fonts/            the woff2 files + their licence texts
vite.config.ts      plugins, react-native-web SSR wiring, the prerender pass
```

`@` is aliased to `./src`.

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
dist/server/server.js    the SSR fetch handler
```

`dist/client` is a plain static directory, and it must contain **exactly four**
HTML files: `index.html`, `chapters-lab/`, `globe-lab/`, `motion-lab/`:

```bash
pnpm --filter web-vite build
find apps/web-vite/dist/client -name '*.html'   # four files
```

If a page ever renders empty, look for `<!--$!-->` in the HTML: that is React's
marker for an SSR throw that fell back to client rendering, and it is the only
symptom — the build still exits 0.

**Initial JS on `/` is the budget this app is measured against**, and the number
is what forced the admin out (ADR-004). Resolve the script graph out of the
prerendered `index.html` — the `<script src>` plus every `modulepreload` link —
and gzip those files. It is **155.8 kB gz** at the time of writing, across six
files, `dist/client/index.js` being 99.9 kB gz of it.

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

Two more:

- **`define` belongs in a plugin here, not at the top level.**
  `vite-plugin-react-native-web` sets `global: 'self'` in its `config()` hook, and
  Vite merges plugin config *over* the user's — the opposite of what you would
  expect, and the opposite of what a `define` block that used to sit at the top of
  `vite.config.ts` claimed. The `moyo:global-is-globalthis` plugin
  (`enforce: 'post'`) is what actually wins. The build is currently green without
  it — measured during the ADR-004 split, both ways, same 155.8 kB gz — and it is
  kept anyway, because `self` is a browser-only identifier and the SSR/prerender
  pass runs in Node. The failure mode it prevents is not a build error; it is a
  `ReferenceError: self is not defined` thrown out of a *server* chunk mid-
  prerender, which is what `@payloadcms/ui` did when it was in this graph.
- **Do not reintroduce `@vitejs/plugin-rsc` or `withPayload` here.** They are what
  the split removed; see the header of `vite.config.ts` for the number.
