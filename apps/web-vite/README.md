# web-vite — the Moyo marketing site

TanStack Start on Vite. Marketing routes are **prerendered to static HTML at
build time**, so a crawler reads the copy without executing JavaScript, and the
pages are built from the shared kit (`@acme/ui`) rather than a parallel set of
marketing components.

The lane decision, what was measured, and what it costs:
**[docs/site/adr-001-ssr-lane.md](../../docs/site/adr-001-ssr-lane.md)**.

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

## Layout

```
src/
  router.tsx        required Start entry — exports getRouter()
  routes/
    __root.tsx      the <html> document: shellComponent + HeadContent + Scripts,
                    the `moyo-site` ground class, and the display-face preload
    index.tsx       "/" — the hero
  routeTree.gen.ts  generated on every dev/build; never edited, never linted
  globals.css       Tailwind 4 entry + @acme/theme tokens + fonts + @source globs
  fonts.css         @font-face for the four self-hosted site faces
public/
  fonts/            the woff2 files + their licence texts
vite.config.ts      plugins, the react-native-web SSR wiring
postcss.config.mjs  @tailwindcss/postcss
```

`@` is aliased to `./src`.

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
dist/server/server.js    the SSR fetch handler (needed only for dynamic routes)
```

`dist/client` is a plain static directory. If a page ever renders empty, look for
`<!--$!-->` in the HTML: that is React's marker for an SSR throw that fell back to
client rendering, and it is the only symptom — the build still exits 0.

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
