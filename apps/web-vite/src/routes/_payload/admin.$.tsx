/**
 * `/admin/*` — every view below the panel's root: collection lists, documents,
 * globals, account, the login and reset-password screens. One splat route
 * rather than a file per view, because Payload resolves the view from the path
 * itself and ships the result as a Flight payload; the router's only job is to
 * hand it the splat.
 *
 * SOT: node_modules/@payloadcms/tanstack-start/dist/routes/adminRoutes.d.ts:
 *        payloadAdminSplatRoute
 * SOT-KEYWORDS: web-vite payload admin splat route collections views super admin
 */
import { payloadAdminSplatRoute } from '@payloadcms/tanstack-start/client';
import { createFileRoute } from '@tanstack/react-router';

import { loadAdminPageRSC } from './server.functions';

export const Route = createFileRoute('/_payload/admin/$')(
  payloadAdminSplatRoute({ load: loadAdminPageRSC }),
);
