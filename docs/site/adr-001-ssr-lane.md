# ADR 001: The marketing site's SSR lane
Status: proposed · Date: 2026-08-28

<!--
The Phase 0 lane decision for the Moyo marketing site. Written to the
`architecture` skill's format; filed under docs/site/ rather than docs/adr/
because the build spec names this path and every later site doc lands beside it.
SOT: this file · apps/web-vite/vite.config.ts · apps/web-vite/README.md
SOT-KEYWORDS: adr ssr lane tanstack start prerender web-vite marketing seo rnw uniwind
-->

## Context

The marketing site must serve real HTML: a crawler that never executes JavaScript
has to read the hero copy, the title, the description and the canonical link. The
site must also render the shared kit — `@acme/ui` — so marketing and product do
not drift into two visual systems.

That is a harder constraint here than it looks, because the kit is a React Native
kit wearing a web coat:

- `packages/ui/tw.tsx` and `packages/ui/html/index.tsx` build every element on
  `@expo/html-elements`, which builds on `react-native-web`.
- The styling boundary is `packages/ui/html/css.tsx`, a platform fork. The web
  side (`css.web.tsx`) resolves `className` through `react-native-css`'s
  `useCssElement`; the native side (`css.native.tsx`) uses Uniwind's
  `withUniwind`. The fork is keyed on **platform**, not on bundler, and its own
  header records why: Uniwind is Metro/Vite-only and does not support Next.js.
- The token layer is Tailwind 4 with `@acme/theme/theme.css`, no
  `tailwind.config.js`.

`apps/web` (Next.js) already server-renders this chain, so SSR of the kit is not
unprecedented. What was unproven is whether it survives **Vite's** SSR pipeline,
where dependencies are externalised to Node's ESM loader by default and the
expo/react-native packages are published for Metro's resolver instead.

`apps/web-vite` existed as an untracked, unmodified copy of the
`gurselcakar/universal-react-monorepo` scaffold: a Router SPA declaring
`"ui": "workspace:*"`, `tailwindcss ^3.4.18`, a `nativewind-env.d.ts`, and
hardcoded versions. None of that is our stack. The folder shape and scripts were
worth keeping; the wiring was not.

## Options

| Option | How it works | Verified seam (file:symbol) | Pros | Cons |
| --- | --- | --- | --- | --- |
| **A. TanStack Start, static prerender** (chosen) | Start's Vite plugin owns routing and an SSR environment; `prerender.enabled` renders each page to `dist/client/**/index.html` at build time. Routes stay `src/routes/*` + `createFileRoute` + `routeTree.gen.ts`; a required `src/router.tsx` exports `getRouter`. | `node_modules/@tanstack/react-start/dist/esm/plugin/vite.d.ts:tanstackStart` · `node_modules/@tanstack/start-plugin-core/dist/esm/schema.d.ts` (`prerender`, `pages[].prerender`, `spa`) · `node_modules/@tanstack/start-plugin-core/dist/esm/planning.js` (`defaultEntry: 'router'`) · `node_modules/@tanstack/start-client-core/dist/esm/startEntry.d.ts:RouterEntry.getRouter` · `node_modules/@tanstack/react-router/dist/esm/index.d.ts:HeadContent,Scripts` · `node_modules/@tanstack/react-router/dist/esm/route.d.ts:shellComponent` | Emits the real DOM, not a shell — the `<h1>` is in the byte stream. `head()` puts title/description/OG/canonical in `<head>` per route. Same file-route artefacts as Lane B, so Lane B stays one option flip away. Dynamic routes later get a server without a second framework. | Peers `vite: >=7.0.0`, forcing a workspace-wide Vite bump. Every Metro-shaped dependency in the kit's tree must be named in `ssr.noExternal` (see Consequences). Two runtimes to keep green (Node SSR + browser) instead of one. |
| **B. Router SPA + Start's SPA-mode prerender** | Keep `createRouter` + `RouterProvider` in a browser entry; use Start's `spa: { enabled, maskPath, prerender }` to prerender a shell and let the client fill it. | `node_modules/@tanstack/start-plugin-core/dist/esm/schema.d.ts` (`spa.maskPath`, `spa.prerender.outputPath`) | No Node render path, so none of the CommonJS/Metro-resolution work below. Smallest possible build surface. | The prerendered artefact is a **shell**: gate item 1 asks for hero copy in `view-source`, and SPA mode is defined by that copy *not* being there. Still needs Start (so the Vite 7 bump lands anyway) — it buys nothing the bump was the price of. |
| **C. Stay on Router SPA, add a third-party prerenderer** | `vite build`, then a headless-Chrome prerender pass (`vite-plugin-prerender` / `puppeteer` script) writing HTML per route. | none — nothing of this shape is installed | Zero framework change. | Would have to be invented and installed; the prerenderer runs the same React tree through a browser rather than Node, so it proves less about the kit and adds a build-time browser dependency. Rejected without implementation because Lane A passed. |

