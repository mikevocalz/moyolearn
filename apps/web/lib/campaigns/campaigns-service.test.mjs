// Run the real POST -> service -> protectedOperation -> membership/capability
// chain, substituting only session/database readers and the outbound transport.
// This is an in-process authorization regression, not an authenticated browser test.
// SOT: docs/business/creative-studio.md · packages/app/core/protected-operation.ts
// SOT-KEYWORDS: campaign service POST owner write authorization provider isolation
import { after, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { newDocument } from './document.ts';

const root = resolve(fileURLToPath(new URL('../../../..', import.meta.url)));
const url = (path) => pathToFileURL(resolve(root, path)).href;
const data = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
const fixture = { role: 'owner', subscriptions: [], readers: [], session: { user: { id: 'fixture-user', orgId: 'org-a', guardianManaged: false } } };
const stateKey = Symbol.for('moyo.campaign.authorization-test');
globalThis[stateKey] = fixture;
const stateImport = `const fixture = globalThis[Symbol.for('moyo.campaign.authorization-test')];`;
const aliases = {
  'server-only': data('export {};'),
  '@/lib/auth': data(`${stateImport} export const auth = { api: { getSession: async () => fixture.session } };`),
  '@/lib/campaigns/campaigns.service': url('apps/web/lib/campaigns/campaigns.service.ts'),
  '@/lib/campaigns/http': url('apps/web/lib/campaigns/http.ts'),
  '@acme/auth/server': data(`${stateImport}
    export async function readMembershipRole(auth, orgId, userId) { fixture.readers.push(['role', orgId, userId]); return fixture.role; }
    export async function readSubscriptions(auth, referenceId) { fixture.readers.push(['subscriptions', referenceId]); return fixture.subscriptions; }`),
  '@acme/app/server': data(`
    export { protectedOperation } from ${JSON.stringify(url('packages/app/core/protected-operation.ts'))};
    export { MembershipDenied } from ${JSON.stringify(url('packages/app/core/membership-gate.ts'))};
    export { HostTenantDenied } from ${JSON.stringify(url('packages/app/core/host-tenant.ts'))};
    export { CapabilityDenied } from ${JSON.stringify(url('packages/app/core/capability-gate.ts'))};`),
  '@acme/auth/membership': url('packages/auth/src/membership.ts'),
  '@acme/auth/entitlements': url('packages/auth/src/entitlements.ts'),
  '@acme/auth/host-tenant': url('packages/auth/src/host-tenant.ts'),
  '@acme/theme': url('packages/theme/tokens.ts'),
};
const hooks = registerHooks({ resolve(specifier, context, next) {
  return aliases[specifier] ? { url: aliases[specifier], shortCircuit: true } : next(specifier, context);
} });
const { POST } = await import('../../app/api/business/campaigns/route.ts');
const { setOperationSink } = await import('../../../../packages/app/core/telemetry.ts');
const keys = ['NODE_ENV', 'NEXT_PUBLIC_AUTH_MODE', 'NEXT_PUBLIC_ROOT_DOMAIN', 'MAILCHEAP_CONNECTIONS_JSON'];
const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_AUTH_MODE = 'live';
process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'moyolearn.com';
process.env.MAILCHEAP_CONNECTIONS_JSON = JSON.stringify([{ orgId: 'org-a', origin: 'https://fixture-mail.example.com', apiKey: 'fixture-not-a-live-key', newsletter: 'fixture-news', businessName: 'Fixture business', postalAddress: 'TEST ADDRESS — NOT A LIVE SENDER' }]);
setOperationSink(() => {});
after(() => {
  hooks.deregister(); setOperationSink(null); delete globalThis[stateKey];
  for (const key of keys) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
});
const paid = [{ plan: 'ops-studio', status: 'active', referenceId: 'org-a', periodEnd: null, seats: null }];
const request = () => new Request('https://app.moyolearn.com/api/business/campaigns', {
  method: 'POST', headers: { origin: 'https://app.moyolearn.com', host: 'app.moyolearn.com', 'Content-Type': 'application/json' }, body: JSON.stringify(newDocument()),
});

for (const [name, role, subscriptions, expected] of [
  ['non-owner with a paid organization', 'manager', paid, 403],
  ['owner without write capability', 'owner', [], 402],
]) {
  test(`POST denies ${name} before contacting Mailcheap`, async () => {
    fixture.role = role; fixture.subscriptions = subscriptions; fixture.readers = [];
    const transport = mock.method(globalThis, 'fetch', async () => { throw new Error('provider must not be called'); });
    try {
      const response = await POST(request());
      assert.equal(response.status, expected);
      assert.equal(transport.mock.callCount(), 0);
      assert.ok(fixture.readers.some(([kind, orgId, userId]) => kind === 'role' && orgId === 'org-a' && userId === 'fixture-user'));
      if (role !== 'owner') assert.ok(!fixture.readers.some(([kind]) => kind === 'subscriptions'), 'role refusal precedes the plan gate');
      else assert.ok(fixture.readers.some(([kind, reference]) => kind === 'subscriptions' && reference === 'org-a'), 'plan is read for the session organization');
    } finally { transport.mock.restore(); }
  });
}

test('POST permits a paid owner and calls only the mapped tenant draft endpoint', async () => {
  fixture.role = 'owner'; fixture.subscriptions = paid; fixture.readers = [];
  const transport = mock.method(globalThis, 'fetch', async () => Response.json({ id: '0123456789abcdef01234567' }, { status: 201 }));
  try {
    const response = await POST(request());
    assert.equal(response.status, 201);
    assert.equal(transport.mock.callCount(), 1);
    assert.equal(transport.mock.calls[0].arguments[0], 'https://fixture-mail.example.com/api/v1/campaigns');
    assert.equal(transport.mock.calls[0].arguments[1].method, 'POST');
  } finally { transport.mock.restore(); }
});
