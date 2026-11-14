// Real PostgreSQL transactions and existing auth gates; synthetic fixtures only.
// SOT: docs/site/signaliq-business-connection.md
// SOT-KEYWORDS: marketing database integration tenant idempotency consent outbox payment
import { after, before, beforeEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

const database = process.env.MOYO_MARKETING_TEST_DATABASE_URL;
if (
  !database ||
  new URL(database).pathname !== '/moyo_test' ||
  !['127.0.0.1', 'localhost'].includes(new URL(database).hostname)
)
  throw new Error(
    'Run against the isolated localhost moyo_test database only.',
  );
process.env.DATABASE_URL = database;
process.env.MOYO_MARKETING_ORG_ID = 'synthetic-moyo-sales';
process.env.MOYO_MARKETING_RATE_SECRET = 'synthetic-test-rate-secret';
process.env.SIGNALIQ_BUSINESS_ENDPOINT =
  'https://synthetic-signal.invalid/api/ingest/v1/business-events';
process.env.SIGNALIQ_BUSINESS_KEY = 'synthetic-not-a-live-key';
process.env.NEXT_PUBLIC_AUTH_MODE = 'live';
process.env.NODE_ENV = 'test';
const pool = new Pool({
  connectionString: database,
  max: 3,
  allowExitOnIdle: true,
});
const url = (path) => new URL(path, import.meta.url).href;
const data = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
const fixture = {
  role: 'owner',
  subscriptions: [
    {
      plan: 'ops-studio',
      status: 'active',
      referenceId: 'synthetic-moyo-sales',
      periodEnd: null,
      seats: null,
    },
  ],
  session: {
    user: {
      id: 'synthetic-owner',
      orgId: 'synthetic-moyo-sales',
      guardianManaged: false,
    },
  },
};
const key = Symbol.for('moyo.marketing.integration-test');
globalThis[key] = fixture;
const state =
  "const fixture=globalThis[Symbol.for('moyo.marketing.integration-test')];";
const aliases = {
  'server-only': data('export {};'),
  '@acme/auth/server': data(
    `${state} export const readMembershipRole=async()=>fixture.role; export const readSubscriptions=async()=>fixture.subscriptions;`,
  ),
  '@acme/app/server': data(
    `export {protectedOperation} from ${JSON.stringify(url('../../../../packages/app/core/protected-operation.ts'))};`,
  ),
  '@acme/auth/membership': url('../../../../packages/auth/src/membership.ts'),
  '@acme/auth/entitlements': url(
    '../../../../packages/auth/src/entitlements.ts',
  ),
  '@acme/auth/host-tenant': url('../../../../packages/auth/src/host-tenant.ts'),
};
const hooks = registerHooks({
  resolve(specifier, context, next) {
    return aliases[specifier]
      ? { url: aliases[specifier], shortCircuit: true }
      : next(specifier, context);
  },
});
const repository = await import('./marketing.repository.ts');
const service = await import('./marketing.service.ts');
const { inquiryInput } = await import('./contract.ts');
const auth = { api: { getSession: async () => fixture.session } };
const headers = new Headers({ host: 'app.moyolearn.com' });
const input = (patch = {}) =>
  inquiryInput.parse({
    requestId: randomUUID(),
    name: 'Synthetic adult',
    email: 'adult@example.invalid',
    audience: 'school',
    organizationName: 'Synthetic school',
    adult: true,
    contactConsent: true,
    signalConsent: true,
    ...patch,
  });
const update = (action, fields = {}) => ({
  requestId: randomUUID(),
  action,
  ...fields,
});
const org = 'synthetic-moyo-sales';
const count = async (table, where = '', args = []) =>
  Number(
    (
      await pool.query(
        `SELECT count(*) AS count FROM payload.${table} ${where}`,
        args,
      )
    ).rows[0].count,
  );

before(async () => {
  await pool.query(
    'CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA payload; CREATE SCHEMA better_auth;',
  );
  await pool.query(
    await readFile(
      new URL(
        '../../../../packages/payload/migrations/better_auth_tables.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const migration = await readFile(
    new URL(
      '../../../../packages/payload/migrations/signaliq_marketing_additive.sql',
      import.meta.url,
    ),
    'utf8',
  );
  await pool.query(migration);
  await pool.query(migration);
});
beforeEach(async () => {
  await pool.query(
    'TRUNCATE payload.marketing_inquiries,payload.marketing_updates,payload.marketing_outbox,payload.marketing_rate_limits,payload.marketing_verified_payments,better_auth.subscription,better_auth.organization,better_auth."user" CASCADE',
  );
  fixture.role = 'owner';
  fixture.session = {
    user: { id: 'synthetic-owner', orgId: org, guardianManaged: false },
  };
  fixture.subscriptions = [
    {
      plan: 'ops-studio',
      status: 'active',
      referenceId: org,
      periodEnd: null,
      seats: null,
    },
  ];
});
after(async () => {
  hooks.deregister();
  delete globalThis[key];
  await pool.end();
});

test('concurrent exact intake retries create one inquiry and one outbox event; changed replay conflicts', async () => {
  const body = input();
  const [a, b] = await Promise.all([
    repository.saveInquiry(org, body, 'rate-a'),
    repository.saveInquiry(org, body, 'rate-a'),
  ]);
  assert.equal(a.id, b.id);
  assert.notEqual(a.replayed, b.replayed);
  assert.equal(await count('marketing_inquiries'), 1);
  assert.equal(await count('marketing_outbox'), 1);
  await assert.rejects(
    repository.saveInquiry(
      org,
      { ...body, email: 'different@example.invalid' },
      'rate-a',
    ),
    { status: 409 },
  );
  assert.equal(await count('marketing_inquiries'), 1);
  const saved = (await pool.query('SELECT event FROM payload.marketing_outbox'))
    .rows[0].event;
  assert.equal(saved.contact.email, 'adult@example.invalid');
  assert.equal(saved.organization.name, 'Synthetic school');
});
test('unconsented inquiries stay in Moyo and rate limits are transactional', async () => {
  for (let i = 0; i < 5; i++)
    await repository.saveInquiry(
      org,
      input({ signalConsent: false }),
      'same-rate',
    );
  await assert.rejects(repository.saveInquiry(org, input(), 'same-rate'), {
    status: 429,
  });
  assert.equal(await count('marketing_inquiries'), 5);
  assert.equal(await count('marketing_outbox'), 0);
  const inquiry = (await repository.listInquiries(org))[0];
  await repository.saveInquiryUpdate(
    org,
    'synthetic-owner',
    inquiry.id,
    update('progress', { stage: 'contacted' }),
  );
  assert.equal(await count('marketing_outbox'), 0);
});
test('tenant, non-owner and learner boundaries run before protected reads or writes; withdrawal survives expired plan', async () => {
  const saved = await repository.saveInquiry(org, input(), 'rate');
  await assert.rejects(
    repository.saveInquiryUpdate(
      'other-tenant',
      'other-owner',
      saved.id,
      update('withdraw'),
    ),
    { status: 404 },
  );
  fixture.session.user.orgId = 'other-tenant';
  await assert.rejects(service.marketingInbox(auth, headers), { status: 403 });
  fixture.session.user.orgId = org;
  fixture.role = 'teacher';
  await assert.rejects(service.marketingInbox(auth, headers));
  fixture.role = 'owner';
  fixture.session.user.guardianManaged = true;
  await assert.rejects(service.marketingInbox(auth, headers), { status: 403 });
  fixture.session.user.guardianManaged = false;
  fixture.subscriptions = [];
  const request = (body) =>
    new Request('https://app.moyolearn.com/api/ops/marketing/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  await assert.rejects(
    service.updateMarketingInquiry(
      auth,
      headers,
      saved.id,
      request(update('progress', { stage: 'contacted' })),
    ),
  );
  await service.updateMarketingInquiry(
    auth,
    headers,
    saved.id,
    request(update('withdraw')),
  );
  assert.equal((await repository.listInquiries(org))[0].signal_consent, false);
});
test('queued remote acceptance requires status polling; only processed removes retained contact payload', async () => {
  await repository.saveInquiry(org, input(), 'rate');
  const sourceEventId = randomUUID();
  let calls = 0;
  const fetchMock = mock.method(globalThis, 'fetch', async (url, options) => {
    calls++;
    assert.equal(options.method, calls === 1 ? 'POST' : 'GET');
    return Response.json({
      sourceEventId,
      state: calls === 1 ? 'queued' : 'processed',
    });
  });
  try {
    await service.drainMarketingOutbox();
    let row = (
      await pool.query('SELECT state,event FROM payload.marketing_outbox')
    ).rows[0];
    assert.equal(row.state, 'accepted');
    assert.ok(row.event.contact);
    await pool.query(
      'UPDATE payload.marketing_outbox SET next_attempt_at=now()',
    );
    await service.drainMarketingOutbox();
    row = (await pool.query('SELECT state,event FROM payload.marketing_outbox'))
      .rows[0];
    assert.equal(row.state, 'delivered');
    assert.equal(row.event, null);
    assert.equal(calls, 2);
  } finally {
    fetchMock.mock.restore();
  }
});
test('withdrawal after an unconfirmed send deletes queued PII and delivers an identifier-only tombstone', async () => {
  const saved = await repository.saveInquiry(org, input(), 'rate');
  const timeout = mock.method(globalThis, 'fetch', async () => {
    throw new Error('response lost after accept');
  });
  await service.drainMarketingOutbox();
  timeout.mock.restore();
  const withdrawal = update('withdraw');
  await repository.saveInquiryUpdate(
    org,
    'synthetic-owner',
    saved.id,
    withdrawal,
  );
  await repository.saveInquiryUpdate(
    org,
    'synthetic-owner',
    saved.id,
    withdrawal,
  );
  const rows = (
    await pool.query(
      'SELECT operation,state,event,error_code FROM payload.marketing_outbox ORDER BY operation',
    )
  ).rows;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].event, null);
  assert.equal(rows[0].error_code, 'consent_withdrawn');
  assert.deepEqual(rows[1].event, {
    requestId: withdrawal.requestId,
    inquirySourceId: `moyo.inquiry:${saved.id}`,
  });
  const delivery = mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(String(url), /\/withdrawals$/);
    assert.deepEqual(JSON.parse(options.body), rows[1].event);
    return Response.json({
      state: 'withdrawn',
      requestId: withdrawal.requestId,
    });
  });
  try {
    await service.drainMarketingOutbox();
    assert.equal(
      await count(
        'marketing_outbox',
        "WHERE operation='withdrawal' AND state='delivered'",
      ),
      1,
    );
  } finally {
    delivery.mock.restore();
  }
});
test('verified invoices arriving before an explicit billing link survive and route only once', async () => {
  const saved = await repository.saveInquiry(org, input(), 'rate');
  await pool.query(
    "INSERT INTO better_auth.organization(id,name,slug,\"createdAt\") VALUES('synthetic-customer-org','Synthetic customer','synthetic-customer',now()); INSERT INTO better_auth.subscription(id,plan,\"referenceId\",\"stripeCustomerId\",status) VALUES('synthetic-subscription','ops-studio','synthetic-customer-org','cus_Synthetic','active')",
  );
  const invoice = {
    invoiceId: 'in_Synthetic',
    customerId: 'cus_Synthetic',
    amountCents: 4900,
    currency: 'USD',
    occurredAt: new Date().toISOString(),
    live: true,
  };
  await repository.saveVerifiedPayment(org, invoice);
  assert.equal(
    await count('marketing_outbox'),
    1,
    'unlinked invoice is not disclosed',
  );
  await repository.saveInquiryUpdate(
    org,
    'synthetic-owner',
    saved.id,
    update('link-billing', { referenceId: 'synthetic-customer-org' }),
  );
  await repository.saveVerifiedPayment(org, invoice);
  assert.equal(await count('marketing_outbox'), 2);
  const event = (
    await pool.query(
      "SELECT event FROM payload.marketing_outbox WHERE source_id='moyo.invoice:in_Synthetic'",
    )
  ).rows[0].event;
  assert.deepEqual(event.amount, { amountCents: 4900, currency: 'USD' });
  assert.equal(event.inquirySourceId, `moyo.inquiry:${saved.id}`);
  await repository.saveInquiryUpdate(
    org,
    'synthetic-owner',
    saved.id,
    update('withdraw'),
  );
  await repository.saveVerifiedPayment(org, {
    ...invoice,
    invoiceId: 'in_NextSynthetic',
  });
  assert.equal(
    await count(
      'marketing_outbox',
      "WHERE source_id='moyo.invoice:in_NextSynthetic'",
    ),
    0,
  );
});
test('public body/origin limits reject untrusted requests without storing a contact', async () => {
  const request = (origin, body) =>
    new Request('https://app.moyolearn.com/api/marketing/inquiries', {
      method: 'POST',
      headers: { origin, 'Content-Type': 'application/json' },
      body,
    });
  await assert.rejects(
    service.receivePublicInquiry(
      request('https://evil.invalid', JSON.stringify(input())),
    ),
    { status: 403 },
  );
  await assert.rejects(
    service.receivePublicInquiry(
      request('https://www.moyolearn.com', 'x'.repeat(8193)),
    ),
    { status: 413 },
  );
  await assert.rejects(
    service.receivePublicInquiry(
      request(
        'https://www.moyolearn.com',
        JSON.stringify({ ...input(), studentName: 'Never stored' }),
      ),
    ),
    { status: 422 },
  );
  assert.equal(await count('marketing_inquiries'), 0);
});
test('Supabase public API roles have no grants to the new sales tables', async () => {
  const rows = (
    await pool.query(
      "SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='payload' AND tablename LIKE 'marketing_%' ORDER BY tablename",
    )
  ).rows;
  assert.equal(rows.length, 5);
  assert.ok(rows.every((row) => row.rowsecurity));
  for (const role of ['anon', 'authenticated'])
    for (const row of rows)
      assert.equal(
        (
          await pool.query(
            "SELECT has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE') AS allowed",
            [role, `payload.${row.tablename}`],
          )
        ).rows[0].allowed,
        false,
      );
});
