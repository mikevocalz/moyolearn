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
    ],
  }),
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
