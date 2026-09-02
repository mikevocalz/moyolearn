/**
 * The document. Under Start the root route owns `<html>` through
 * `shellComponent`, so there is no index.html — `HeadContent` writes whatever
 * each route's `head()` returned and `Scripts` writes the hydration bundle.
 *
 * The stylesheet is referenced as a URL rather than side-effect imported: the
 * prerendered HTML must carry a real `<link rel="stylesheet">` so a crawler
 * (and a JS-off reader) gets styles without executing the client bundle.
 *
 * `moyo-site` on <body> is the marketing site's ground (packages/theme
 * build-css.mjs `SITE_SCOPE`). It belongs here and not on a page wrapper for
 * two reasons: it pins `color-scheme: light`, which only means anything if it
 * is above everything that reads a `light-dark()` token, and it re-points the
 * product's chrome variables, which have to be in scope for any portal or
 * overlay a kit component renders outside the route subtree.
 *
 * `MotionRuntime` is the site's scroll runtime (Lenis → ScrollTrigger). It sits
 * inside <body> rather than in a page component because the runtime is a
 * property of the DOCUMENT — Lenis takes over `window` scrolling and
 * ScrollTrigger measures against it, so a per-route mount would tear the whole
 * thing down and rebuild it on every navigation. It renders null and imports
 * nothing at module scope; the libraries arrive in an async chunk from an
 * effect, which is what keeps the prerender pass free of any scroll library.
 *
 * SOT: node_modules/@tanstack/react-router/dist/esm/index.d.ts:HeadContent,Scripts
 *      node_modules/@tanstack/react-router/dist/esm/route.d.ts:shellComponent
 *      packages/theme/build-css.mjs (SITE_SCOPE) · apps/web-vite/src/fonts.css
 *      apps/web-vite/src/motion/MotionRuntime.tsx
 * SOT-KEYWORDS: web-vite root route shell document head scripts stylesheet ssr
 *               moyo-site ground preload font motion lenis runtime
 */
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';
// Imported from the file, NOT from `../motion`: the barrel reaches
// `useMotionScene` → `@/stores/perf-store`, whose module-scope media-query
// subscription is a side effect Rollup cannot shake, so a barrel import would
// pull Zustand and the store into the initial bundle in order to render null.
import { MotionRuntime } from '../motion/MotionRuntime';
import appCss from '../globals.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
    links: [
      /*
       * The display face, discovered in the head rather than three hops later.
       * Only this one is preloaded: it sets the hero, so it is on the critical
       * path by definition, and preloading a second face would compete with it
       * for the same connection while nothing above the fold needed it.
       *
       * It is a literal path and not a Vite asset import on purpose — the
       * `href` here and the `src` in fonts.css must be byte-identical strings
       * or the browser fetches the file twice, and a hashed module-graph URL
       * cannot be spelled from this file. public/ is what makes both spellings
       * `/fonts/…`.
       *
       * `crossOrigin` is required even same-origin: fonts are always fetched in
       * CORS mode, so a preload without it is a second, unmatched request.
       */
      {
        rel: 'preload',
        as: 'font',
        type: 'font/woff2',
        href: '/fonts/ClashDisplay-Variable.woff2',
        crossOrigin: 'anonymous',
      },
      { rel: 'stylesheet', href: appCss },
      /*
       * The tab icon, which this app shipped without — no file and no link, so
       * every marketing page rendered under the browser's blank-page glyph.
       *
       * It is the compact MARK and not the wordmark: at 16px "MOYO LEARN" is
       * four illegible smudges, and a favicon is always a 16px slot somewhere.
       * The `.ico` carries 16/32/48 so the browser picks rather than downscales.
       * Literal public/ paths for the same reason as the font above — these are
       * requested by the browser and by crawlers that never run the module graph.
       */
      { rel: 'icon', href: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      { rel: 'icon', type: 'image/png', href: '/icon.png', sizes: '256x256' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' },
    ],
  }),
  /*
    One document, because this app is one surface again (ADR-004). Between
    ADR-003 and ADR-004 this was `withPayloadRoot(RootDocument)`, which swapped
    in Payload's own `<html>` under `/admin`; the super admin now has its own
    app and its own root, so the marketing `head()` above is unconditionally
    the head of every page this app serves.
  */
  shellComponent: RootDocument,
  component: Outlet,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="moyo-site bg-moyo-paper font-moyo-text text-moyo-ink">
        {children}
        <MotionRuntime />
        <Scripts />
      </body>
    </html>
  );
}
