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

const dirname = path.dirname(fileURLToPath(import.meta.url));
const serverURL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: dirname,
      importMapFile: path.resolve(dirname, '../../../apps/web/app/(payload)/admin/importMap.js'),
    },
  },
  routes: {
    api: '/payload-api',
  },
  collections: [Users, Media, Guardianships, Consents],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL,
      max: 8,
      connectionTimeoutMillis: 10_000,
      query_timeout: 30_000,
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
