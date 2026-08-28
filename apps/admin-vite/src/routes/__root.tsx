/**
 * The document. Under Start the root route owns `<html>` through
 * `shellComponent`, so there is no index.html.
 *
 * `withPayloadRoot` renders Payload's OWN `<html>` — carrying the
 * server-computed `data-theme`, `lang` and `dir` the panel needs on first paint
 * — for anything under `config.routes.admin`. That is every real page in this
 * app. `FallbackDocument` below exists for the two things that are not the
 * panel: `/`, which redirects into it, and a 404 for a path the panel does not
 * own.
 *
 * The wrapper is kept rather than using `PayloadAdminShell` directly because
 * the shell reads its html props out of the `/_payload` layout's loader data;
 * on a route that never matched that layout there is none, and
 * `withPayloadRoot`'s pathname check is what routes around that case instead of
 * rendering an admin document with no theme.
 *
 * There is no `head()` here. Marketing's root carries title/description/OG and
 * a font preload; the panel's head is Payload's, written by `HeadContent` from
 * the admin route's own `head()`, and this app has no page that wants a
 * different one. `X-Robots-Tag: noindex, nofollow` on the `_payload` layout is
 * what keeps the panel out of an index — a `<meta name="robots">` on a document
 * that only renders behind a login would be decoration.
 *
 * SOT: node_modules/@payloadcms/tanstack-start/dist/layouts/Root/withPayloadRoot.d.ts:
 *        withPayloadRoot, PayloadAdminShell
 *      node_modules/@tanstack/react-router/dist/esm/route.d.ts:shellComponent
 * SOT-KEYWORDS: admin-vite root route shell document payload admin super admin
 */
import { withPayloadRoot } from '@payloadcms/tanstack-start/client';
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';

export const Route = createRootRoute({
  shellComponent: withPayloadRoot(FallbackDocument),
  component: Outlet,
});

function FallbackDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
