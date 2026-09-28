// Exercise cache publication and S4 behavior against the real resolver.
// SOT: docs/voice-v4-upgrade.md
// SOT-KEYWORDS: voice baked cache tests atomic publication s4 alignment
import assert from 'node:assert/strict';
import { it, mock } from 'node:test';
import { bakedClipCacheState, resolveBakedClip, storeBakedClip } from './voice-baked';

const alignment = { characters: ['a'], character_start_times_seconds: [0], character_end_times_seconds: [0.1] };
const withCache = async (run: (objects: Map<string, string | Uint8Array>, writes: string[], failManifest: () => void) => Promise<void>): Promise<void> => {
  const values = { ELEVENLABS_VOICE_ID: 'test-voice', NEXT_PUBLIC_BUNNY_CDN_BASE_URL: 'https://cdn.test', BUNNY_STORAGE_ZONE_NAME: 'zone', BUNNY_STORAGE_ACCESS_KEY: 'fake-key', BUNNY_MEDIA_PREFIX: '', BUNNY_PULL_ZONE_TOKEN_KEY: 'fake-signing' };
  const before = { ...process.env };
  Object.assign(process.env, values);
  const objects = new Map<string, string | Uint8Array>();
  const writes: string[] = [];
  let fail = false;
  const stub = mock.method(globalThis, 'fetch', async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    assert.ok(url.hostname === 'cdn.test' || url.hostname.endsWith('.storage.bunnycdn.com'), 'S4 must never call synthesis');
    const key = url.pathname.replace(/^\/zone/, '');
    if (init.method === 'PUT') {
      writes.push(key);
      if (fail && key.endsWith('manifest.json')) return new Response(null, { status: 503 });
      assert.ok(init.body instanceof Uint8Array);
      objects.set(key, key.endsWith('.json') ? new TextDecoder().decode(init.body) : init.body);
      return new Response(null, { status: 201 });
    }
    assert.ok(url.searchParams.has('token'));
    const body = objects.get(key);
    return body ? new Response(init.method === 'HEAD' ? null : typeof body === 'string' ? body : new Uint8Array(body)) : new Response(null, { status: 404 });
  });
  try { await run(objects, writes, () => { fail = true; }); }
  finally {
    stub.mock.restore();
    for (const key of Object.keys(values)) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
  }
};

it('publishes audio first and serves its own timing through a signed immutable URL', async () => withCache(async (_objects, writes) => {
  const bundle = await storeBakedClip('s4-young', new Uint8Array([1, 2, 3]), 'audio/mpeg', alignment);
  assert.ok(bundle);
  assert.ok(writes[0]?.endsWith(`${bundle.audioDigest}.mp3`));
  assert.ok(writes[1]?.endsWith('/manifest.json'));
  assert.equal(await bakedClipCacheState('s4-young'), 'cached');
  const result = await resolveBakedClip('s4-young');
  assert.equal(result.kind, 'url');
  if (result.kind === 'url') {
    assert.deepEqual(result.alignment, alignment);
    assert.ok(result.url.includes(bundle.audioDigest));
  }
}));

it('failed manifest publication leaves the preceding audio/alignment pair intact', async () => withCache(async (_objects, _writes, fail) => {
  const first = await storeBakedClip('s4-young', new Uint8Array([1]), 'audio/mpeg', alignment);
  assert.ok(first);
  fail();
  assert.equal(await storeBakedClip('s4-young', new Uint8Array([2]), 'audio/mpeg', { ...alignment, characters: ['b'] }), null);
  const result = await resolveBakedClip('s4-young');
  assert.equal(result.kind, 'url');
  if (result.kind === 'url') {
    assert.ok(result.url.includes(first.audioDigest));
    assert.deepEqual(result.alignment, alignment);
  }
}));

it('missing or corrupt S4 bundles remain text-only without synthesis', async () => withCache(async (objects) => {
  assert.deepEqual(await resolveBakedClip('s4-young'), { kind: 'text-only' });
  await storeBakedClip('s4-young', new Uint8Array([1]), 'audio/mpeg', alignment);
  for (const key of objects.keys()) if (key.endsWith('.mp3')) objects.delete(key);
  assert.equal(await bakedClipCacheState('s4-young'), 'missing');
  assert.deepEqual(await resolveBakedClip('s4-young'), { kind: 'text-only' });
  for (const key of objects.keys()) objects.set(key, '{}');
  assert.deepEqual(await resolveBakedClip('s4-young'), { kind: 'text-only' });
}));
