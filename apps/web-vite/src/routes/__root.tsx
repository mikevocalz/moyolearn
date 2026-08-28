/**
 * The document. Under Start the root route owns `<html>` through
 * `shellComponent`, so there is no index.html — `HeadContent` writes whatever
 * each route's `head()` returned and `Scripts` writes the hydration bundle.
 *
 * The stylesheet is referenced as a URL rather than side-effect imported: the
 * prerendered HTML must carry a real `<link rel="stylesheet">` so a crawler
 * (and a JS-off reader) gets styles without executing the client bundle.
 *
 * SOT: node_modules/@tanstack/react-router/dist/esm/index.d.ts:HeadContent,Scripts
 *      node_modules/@tanstack/react-router/dist/esm/route.d.ts:shellComponent
 * SOT-KEYWORDS: web-vite root route shell document head scripts stylesheet ssr
 */
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';
import appCss from '../globals.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
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
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
