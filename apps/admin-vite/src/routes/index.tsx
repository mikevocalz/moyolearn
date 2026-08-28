/**
 * `/` — the only route in this app that is not the panel, and it exists so that
 * it isn't a dead end.
 *
 * In production this app answers on `admin.moyolearn.com` (deployment §1), and
 * the host is what a staff member types or bookmarks; the panel lives one
 * segment down at `/admin` because `routes.admin` is a property of the ONE
 * shared config (deployment §5.2) and moving it here would fork that config for
 * one app's convenience. A redirect costs one hop and keeps the config single.
 *
 * `beforeLoad` rather than a component that redirects on mount: the throw
 * happens during the server render, so the response is a real 307 with a
 * `Location` header rather than a 200 carrying a blank document and a
 * client-side hop.
 *
 * The `no-store` / `noindex` headers are repeated here rather than inherited,
 * because this route is a sibling of the `_payload` layout and not a child of
 * it. A 307 into a private surface is not itself private, but it is also not
 * something a CDN should hold or a crawler should follow — and both defaults
 * are the wrong way round.
 *
 * SOT: node_modules/@tanstack/react-router/dist/esm/redirect.d.ts:redirect
 *      node_modules/@tanstack/router-core/dist/esm/route.d.ts:353 (headers)
 *      docs/deploy/moyo-vercel-deployment.md §1
 * SOT-KEYWORDS: admin-vite index route redirect admin super admin root
 */
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/admin' });
  },
  headers: () => ({
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Robots-Tag': 'noindex, nofollow',
  }),
});
