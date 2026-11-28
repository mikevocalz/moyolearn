// Security pass H4, held as tests: who may read a stored media object.
//
// The route maps `MediaNotFound` to 404 and a returned URL to a 302, so the two
// outcomes here are the two the security pass asked for — a foreign key is
// refused and an own key is signed. The ownership question is answered on a
// resolved `ctx` so the test can hand it explicit identities, the way the
// homework tests drive `createSubmissionFor`.
//
// `.server-test.ts` because the service opens with `import 'server-only'`.
// SOT: docs/verification/security-pass-2026-11.md H4 · packages/app/features/media/media-access.service.ts
// SOT-KEYWORDS: media access test view ownership foreign key own key guardian ward org not found percent encoding
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ProtectedCtx } from '../../core/protected-operation.ts';
import { MediaNotFound, signMediaUrlFor, type MediaAccessPorts } from './media-access.service.ts';

const BASE = 'https://cdn.example.test';
const ada: ProtectedCtx = { learnerId: 'ada_1', isLearner: true };
const ben: ProtectedCtx = { learnerId: 'ben_1', isLearner: true };
const guardian: ProtectedCtx = { learnerId: 'guardian_1', isLearner: false };
const teacher: ProtectedCtx = { learnerId: 'teacher_1', isLearner: false, orgId: 'riverside' };

const ADA_PHOTO = `${BASE}/image/ada_1/2026-10-15/u-1/page.jpg`;
const ORG_PHOTO = `${BASE}/image/riverside/2026-10-15/u-2/page.jpg`;

function ports(wards: Map<string, string[]>, mediaPrefix = ''): MediaAccessPorts & { signed: string[] } {
  const signed: string[] = [];
  return {
    signed,
    cdnBase: BASE,
    mediaPrefix,
    loadGuardianWards: async (ctx) => wards.get(ctx.learnerId) ?? [],
    sign: (url) => {
      signed.push(url);
      return `${url}?token=t&expires=1`;
    },
  };
}

describe('security pass H4 — /api/media/view signs only what the caller may see', () => {
  it('signs a learner’s own key (the route’s 200)', async () => {
    const p = ports(new Map());
    const out = await signMediaUrlFor(ada, ADA_PHOTO, p);
    assert.equal(out, `${ADA_PHOTO}?token=t&expires=1`);
    assert.deepEqual(p.signed, [ADA_PHOTO]);
  });

  it('refuses another learner’s key as not-found (the route’s 404), and signs nothing', async () => {
    const p = ports(new Map());
    await assert.rejects(() => signMediaUrlFor(ben, ADA_PHOTO, p), MediaNotFound);
    assert.deepEqual(p.signed, [], 'a refused URL was still signed');
  });

  it('lets an ACTIVE guardian read their ward’s key', async () => {
    const p = ports(new Map([['guardian_1', ['ada_1']]]));
    assert.equal(await signMediaUrlFor(guardian, ADA_PHOTO, p), `${ADA_PHOTO}?token=t&expires=1`);
  });

  it('refuses a guardian whose guardianship no longer lists the child', async () => {
    const p = ports(new Map([['guardian_1', ['ben_1']]]));
    await assert.rejects(() => signMediaUrlFor(guardian, ADA_PHOTO, p), MediaNotFound);
  });

  it('lets an org member read the org’s folder, and nobody else', async () => {
    assert.equal(
      await signMediaUrlFor(teacher, ORG_PHOTO, ports(new Map())),
      `${ORG_PHOTO}?token=t&expires=1`,
    );
    await assert.rejects(() => signMediaUrlFor(ada, ORG_PHOTO, ports(new Map())), MediaNotFound);
  });

  it('decodes the path before deciding — an encoded owner cannot pass as a different one', async () => {
    // `%61da_1` decodes to `ada_1`: the CDN would serve Ada's object. Ben's
    // raw segment is not `ada_1`, so a raw comparison would have let it through.
    const encoded = `${BASE}/image/%61da_1/2026-10-15/u-1/page.jpg`;
    await assert.rejects(() => signMediaUrlFor(ben, encoded, ports(new Map())), MediaNotFound);
    // And Ada, who owns it, still gets it signed.
    assert.equal(
      await signMediaUrlFor(ada, encoded, ports(new Map())),
      `${encoded}?token=t&expires=1`,
    );
  });

  it('refuses a URL off the zone, a key of another shape, and a traversal', async () => {
    const p = ports(new Map());
    await assert.rejects(() => signMediaUrlFor(ada, 'https://evil.test/image/ada_1/x/y/z.jpg', p), MediaNotFound);
    await assert.rejects(() => signMediaUrlFor(ada, `${BASE}/avatars/ada_1/x/y.png`, p), MediaNotFound);
    await assert.rejects(() => signMediaUrlFor(ada, `${BASE}/image/ada_1/../ben_1/u/y.jpg`, p), MediaNotFound);
    await assert.rejects(() => signMediaUrlFor(ada, `${BASE}/image/ada_1`, p), MediaNotFound);
    assert.deepEqual(p.signed, []);
  });

  it('signs a prefixed key for its owner when BUNNY_MEDIA_PREFIX is set (PR #157 review)', async () => {
    // `signUpload` writes `<prefix>/<kind>/<owner>/…`; the viewer must read the
    // owner from under that namespace and still sign the full, original URL.
    const prefixed = `${BASE}/moyolearn/image/ada_1/2026-11-25/upload_1/homework.png`;
    const p = ports(new Map(), 'moyolearn');
    assert.equal(await signMediaUrlFor(ada, prefixed, p), `${prefixed}?token=t&expires=1`);
    assert.deepEqual(p.signed, [prefixed]);
    await assert.rejects(() => signMediaUrlFor(ben, prefixed, ports(new Map(), 'moyolearn')), MediaNotFound);
    // A key outside the configured namespace is not one this deployment wrote.
    await assert.rejects(() => signMediaUrlFor(ada, ADA_PHOTO, ports(new Map(), 'moyolearn')), MediaNotFound);
    await assert.rejects(
      () => signMediaUrlFor(ada, `${BASE}/other/image/ada_1/2026-11-25/u/p.png`, ports(new Map(), 'moyolearn')),
      MediaNotFound,
    );
  });
});