Lane B lost on the gate itself, not on taste: gate item 1 is "`view-source` of `/`
contains the real hero copy (not an empty div)", and SPA mode's contract is that
`/` is served as a mask. It stays the documented fallback because the route files
are identical — reverting is a plugin-option change, not a rewrite.

## Decision

**Lane A.** `apps/web-vite` runs TanStack Start on Vite 7 with
`prerender: { enabled: true, crawlLinks: true, failOnError: true }`, wired to
`@acme/ui`, `@acme/theme` and Tailwind 4. `pnpm --filter web-vite build` emits
`dist/client/index.html` containing the fully rendered hero.

Catalog additions (`pnpm-workspace.yaml`), all referenced as `catalog:`:

- `@tanstack/react-router@1.170.32`
- `@tanstack/react-start@1.168.49`
- `vite` bumped `6.4.1 → 7.3.6` — Start peers `vite: >=7.0.0`. Verified the
  other two consumers accept it: `@storybook/builder-vite@10.5.8` peers
  `^5 || ^6 || ^7 || ^8`, `@vitejs/plugin-react@4.7.0` peers
  `^4.2 || ^5 || ^6 || ^7`. 7.3.6 and not 8.x because plugin-react stops at ^7.
  `pnpm --filter storybook build` was re-run after the bump and completes.

No new dependency was added to make the kit render — the SSR work was entirely
Vite configuration.

### What was proved, and how

1. **Real HTML.** `dist/client/index.html` is 2 947 bytes and contains
   `<h1 dir="auto" aria-level="1" role="heading" class="… font-display text-display-xl …">AI tutoring that helps children learn it by heart</h1>`
   inside `<main role="main">`, with `<title>`, `<meta name="description">`,
   `<meta property="og:*">` and `<link rel="canonical">` in `<head>`. React's
   suspense-error marker `<!--$!-->` is absent (its presence is how an SSR throw
   shows up — the first two build attempts produced exactly that, and it is the
   check that catches a silently client-rendered page).
2. **Zero hydration mismatches.** Headless Chrome (Playwright 1.62.1,
   `channel: 'chrome'`) against both the prerendered output and `vite dev`:
   0 page errors, 0 console messages matching hydration/mismatch patterns, and
   `document.querySelector('h1')` still holding the same text after hydration.
   Dev is checked separately on purpose — it runs React's development build,
   which is the only one that emits the full mismatch warnings.
3. **`pnpm typecheck` clean.** 17/17 tasks, 0 cached (`--force`).
4. **Lighthouse SEO 100.** Measured, not asserted: Lighthouse 13.4.1 against the
   prerendered output. Accessibility 100, best-practices 96, performance 73.

## Consequences

