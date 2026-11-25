// /api/family/learners takes a consent ID and reads the record; it never takes
// a consent record. These tests hold that: a body with a consent object and no
// id is refused before the Block runs, an id this guardian did not verify
// creates nothing, and a verified id reaches createManagedLearner with the
// server's own record.
// SOT: docs/pack/06-auth-onboarding-spec.md §2 §3.1 · security finding H3
// SOT-KEYWORDS: family learners route test consent id record h3
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const data = (source: string) => `data:text/javascript,${encodeURIComponent(source)}`;

const authServerUrl = data(`
  export class CreateLearnerError extends Error {}
  export const fixture = { created: [] };
  export async function createManagedLearner(writer, input) {
    fixture.created.push(input);
    return { learnerAuthId: 'learner-' + input.username };
  }
  export function createPayloadLearnerWriter() { return {}; }
`);
const appServerUrl = data(`
  export const ctx = { learnerId: 'guardian-1', isLearner: false };
  export async function protectedOperation(auth, headers, operation) { return operation(ctx); }
  export async function readGuardianConsent(store, c, consentId) {
    const row = await store.find(consentId);
    if (!row || row.guardianAuthId !== c.learnerId || !row.recordedAt) return null;
    return { method: row.method, scope: row.scope, policyVersion: row.policyVersion, evidenceRef: row.evidenceRef, verificationId: row.id };
  }
`);
const repositoryUrl = data(`
  export const rows = new Map();
  export const consentVerificationStore = {
    async find(id) { return rows.get(id) ?? null; },
    async create() { throw new Error('unused'); },
    async update() { throw new Error('unused'); },
  };
`);
/*
  `next/server` has no ESM-resolvable `server` subpath for a bare Node test, and
  the route only needs `NextResponse.json`; the stub is the Fetch `Response`
  the real one wraps.
*/
const nextServerUrl = data(`
  export class NextResponse extends Response {
    static json(body, init) {
      return new Response(JSON.stringify(body), { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
    }
  }
  export class NextRequest extends Request {}
`);
const aliases: Record<string, string> = {
  'next/server': nextServerUrl,
  '@acme/auth/server': authServerUrl,
  '@acme/app/server': appServerUrl,
  '@/lib/consent.repository': repositoryUrl,
  '@/lib/auth': data('export const auth = {};'),
  '@/lib/report-error': data('export function reportRouteError() {}'),
  payload: data('export async function getPayload() { return {}; }'),
  '@payload-config': data('export default {};'),
};
const hooks = registerHooks({
  resolve(specifier, context, next) {
    return aliases[specifier] ? { url: aliases[specifier], shortCircuit: true } : next(specifier, context);
  },
});
const { fixture } = await import(authServerUrl);
const { rows } = await import(repositoryUrl);
const { POST } = await import('../app/api/family/learners/route.ts');
after(() => hooks.deregister());

const post = (body: unknown) =>
  POST(
    new Request('https://app.example.invalid/api/family/learners', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }) as never,
  );

const child = { username: 'otter-42', password: 'twelve-chars-long', displayName: 'Sam' };

test('a consent record in the body is not accepted in place of an id', async () => {
  fixture.created.length = 0;
  const res = await post({
    ...child,
    consent: { method: 'email-plus', scope: 'tutoring', policyVersion: '2026-08-01', evidenceRef: 'self-written' },
  });
  assert.equal(res.status, 400);
  assert.equal(fixture.created.length, 0);
});

test('an id this guardian did not verify creates nothing', async () => {
  fixture.created.length = 0;
  rows.set('7', {
    id: '7',
    guardianAuthId: 'someone-else',
    method: 'email-plus',
    scope: 'tutoring',
    policyVersion: '2026-08-01',
    evidenceRef: 'email-plus:xx***@example.com:20260801000000',
    recordedAt: '2026-08-01T00:00:00.000Z',
  });
  const res = await post({ ...child, consentId: '7' });
  assert.equal(res.status, 400);
  assert.match(((await res.json()) as { error: string }).error, /permission record was not found/);
  assert.equal(fixture.created.length, 0);
});

test('an unrecorded verification is not a consent', async () => {
  fixture.created.length = 0;
  rows.set('8', { id: '8', guardianAuthId: 'guardian-1', method: 'email-plus', recordedAt: null });
  const res = await post({ ...child, consentId: '8' });
  assert.equal(res.status, 400);
  assert.equal(fixture.created.length, 0);
});

test('a verified id reaches createManagedLearner with the server’s record and the session’s guardian', async () => {
  fixture.created.length = 0;
  rows.set('9', {
    id: '9',
    guardianAuthId: 'guardian-1',
    method: 'email-plus',
    scope: 'tutoring',
    policyVersion: '2026-08-01',
    evidenceRef: 'email-plus:ad***@example.com:20260801000000',
    recordedAt: '2026-08-01T00:00:00.000Z',
  });
  const res = await post({ ...child, consentId: '9' });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, learnerAuthId: 'learner-otter-42' });
  assert.deepEqual(fixture.created, [
    {
      guardianAuthId: 'guardian-1',
      ...child,
      consent: {
        method: 'email-plus',
        scope: 'tutoring',
        policyVersion: '2026-08-01',
        evidenceRef: 'email-plus:ad***@example.com:20260801000000',
        verificationId: '9',
      },
    },
  ]);
});
