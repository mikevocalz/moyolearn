// Proves the retention sweep against the live zone: write an object, list it,
// delete it, confirm it is gone. Re-run after any change to the sweep.
import nextEnv from '@next/env';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
nextEnv.loadEnvConfig(resolve(dirname(fileURLToPath(import.meta.url)), '../../..'), true, console);

const { listRecursive } = await import('../lib/bunny-list.ts');
const { deleteObject } = await import('../lib/bunny-delete.ts');
const { MEDIA_TTL_DAYS } = await import('@acme/app/features/media/retention.ts');

const region = process.env.BUNNY_STORAGE_REGION ?? 'ny';
const zone = {
  host: `${region}.storage.bunnycdn.com`,
  zone: process.env.BUNNY_STORAGE_ZONE_NAME!,
  password: process.env.BUNNY_STORAGE_ACCESS_KEY!,
};
const prefix = process.env.BUNNY_MEDIA_PREFIX?.replace(/\/+$/, '') ?? 'moyolearn';
const key = `${prefix}/__sweep-probe-${Date.now()}.txt`;

const put = await fetch(`https://${zone.host}/${zone.zone}/${key}`, {
  method: 'PUT',
  headers: { AccessKey: zone.password, 'content-type': 'text/plain' },
  body: 'retention probe',
});
console.log('1. wrote probe ->', put.status);

const listed = await listRecursive(zone, prefix);
const found = listed.find((o) => o.path === key);
console.log('2. listRecursive found it ->', Boolean(found), found ? `(lastChanged ${found.lastChanged})` : '');
console.log(`   objects under ${prefix}/: ${listed.length}`);

const cutoff = Date.now() - MEDIA_TTL_DAYS * 86_400_000;
const expired = listed.filter((o) => {
  const t = Date.parse(o.lastChanged);
  return !Number.isNaN(t) && t <= cutoff;
});
console.log(`3. past ${MEDIA_TTL_DAYS} days -> ${expired.length} (the fresh probe must NOT be among them)`);
console.log('   probe counted as expired ->', expired.some((o) => o.path === key));

console.log('4. delete ->', await deleteObject(zone, key));
const after = await listRecursive(zone, prefix);
console.log('5. gone from listing ->', !after.some((o) => o.path === key));
console.log('6. deleting again (404 must read as success) ->', await deleteObject(zone, key));
process.exit(0);
