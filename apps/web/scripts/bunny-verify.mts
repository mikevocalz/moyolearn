import nextEnv from '@next/env';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
nextEnv.loadEnvConfig(root, true, console);

const { bunnyStorage } = await import('@seshuk/payload-storage-bunny');
const { buildConfig, getPayload } = await import('payload');
const { postgresAdapter } = await import('@payloadcms/db-postgres');

const e = process.env;
const config = await buildConfig({
  secret: e.PAYLOAD_SECRET || 'verify',
  db: postgresAdapter({
    pool: { connectionString: e.DATABASE_URL, max: 3, ssl: { rejectUnauthorized: false } },
    push: false, schemaName: 'payload',
  }),
  collections: [
    { slug: 'users', auth: true, fields: [] },
    { slug: 'media', upload: true, access: { read: () => true }, fields: [{ name: 'alt', type: 'text' }] },
  ],
  plugins: [bunnyStorage({
    collections: { media: { prefix: e.BUNNY_MEDIA_PREFIX?.replace(/\/$/, '') || 'moyolearn', disablePayloadAccessControl: true } },
    storage: {
      apiKey: e.BUNNY_STORAGE_ACCESS_KEY!,
      hostname: new URL(e.NEXT_PUBLIC_BUNNY_CDN_BASE_URL!).host,
      zoneName: e.BUNNY_STORAGE_ZONE_NAME!,
      region: e.BUNNY_STORAGE_REGION,
    },
  })],
});

const payload = await getPayload({ config });
console.log('\n1. getPayload() -> BOOTED (the version guard and the missing export are both cleared)');

const name = `patched-adapter-${Date.now()}.txt`;
const data = Buffer.from('uploaded through the PATCHED bunny adapter on Payload 4');
const doc = await payload.create({
  collection: 'media', data: { alt: 'patch verification' },
  file: { name, data, mimetype: 'text/plain', size: data.length },
});
console.log('2. payload.create() -> OK · id', doc.id);
console.log('   url:', (doc as { url?: string }).url ?? '(none)');

const host = `${e.BUNNY_STORAGE_REGION}.storage.bunnycdn.com`;
const zone = e.BUNNY_STORAGE_ZONE_NAME!;
const key = e.BUNNY_STORAGE_ACCESS_KEY!;
let landed = '';
for (const p of [`moyolearn/${name}`, name]) {
  const r = await fetch(`https://${host}/${zone}/${p}`, { headers: { AccessKey: key } });
  console.log(`3. verify ${p} -> ${r.status}${r.ok ? '  BYTES IN BUNNY' : ''}`);
  if (r.ok) { landed = p; console.log('   content matches:', (await r.text()) === data.toString()); }
}
if (landed) {
  await payload.delete({ collection: 'media', id: doc.id });
  const after = await fetch(`https://${host}/${zone}/${landed}`, { headers: { AccessKey: key } });
  console.log(`4. after payload.delete -> ${after.status}${after.status === 404 ? '  delete cascaded to Bunny' : '  STILL PRESENT'}`);
}
process.exit(0);
