import { postgresAdapter } from '@payloadcms/db-postgres';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildConfig } from 'payload';
import sharp from 'sharp';
import { mcpPlugin } from '@payloadcms/plugin-mcp';
import { bunnyStorage } from '@seshuk/payload-storage-bunny';
import { Users } from './collections/Users';
import { Media } from './collections/Media';
import { Guardianships } from './collections/Guardianships';
import { HandoffCodes } from './collections/HandoffCodes';
import { Consents } from './collections/Consents';
import { Skills } from './collections/Skills';
import { Misconceptions } from './collections/Misconceptions';
import { SessionTranscripts } from './collections/SessionTranscripts';
import { SafetyEvents } from './collections/SafetyEvents';
import { IncidentReports } from './collections/IncidentReports';
import { SessionSummaries } from './collections/SessionSummaries';
import { TutorMessages } from './collections/TutorMessages';
import { TutorSessions } from './collections/TutorSessions';
import { StudentModelFacts } from './collections/StudentModelFacts';
import { Leads } from './collections/Leads';
import { Organizations } from './collections/Organizations';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const serverURL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export default buildConfig({
  admin: {
    user: Users.slug,
    // The login screen is the first Moyo surface a staff member sees, and
    // Payload's own wordmark there reads as "you have left the product".
    // Paths are resolved against `importMap.baseDir`, then compiled into
    // importMap.js by `pnpm --filter web payload:importmap`.
    components: {
      graphics: {
        Logo: './components/Logo#Logo',
        Icon: './components/Icon#Icon',
      },
    },
    importMap: {
      baseDir: dirname,
      importMapFile: path.resolve(dirname, '../../../apps/web/app/(payload)/admin/importMap.js'),
    },
  },
  routes: {
    api: '/payload-api',
  },
  collections: [
    Users,
    Media,
    Guardianships,
    // Sits beside guardianships because it is the same trust relationship in
    // motion: a code is a guardian handing a session to their own ward.
    HandoffCodes,
    Consents,
    // Loop A (doc 07 §4): curriculum content, then the per-learner model
    // derived from it. The two are separate collections because only the
    // second is learner data and only the second is erasable.
    Skills,
    Misconceptions,
    SessionTranscripts,
    // The live conversation, beside the capture it eventually becomes.
    // `sessionTranscripts` is what distillation reads; this is what the child is
    // still typing into, and it is the only Loop A collection that is mutable.
    TutorSessions,
    TutorMessages,
    StudentModelFacts,
    /*
      The guarded safety store (doc 07 §3 layer 7). Listed after the Loop A
      collections and apart from them on purpose: nothing that reads the
      pedagogical model may reach it, and it keeps its own retention window
      rather than the transcript's — a crisis is never a personalization feature.
    */
    SafetyEvents,
    /*
      Doc 31 §4's case file, beside the verdict store and not inside it: the
      event is what the plane did and is never edited, the incident is what a
      person now owes and has a lifecycle. Listed BEFORE the Operations Cloud
      block below, because doc 31 §4.2 extends doc 23's wall to it — the CRM
      never reads incidents, and `tooling/check-crm-wall.mjs` fails the build if
      an import path from ops code to this collection ever appears.
    */
    IncidentReports,
    /*
      Doc 34 §3 — the durable record of learning a guardian is shown. Beside the
      transcript stores but on its OWN retention class: no `expiresAt`, swept by
      nothing, deleted only by the guardian's erasure cascade. Doc 34 extends
      doc 23's wall to it too — CRM sales surfaces never read summaries, and
      `tooling/check-crm-wall.mjs` enforces that on the module graph.
    */
    SessionSummaries,
    // Operations Cloud (doc 28). Kept apart from the Loop A collections above
    // on purpose: business data and learning data never blend, and the schema
    // is where that wall is real rather than a convention.
    Organizations,
    Leads,
  ],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL,
      max: 8,
      connectionTimeoutMillis: 10_000,
      query_timeout: 30_000,
      ssl: process.env.DATABASE_URL?.includes('supabase.co')
        ? { rejectUnauthorized: false }
        : undefined,
    },
    push: process.env.PAYLOAD_PUSH === 'true',
    schemaName: 'payload',
  }),
  cors: [serverURL],
  csrf: [serverURL],
  secret: process.env.PAYLOAD_SECRET || '',
  sharp,
  plugins: [
    /*
      Admin-panel uploads go to Bunny, not to local disk.

      `Media` is `upload: true` with no storage adapter, which means Payload
      writes to the filesystem next to the config — a path that survives neither
      a serverless deploy nor a second instance, so anything uploaded through the
      admin was effectively lost on the next deploy.

      `prefix` namespaces us inside a zone SHARED with sosinspires-mono. It is a
      namespace, not a boundary: the credential still opens the whole zone.

      This adapter is patched (see patches/) — it targets Payload 3 and imports
      `initClientUploads`, which Payload 4 removed. The patch vendors that one
      function; everything else it imports still exists.

      Note this covers the ADMIN path only. Doc 29 §3's learner/guardian uploads
      go client-direct to Bunny with a server-minted presigned URL and never pass
      through here — see docs/decisions/bunny-storage-presign-spike.md.
    */
    ...(process.env.BUNNY_STORAGE_ACCESS_KEY
      ? [
          bunnyStorage({
            collections: {
              media: {
                prefix: (process.env.BUNNY_MEDIA_PREFIX ?? 'moyolearn/').replace(/\/$/, ''),
                disablePayloadAccessControl: true,
              },
            },
            storage: {
              apiKey: process.env.BUNNY_STORAGE_ACCESS_KEY,
              hostname: new URL(
                process.env.NEXT_PUBLIC_BUNNY_CDN_BASE_URL ?? 'https://example.b-cdn.net',
              ).host,
              zoneName: process.env.BUNNY_STORAGE_ZONE_NAME ?? '',
              region: process.env.BUNNY_STORAGE_REGION,
            },
          }),
        ]
      : []),
    mcpPlugin({
      // `users` is deliberately absent. It is the auth collection and it is where
      // learner identity lands — doc 13 keeps learner data off machine-readable
      // surfaces in every version, so it never gets an MCP tool.
      collections: {
        media: {},
      },
      // ponytail: off unless switched on. The plugin's default access is
      // `Boolean(req.user)`, which would hand the whole tool surface to any
      // authenticated account — not the fail-closed posture doc 07/12 require.
      // Per-tool `access` is the real fix; it arrives with doc 13's scope
      // registry. Until then the endpoint simply isn't registered.
      disabled: process.env.PAYLOAD_MCP_ENABLED !== 'true',
    }),
  ],
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
});