- **Easier:**
  - Marketing pages get title/description/OG/canonical per route from `head()`,
    colocated with the route file.
  - The kit is now a proven SSR surface on Vite, so Phase 1 chapters can be built
    from `@acme/ui` rather than bespoke marketing components.
  - Adding a route is adding a file; `crawlLinks: true` means anything reachable
    by an anchor from `/` prerenders without touching config.
  - The escape hatch to Lane B is one option object.

- **Harder / costs:**
  - **`ssr.noExternal` is now a maintained list.** Node's ESM loader does not do
    what Metro's resolver does, and every failure mode showed up as a *silently
    client-rendered page*, not a build error. Four distinct classes, all
    recorded in `apps/web-vite/vite.config.ts`:
    `ERR_MODULE_NOT_FOUND` on extensionless relative imports
    (`expo-drag-drop-content-view`), `SyntaxError: Unexpected token 'typeof'`
    from a CommonJS package `require`-ing React Native's Flow source
    (`@legendapp/motion`), `createPrefixer is not a function` from CommonJS
    modules that set `exports.default` without reassigning `module.exports`
    (react-native-web's whole dependency closure), and
    `Directory import … is not supported` (`solito/image`). A kit component that
    pulls in a new Metro-shaped package will reopen this list.
  - **Dev and build fail differently.** Rollup's commonjs plugin covers the
    production build; `vite dev` evaluates SSR modules with an ESM module runner
    that has no interop, so the same packages additionally need
    `optimizeDeps.include` on **both** environments. Checking only `pnpm build`
    would have shipped a dev server that client-renders every page.
  - **Vite 7 is now the workspace version.** Storybook and any future Vite
    consumer move with it.
  - **`import { … } from '@acme/ui'` costs a lot on a marketing page.** The root
    barrel reaches Skia, gesture-handler, reanimated, expo native modules and
    forms. Client JS for one hero is 318 kB + 319 kB (98 kB + 95 kB gzipped) and
    the SSR chunk is 571 kB. Lighthouse performance is 73 with FCP 4.4 s. The
    fix is not architectural — `@acme/ui/primitives` is a declared entry point in
    `packages/ui/package.json` and reaches the same elements without the barrel —
    but it is a Phase 1 decision about which surface marketing imports from, and
    it is deliberately not made here: the spike's job was to prove the *whole*
    kit renders, and the fat number is the evidence that it does.
  - **Uniwind does not run on this app either.** Not a Vite limitation — the
    `css.web.tsx` fork is keyed on platform, and it is shared with the Next app.
    Web (both apps) resolves classNames through `react-native-css`. Moving
    web-vite onto Uniwind's Vite support would mean forking the fork by bundler,
    which is a change to `packages/ui`, not to this app.

- **Follow-ups:**
  - Phase 1 decides the marketing import surface (`@acme/ui` barrel vs
    `@acme/ui/primitives`) with the bundle numbers above in hand.
  - No favicon: the browser's implicit `/favicon.ico` request 404s, which is the
    single item costing Lighthouse best-practices 4 points. Branding is Phase 1.
  - `<Text>` renders as a `<div>` (react-native-web maps `Span` without a role
    to a div). Fine for the spike; marketing prose should use `Paragraph` from
    `@acme/ui/primitives`, which carries `role="paragraph"` and emits a real
    `<p>`.
  - The hosting target is unset. Prerendered output is a static directory, so
    any static host serves it; a dynamic route later needs `dist/server/server.js`
    on a fetch-capable runtime.

## Constraints honored

Zustand-only (no component state introduced) · tokens-only (`bg-surface`,
`py-section`, `gap-stack`, `max-w-content-prose` — all resolved against
`packages/theme/theme.css`) · no invented APIs (every Start/Router symbol cited
above was read out of the installed `.d.ts` before it was imported) · all new
dependencies declared once in the `pnpm-workspace.yaml` catalog and referenced as
`catalog:` · doc references: `CLAUDE.md`, `packages/ui/index.ts`,
`packages/ui/html/css.web.tsx`, `apps/storybook/.storybook/main.ts`.
