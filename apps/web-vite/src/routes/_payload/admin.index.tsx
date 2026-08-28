/**
 * `/admin` — the panel's own index (dashboard, or the login view when there is
 * no session). Separate from the splat route beside it because Payload's
 * not-found handling differs: an index miss has no server-built NotFound page
 * to ship, so it falls back to the client view.
 *
 * Everything about this route — component, head, loader, search validation — is
 * adapter-owned. The app supplies exactly one thing: the server function that
 * renders the page.
 *
 * SOT: node_modules/@payloadcms/tanstack-start/dist/routes/adminRoutes.d.ts:
 *        payloadAdminIndexRoute
 * SOT-KEYWORDS: web-vite payload admin index route super admin dashboard
 */
import { payloadAdminIndexRoute } from '@payloadcms/tanstack-start/client';
import { createFileRoute } from '@tanstack/react-router';

import { loadAdminPageRSC } from './server.functions';

export const Route = createFileRoute('/_payload/admin/')(
  payloadAdminIndexRoute({ load: loadAdminPageRSC }),
);
