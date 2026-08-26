// Full media round-trip against the live zone: presign -> credential-free PUT ->
// read back through the CDN -> clean up. Re-run this after any Bunny config
// change; it is what catches a stale edge cache or a re-pointed origin.
import nextEnv from '@next/env';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
nextEnv.loadEnvConfig(resolve(dirname(fileURLToPath(import.meta.url)), '../../..'), true, console);
const { signPutUrl, encodeKey } = await import('../lib/bunny-sign.ts');
const e = process.env;
const zone = e.BUNNY_STORAGE_ZONE_NAME!, sk = e.BUNNY_STORAGE_ACCESS_KEY!;
const prefix = (e.BUNNY_MEDIA_PREFIX ?? '').replace(/^\/+|\/+$/g, '');

const cases = [
  { kind: 'audio', name: 'voice-note.m4a', type: 'audio/m4a' },
  { kind: 'image', name: 'photo.png', type: 'image/png' },
  { kind: 'document', name: 'report.pdf', type: 'application/pdf' },
];
let ok = true;
for (const c of cases) {
  const key = `${prefix ? prefix + '/' : ''}${c.kind}/_verify/${Date.now()}/${c.name}`;
  const body = `moyo ${c.kind} ${Math.random().toString(36).slice(2)}`;
  const put = await fetch(
    signPutUrl({ zone, secret: sk, region: e.BUNNY_STORAGE_REGION ?? 'ny', key, contentType: c.type, expiresIn: 900 }),
    { method: 'PUT', headers: { 'Content-Type': c.type }, body },
  );
  /*
    Read-after-write is not instant at the edge: a brand-new object can 404 for a
    beat while the PoP learns about it. Retrying a few times distinguishes "not
    propagated yet" from "actually broken" — without this the check is flaky and
    a flaky check gets ignored.
  */
  let cdnStatus = 0;
  let match = false;
  let tries = 0;
  for (; tries < 6 && !match; tries++) {
    if (tries) await new Promise((r) => setTimeout(r, 750));
    const cdn = await fetch(`${e.NEXT_PUBLIC_BUNNY_CDN_BASE_URL}/${encodeKey(key)}`, { cache: 'no-store' });
    cdnStatus = cdn.status;
    match = cdn.ok && (await cdn.text()) === body;
  }
  if (!put.ok || !match) ok = false;
  console.log(`${c.kind.padEnd(9)} PUT ${put.status} · CDN ${cdnStatus} · bytes ${match ? 'MATCH' : 'MISMATCH'}${tries > 1 ? ` (after ${tries} tries)` : ''}`);
  await fetch(`https://${e.BUNNY_STORAGE_REGION}.storage.bunnycdn.com/${zone}/${key}`, { method: 'DELETE', headers: { AccessKey: sk } });
}
const tamper = await fetch(
  signPutUrl({ zone, secret: sk, region: e.BUNNY_STORAGE_REGION ?? 'ny', key: 'image/_verify/t.png', contentType: 'image/png', expiresIn: 900 }),
  { method: 'PUT', headers: { 'Content-Type': 'application/x-msdownload' }, body: 'x' },
);
console.log(`content-type tamper -> ${tamper.status} ${tamper.status === 403 ? '(rejected)' : '(NOT REJECTED)'}`);
process.exit(ok && tamper.status === 403 ? 0 : 1);
