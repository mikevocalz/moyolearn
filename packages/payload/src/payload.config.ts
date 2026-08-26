import { postgresAdapter } from '@payloadcms/db-postgres';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildConfig } from 'payload';
import sharp from 'sharp';
import { mcpPlugin } from '@payloadcms/plugin-mcp';
import { Users } from './collections/Users';
import { Media } from './collections/Media';
import { Guardianships } from './collections/Guardianships';
import { Consents } from './collections/Consents';
import { Skills } from './collections/Skills';
import { Misconceptions } from './collections/Misconceptions';
import { SessionTranscripts } from './collections/SessionTranscripts';
import { StudentModelFacts } from './collections/StudentModelFacts';

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
    Consents,
    // Loop A (doc 07 §4): curriculum content, then the per-learner model
    // derived from it. The two are separate collections because only the
    // second is learner data and only the second is erasable.
    Skills,
    Misconceptions,
    SessionTranscripts,
    StudentModelFacts,
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
