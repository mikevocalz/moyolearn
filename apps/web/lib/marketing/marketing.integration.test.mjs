// Real PostgreSQL transactions and existing auth gates; synthetic fixtures only.
// SOT: docs/site/signaliq-business-connection.md
// SOT-KEYWORDS: marketing database integration tenant idempotency consent outbox payment
import { after, before, beforeEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

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
process.env.MOYO_MARKETING_ADMIN_IDS = '1';
process.env.MOYO_MARKETING_RATE_SECRET = 'synthetic-test-rate-secret';
process.env.SIGNALIQ_BUSINESS_ENDPOINT =
  'https://synthetic-signal.invalid/api/ingest/v1/business-events';
process.env.SIGNALIQ_BUSINESS_KEY = 'synthetic-not-a-live-key';
process.env.NEXT_PUBLIC_AUTH_MODE = 'live';
process.env.NODE_ENV = 'test';
process.env.CRON_SECRET = 'synthetic-cron-secret';
const cronRequest = () =>
  new Request('https://app.example.invalid/api/marketing/sync', {
    headers: { authorization: 'Bearer synthetic-cron-secret' },
  });
const pool = new Pool({
  connectionString: database,
  max: 3,
  allowExitOnIdle: true,
});
const url = (path) => new URL(path, import.meta.url).href;
const data = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
const fixture = { user: { id: 1, collection: 'users' } };
const aliases = { 'server-only': data('export {};') };
const hooks = registerHooks({
  resolve(specifier, context, next) {
    return aliases[specifier]
      ? { url: aliases[specifier], shortCircuit: true }
      : next(specifier, context);
  },
});
const repository =
  await import('../../../../packages/app/marketing/repository/marketing.repository.ts');
const service = await import('./marketing.service.ts');
const { inquiryInput } = await import('./contract.ts');
const { setOperationSink } =
  await import('../../../../packages/app/core/telemetry.ts');
const operationRecords = [];
setOperationSink((record) => operationRecords.push(record));
const headers = new Headers({
  host: 'admin.moyolearn.com',
  origin: 'https://admin.moyolearn.com',
});
const internalRequest = (body, { headers: requestHeaders, ...extra } = {}) =>
  Object.assign(
    new Request(
      'https://admin.moyolearn.com/payload-api/moyo-sales/inquiries',
      {
        method: body ? 'POST' : 'GET',
        headers:
          requestHeaders ??
          new Headers([
            ...headers,
            ...(body ? [['Content-Type', 'application/json']] : []),
          ]),
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    ),
    { user: fixture.user, ...extra },
  );
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
const org = 'moyo-platform-sales';
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
  operationRecords.length = 0;
  await pool.query(
    'TRUNCATE payload.marketing_inquiries,payload.marketing_updates,payload.marketing_outbox,payload.marketing_rate_limits,payload.marketing_verified_payments,better_auth.subscription,better_auth.organization,better_auth."user" CASCADE',
  );
  fixture.user = { id: 1, collection: 'users' };
});
after(async () => {
  setOperationSink(null);
  hooks.deregister();
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

test('the most recently recorded booking wins an earlier reschedule; progress cannot replace it', async () => {
  const saved = await repository.saveInquiry(org, input(), 'reschedule-rate');
  const later = new Date(Date.now() + 7 * 86400000).toISOString();
  const earlier = new Date(Date.now() + 86400000).toISOString();
  const oldId = '00000000-0000-4000-8000-000000000001';
  const newId = '00000000-0000-4000-8000-000000000002';
  await service.updateMarketingInquiry(
    internalRequest(
      update('booking', { requestId: oldId, scheduledAt: later }),
    ),
    saved.id,
  );
  await service.updateMarketingInquiry(
    internalRequest(
      update('booking', { requestId: newId, scheduledAt: earlier }),
    ),
    saved.id,
  );
  await pool.query(
    "UPDATE payload.marketing_updates SET created_at = CASE id WHEN $1::uuid THEN now()-interval '2 seconds' ELSE now()-interval '1 second' END WHERE inquiry_id=$2",
    [oldId, saved.id],
  );
  assert.equal(
    Date.parse((await repository.listInquiries(org))[0].scheduled_at),
    Date.parse(earlier),
  );
  await service.updateMarketingInquiry(
    internalRequest(update('progress', { stage: 'contacted' })),
    saved.id,
  );
  assert.equal(
    Date.parse((await repository.listInquiries(org))[0].scheduled_at),
    Date.parse(earlier),
  );
  // Timestamp equality has an explicit stable tie-breaker, rather than row-plan order.
  await pool.query(
    "UPDATE payload.marketing_updates SET created_at='2026-01-01T00:00:00Z' WHERE inquiry_id=$1 AND action='booking'",
    [saved.id],
  );
  assert.equal(
    Date.parse((await repository.listInquiries(org))[0].scheduled_at),
    Date.parse(earlier),
  );
});

test('a new repeat inquiry reuses only the exact submitted adult prospect and freezes old delivery payloads', async () => {
  const first = input({ organizationDomain: 'school.example' });
  const second = { ...first, requestId: randomUUID() };
  const [a, b] = await Promise.all([
    repository.saveInquiry(org, first, 'rate-a'),
    repository.saveInquiry(org, second, 'rate-b'),
  ]);
  assert.notEqual(a.id, b.id);
  const rows = (
    await pool.query(
      'SELECT source_id,event FROM payload.marketing_outbox ORDER BY source_id',
    )
  ).rows;
  assert.equal(rows.length, 2);
  assert.equal(
    rows[0].event.organization.externalId,
    rows[1].event.organization.externalId,
  );
  const original = JSON.stringify(rows);
  await repository.saveInquiry(org, first, 'rate-a');
  assert.equal(
    JSON.stringify(
      (
        await pool.query(
          'SELECT source_id,event FROM payload.marketing_outbox ORDER BY source_id',
        )
      ).rows,
    ),
    original,
  );
  await repository.saveInquiry(
    org,
    input({
      organizationName: 'Another explicitly supplied school',
      organizationDomain: 'another.example',
    }),
    'rate-c',
  );
  assert.equal(
    Number(
      (
        await pool.query(
          'SELECT count(DISTINCT prospect_id) AS count FROM payload.marketing_inquiries',
        )
      ).rows[0].count,
    ),
    2,
  );
});
test('internal identity, ID allowlist, origin and fixed source scope guard every sales operation', async () => {
  const saved = await repository.saveInquiry(org, input(), 'rate');
  await repository.saveInquiry(
    'synthetic-customer-tenant',
    input(),
    'other-rate',
  );
  await assert.rejects(
    repository.saveInquiryUpdate(
      'other-tenant',
      'other-owner',
      saved.id,
      update('withdraw'),
    ),
    { status: 404 },
  );
  fixture.user = null;
  await assert.rejects(service.marketingInbox(internalRequest()), {
    status: 401,
  });
  fixture.user = { id: 2, collection: 'users' };
  await assert.rejects(service.marketingInbox(internalRequest()), {
    status: 403,
  });
  fixture.user = { id: 1, collection: 'customer-users' };
  await assert.rejects(service.marketingInbox(internalRequest()), {
    status: 403,
  });
  fixture.user = { id: 1, collection: 'users' };
  await assert.rejects(
    service.marketingInbox(
      internalRequest(null, {
        headers: new Headers({ host: 'app.moyolearn.com' }),
      }),
    ),
    { status: 403 },
  );
  const inbox = await service.marketingInbox(internalRequest());
  assert.equal(inbox.inquiries.length, 1);
  assert.equal(inbox.inquiries[0].id, saved.id);
  await assert.rejects(
    service.updateMarketingInquiry(
      internalRequest(update('progress', { stage: 'contacted' }), {
        headers: new Headers({
          host: 'admin.moyolearn.com',
          origin: 'https://evil.invalid',
          'Content-Type': 'application/json',
        }),
      }),
      saved.id,
    ),
    { status: 403 },
  );
  await service.updateMarketingInquiry(
    internalRequest(update('progress', { stage: 'contacted' })),
    saved.id,
  );
  assert.equal(
    (await pool.query('SELECT actor_id FROM payload.marketing_updates')).rows[0]
      .actor_id,
    'payload:1',
  );
  await service.updateMarketingInquiry(
    internalRequest(update('withdraw')),
    saved.id,
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
    await service.drainMarketingOutbox(cronRequest());
    let row = (
      await pool.query('SELECT state,event FROM payload.marketing_outbox')
    ).rows[0];
    assert.equal(row.state, 'accepted');
    assert.ok(row.event.contact);
    await pool.query(
      'UPDATE payload.marketing_outbox SET next_attempt_at=now()',
    );
    await service.drainMarketingOutbox(cronRequest());
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
  await service.drainMarketingOutbox(cronRequest());
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
    await service.drainMarketingOutbox(cronRequest());
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
    "INSERT INTO better_auth.organization(id,name,slug,\"createdAt\") VALUES('synthetic-customer-org','Synthetic customer','synthetic-customer',now()); INSERT INTO better_auth.subscription(id,plan,\"referenceId\",\"stripeCustomerId\",\"stripeSubscriptionId\",status) VALUES('synthetic-subscription','ops-studio','synthetic-customer-org','cus_Synthetic','sub_Moyo','active')",
  );
  const invoice = {
    invoiceId: 'in_Synthetic',
    customerId: 'cus_Synthetic',
    subscriptionId: 'sub_Moyo',
    evidenceStatus: 'verified',
    moyoPriceSeen: true,
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
async function linkedBillingInquiry() {
  const saved = await repository.saveInquiry(org, input(), 'rate');
  await pool.query(
    `INSERT INTO better_auth.organization(id,name,slug,"createdAt") VALUES('synthetic-customer-org','Synthetic customer','synthetic-customer',now());
     INSERT INTO better_auth.subscription(id,plan,"referenceId","stripeCustomerId","stripeSubscriptionId",status) VALUES('synthetic-subscription','ops-studio','synthetic-customer-org','cus_Synthetic','sub_Moyo','active')`,
  );
  await repository.saveInquiryUpdate(
    org,
    'synthetic-owner',
    saved.id,
    update('link-billing', { referenceId: 'synthetic-customer-org' }),
  );
  return saved;
}
const paidReceipt = (patch = {}) => ({
  invoiceId: 'in_Synthetic',
  customerId: 'cus_Synthetic',
  subscriptionId: 'sub_Moyo',
  amountCents: 4900,
  currency: 'USD',
  occurredAt: new Date().toISOString(),
  live: true,
  evidenceStatus: 'verified',
  moyoPriceSeen: true,
  ...patch,
});
test('an already-linked customer waits for the exact late subscription association and cannot attribute another reference', async () => {
  await linkedBillingInquiry();
  const invoice = paidReceipt({ subscriptionId: 'sub_LateMoyo' });
  await repository.saveVerifiedPayment(org, invoice);
  assert.equal(
    await count('marketing_verified_payments'),
    1,
    'valid evidence is durable before the canonical row',
  );
  assert.equal(
    await count(
      'marketing_outbox',
      "WHERE source_id='moyo.invoice:in_Synthetic'",
    ),
    0,
  );
  assert.equal((await repository.listInquiries(org))[0].billing_waiting, 1);
  await pool.query(
    `INSERT INTO better_auth.subscription(id,plan,"referenceId","stripeCustomerId","stripeSubscriptionId",status) VALUES('late-synthetic','ops-studio','synthetic-customer-org','cus_Synthetic','sub_LateMoyo','active')`,
  );
  await repository.reconcileVerifiedPayments(org);
  await repository.reconcileVerifiedPayments(org);
  assert.equal(
    await count(
      'marketing_outbox',
      "WHERE source_id='moyo.invoice:in_Synthetic'",
    ),
    1,
  );
  await pool.query(
    `INSERT INTO better_auth.organization(id,name,slug,"createdAt") VALUES('different-reference','Synthetic other customer','synthetic-other',now()); INSERT INTO better_auth.subscription(id,plan,"referenceId","stripeCustomerId","stripeSubscriptionId",status) VALUES('other-synthetic','ops-studio','different-reference','cus_Synthetic','sub_OtherReference','active')`,
  );
  await repository.saveVerifiedPayment(
    org,
    paidReceipt({
      invoiceId: 'in_OtherReference',
      subscriptionId: 'sub_OtherReference',
    }),
  );
  await repository.saveVerifiedPayment(
    org,
    paidReceipt({ invoiceId: 'in_OtherCustomer', customerId: 'cus_Other' }),
  );
  await repository.saveVerifiedPayment(
    org,
    paidReceipt({
      invoiceId: 'in_Unrelated',
      subscriptionId: 'sub_Unrelated',
      evidenceStatus: 'mismatch',
      moyoPriceSeen: false,
    }),
  );
  assert.equal(
    await count('marketing_outbox', "WHERE event->>'kind'='order'"),
    1,
  );
  assert.equal(
    await count('marketing_verified_payments', "WHERE id='in_Unrelated'"),
    0,
    'unrelated complete invoice is not a Moyo receipt',
  );
  await assert.rejects(
    repository.saveVerifiedPayment(
      org,
      paidReceipt({ invoiceId: 'in_Overflow', amountCents: 2147483648 }),
    ),
  );
});
test('a family plan invoice is never recorded as sales revenue', async () => {
  await pool.query(
    `INSERT INTO better_auth.subscription(id,plan,"referenceId","stripeCustomerId","stripeSubscriptionId",status) VALUES('family-synthetic','family','synthetic-family-user','cus_Family','sub_Family','active')`,
  );
  await repository.saveVerifiedPayment(
    org,
    paidReceipt({
      invoiceId: 'in_Family',
      customerId: 'cus_Family',
      subscriptionId: 'sub_Family',
      evidenceStatus: 'mismatch',
      moyoPriceSeen: false,
    }),
  );
  assert.equal(
    await count('marketing_verified_payments', "WHERE id='in_Family'"),
    0,
  );
});
test('incomplete or mixed invoice evidence stays visible and private repair cannot change the original payment', async () => {
  const saved = await linkedBillingInquiry();
  const invoice = paidReceipt({ evidenceStatus: 'incomplete' });
  await repository.saveVerifiedPayment(org, invoice);
  assert.equal((await repository.listInquiries(org))[0].billing_attention, 1);
  assert.equal(
    await count('marketing_outbox', "WHERE event->>'kind'='order'"),
    0,
  );
  let inspections = 0;
  await repository.repairPaymentEvidence(org, async (candidate) => {
    inspections++;
    assert.equal(candidate.invoiceId, invoice.invoiceId);
    assert.equal(candidate.occurredAt, invoice.occurredAt);
    return { ...invoice, evidenceStatus: 'verified' };
  });
  await repository.repairPaymentEvidence(org, async () => {
    throw new Error('A verified receipt must not be reinspected.');
  });
  assert.equal(inspections, 1);
  assert.equal(
    await count('marketing_outbox', "WHERE event->>'kind'='order'"),
    1,
  );
  const mixed = paidReceipt({
    invoiceId: 'in_Mixed',
    evidenceStatus: 'mismatch',
  });
  await repository.saveVerifiedPayment(org, mixed);
  await repository.repairPaymentEvidence(org, async () => mixed);
  assert.equal(
    await count('marketing_outbox', "WHERE source_id='moyo.invoice:in_Mixed'"),
    0,
  );
  await repository.saveInquiryUpdate(
    org,
    'synthetic-owner',
    saved.id,
    update('retry-billing'),
  );
  await repository.repairPaymentEvidence(org, async () => {
    throw new Error('Must never disclose provider credential/body.');
  });
  let inbox = (await repository.listInquiries(org))[0];
  assert.equal(inbox.billing_error, 'invoice_verification_unavailable');
  assert.equal(JSON.stringify(inbox).includes('provider credential'), false);
  await repository.saveInquiryUpdate(
    org,
    'synthetic-owner',
    saved.id,
    update('retry-billing'),
  );
  await repository.repairPaymentEvidence(org, async () => ({
    ...mixed,
    amountCents: 9900,
    evidenceStatus: 'verified',
  }));
  inbox = (await repository.listInquiries(org))[0];
  assert.equal(inbox.billing_error, 'invoice_evidence_changed');
  assert.equal(
    await count('marketing_outbox', "WHERE source_id='moyo.invoice:in_Mixed'"),
    0,
  );
});
test('legacy and unproven queued orders are quarantined by both migration and final delivery validation', async () => {
  const saved = await linkedBillingInquiry();
  const invoice = paidReceipt();
  await repository.saveVerifiedPayment(org, invoice);
  await pool.query(
    "UPDATE payload.marketing_outbox SET state='delivered',event=null WHERE source_id LIKE 'moyo.inquiry:%'",
  );
  const safeEvent = (
    await pool.query(
      "SELECT event FROM payload.marketing_outbox WHERE source_id='moyo.invoice:in_Synthetic'",
    )
  ).rows[0].event;
  await pool.query(
    `INSERT INTO payload.marketing_outbox(id,org_id,inquiry_id,source_id,event) VALUES($1,$2,$3,'moyo.invoice:in_Legacy',$4::jsonb)`,
    [
      randomUUID(),
      org,
      saved.id,
      JSON.stringify({ ...safeEvent, sourceId: 'moyo.invoice:in_Legacy' }),
    ],
  );
  const migration = await readFile(
    new URL(
      '../../../../packages/payload/migrations/signaliq_marketing_additive.sql',
      import.meta.url,
    ),
    'utf8',
  );
  await pool.query(migration);
  assert.equal(
    await count(
      'marketing_outbox',
      "WHERE source_id='moyo.invoice:in_Legacy' AND state='blocked' AND event IS NULL",
    ),
    1,
  );
  assert.equal(
    await count(
      'marketing_outbox',
      "WHERE source_id='moyo.invoice:in_Synthetic' AND state='pending'",
    ),
    1,
    'proven order survives repeat migration',
  );
  await pool.query(
    "UPDATE payload.marketing_outbox SET state='delivered',event=null WHERE source_id='moyo.invoice:in_Synthetic'",
  );
  await pool.query(
    `INSERT INTO payload.marketing_outbox(id,org_id,inquiry_id,source_id,event) VALUES($1,$2,$3,'moyo.invoice:in_Unproven',$4::jsonb)`,
    [
      randomUUID(),
      org,
      saved.id,
      JSON.stringify({ ...safeEvent, sourceId: 'moyo.invoice:in_Unproven' }),
    ],
  );
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    throw new Error('An unproven order must never leave Moyo.');
  });
  try {
    await service.drainMarketingOutbox(cronRequest());
    assert.equal(fetchMock.mock.callCount(), 0);
    assert.equal(
      await count(
        'marketing_outbox',
        "WHERE source_id='moyo.invoice:in_Unproven' AND state='blocked' AND event IS NULL",
      ),
      1,
    );
  } finally {
    fetchMock.mock.restore();
  }
});

test('Stripe journal facts stay raw while each frozen Signal payment uses ISO units and survives repeat migration', async () => {
  const saved = await linkedBillingInquiry();
  const cases = [
    ['USD', 4900, 4900],
    ['JPY', 700, 700],
    ['KWD', 12345, 12345],
    ['ISK', 70000, 700],
    ['UGX', 70000, 700],
    ['MGA', 700, 70000],
    ['HUF', 1045, 1045],
    ['TWD', 80045, 80045],
  ];
  const before = [];
  for (const [currency, raw, iso] of cases) {
    const invoice = paidReceipt({
      invoiceId: `in_Units${currency}`,
      currency,
      amountCents: raw,
    });
    await repository.saveVerifiedPayment(org, invoice);
    await repository.saveVerifiedPayment(org, invoice);
    const stored = (
      await pool.query(
        'SELECT amount_cents,currency,occurred_at,error_code FROM payload.marketing_verified_payments WHERE org_id=$1 AND id=$2',
        [org, invoice.invoiceId],
      )
    ).rows[0];
    assert.equal(stored.amount_cents, raw);
    assert.equal(stored.currency, currency);
    assert.equal(
      new Date(stored.occurred_at).toISOString(),
      invoice.occurredAt,
    );
    assert.equal(stored.error_code, null);
    const event = (
      await pool.query(
        'SELECT event FROM payload.marketing_outbox WHERE org_id=$1 AND source_id=$2',
        [org, `moyo.invoice:${invoice.invoiceId}`],
      )
    ).rows[0].event;
    assert.deepEqual(event.amount, { amountCents: iso, currency });
    assert.equal(event.sourceId, `moyo.invoice:${invoice.invoiceId}`);
    assert.equal(event.occurredAt, invoice.occurredAt);
    assert.equal(
      await repository.marketingTransaction((client) =>
        repository.hasVerifiedOrderReceipt(client, org, saved.id, event),
      ),
      true,
    );
    if (raw !== iso)
      assert.equal(
        await repository.marketingTransaction((client) =>
          repository.hasVerifiedOrderReceipt(client, org, saved.id, {
            ...event,
            amount: { amountCents: raw, currency },
          }),
        ),
        false,
      );
    before.push(event);
  }
  const migration = await readFile(
    new URL(
      '../../../../packages/payload/migrations/signaliq_marketing_additive.sql',
      import.meta.url,
    ),
    'utf8',
  );
  await pool.query(migration);
  await pool.query(migration);
  await repository.reconcileVerifiedPayments(org);
  const after = (
    await pool.query(
      "SELECT event,state FROM payload.marketing_outbox WHERE org_id=$1 AND event->>'kind'='order' ORDER BY source_id",
      [org],
    )
  ).rows;
  assert.equal(after.length, cases.length);
  assert.ok(after.every((row) => row.state === 'pending'));
  assert.deepEqual(
    after.map((row) => row.event),
    before.sort((a, b) => a.sourceId.localeCompare(b.sourceId)),
  );
});

test('fractional ISO units and multiplied overflow remain private reviewable facts without blocking valid payments', async () => {
  await linkedBillingInquiry();
  for (const [currency, raw] of [
    ['ISK', 501],
    ['UGX', 1],
    ['MGA', 21474837],
  ]) {
    const invoice = paidReceipt({
      invoiceId: `in_InvalidUnits${currency}`,
      currency,
      amountCents: raw,
    });
    await repository.saveVerifiedPayment(org, invoice);
    await repository.saveVerifiedPayment(org, invoice);
    const row = (
      await pool.query(
        'SELECT amount_cents,error_code FROM payload.marketing_verified_payments WHERE org_id=$1 AND id=$2',
        [org, invoice.invoiceId],
      )
    ).rows[0];
    assert.deepEqual(row, {
      amount_cents: raw,
      error_code: 'invoice_amount_unrepresentable',
    });
  }
  assert.equal((await repository.listInquiries(org))[0].billing_attention, 3);
  await repository.reconcileVerifiedPayments(org);
  assert.equal(
    await count('marketing_outbox', "WHERE event->>'kind'='order'"),
    0,
  );
  await repository.saveVerifiedPayment(
    org,
    paidReceipt({
      invoiceId: 'in_MgaMax',
      currency: 'MGA',
      amountCents: 21474836,
    }),
  );
  const valid = (
    await pool.query(
      "SELECT event FROM payload.marketing_outbox WHERE source_id='moyo.invoice:in_MgaMax'",
    )
  ).rows[0].event;
  assert.deepEqual(valid.amount, { amountCents: 2147483600, currency: 'MGA' });
  // A pre-fix raw receipt may have no unit error yet. Reconciliation must hold
  // that receipt too, without throwing and rolling back the other valid work.
  await pool.query(
    "UPDATE payload.marketing_verified_payments SET error_code=null WHERE id='in_InvalidUnitsISK'",
  );
  await repository.reconcileVerifiedPayments(org);
  assert.equal(
    (
      await pool.query(
        "SELECT error_code FROM payload.marketing_verified_payments WHERE id='in_InvalidUnitsISK'",
      )
    ).rows[0].error_code,
    'invoice_amount_unrepresentable',
  );
  assert.equal(
    await count('marketing_outbox', "WHERE event->>'kind'='order'"),
    1,
  );
});

test('private invoice repair compares original Stripe units and cannot double-convert or rewrite financial facts', async () => {
  await linkedBillingInquiry();
  const original = paidReceipt({
    invoiceId: 'in_MgaRepair',
    currency: 'MGA',
    amountCents: 700,
    evidenceStatus: 'incomplete',
  });
  await repository.saveVerifiedPayment(org, original);
  await repository.repairPaymentEvidence(org, async () => ({
    ...original,
    evidenceStatus: 'verified',
  }));
  const event = (
    await pool.query(
      "SELECT event FROM payload.marketing_outbox WHERE source_id='moyo.invoice:in_MgaRepair'",
    )
  ).rows[0].event;
  assert.deepEqual(event.amount, { amountCents: 70000, currency: 'MGA' });
  await repository.saveVerifiedPayment(org, {
    ...original,
    evidenceStatus: 'verified',
  });
  assert.deepEqual(
    (
      await pool.query(
        "SELECT event FROM payload.marketing_outbox WHERE source_id='moyo.invoice:in_MgaRepair'",
      )
    ).rows[0].event,
    event,
  );
  const invalidRepair = paidReceipt({
    invoiceId: 'in_IskRepair',
    currency: 'ISK',
    amountCents: 70000,
    evidenceStatus: 'incomplete',
  });
  await repository.saveVerifiedPayment(org, invalidRepair);
  await repository.repairPaymentEvidence(org, async () => ({
    ...invalidRepair,
    amountCents: 700,
    evidenceStatus: 'verified',
  }));
  const row = (
    await pool.query(
      "SELECT amount_cents,currency,error_code FROM payload.marketing_verified_payments WHERE id='in_IskRepair'",
    )
  ).rows[0];
  assert.deepEqual(row, {
    amount_cents: 70000,
    currency: 'ISK',
    error_code: 'invoice_evidence_changed',
  });
  assert.equal(
    await count(
      'marketing_outbox',
      "WHERE source_id='moyo.invoice:in_IskRepair'",
    ),
    0,
  );
});

test('legacy unconverted orders are quarantined without rewriting their source ID or immutable receipt', async () => {
  await linkedBillingInquiry();
  await repository.saveVerifiedPayment(
    org,
    paidReceipt({
      invoiceId: 'in_IskLegacyUnits',
      currency: 'ISK',
      amountCents: 70000,
    }),
  );
  await repository.saveVerifiedPayment(
    org,
    paidReceipt({
      invoiceId: 'in_MgaLegacyUnits',
      currency: 'MGA',
      amountCents: 700,
    }),
  );
  await pool.query(
    "UPDATE payload.marketing_outbox SET event=jsonb_set(event,'{amount,amountCents}','70000') WHERE source_id='moyo.invoice:in_IskLegacyUnits'",
  );
  await pool.query(
    await readFile(
      new URL(
        '../../../../packages/payload/migrations/signaliq_marketing_additive.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  assert.equal(
    await count(
      'marketing_outbox',
      "WHERE source_id='moyo.invoice:in_IskLegacyUnits' AND state='blocked' AND event IS NULL AND error_code='invoice_evidence_unverified'",
    ),
    1,
  );
  await pool.query(
    "UPDATE payload.marketing_outbox SET state='accepted',event=jsonb_set(event,'{amount,amountCents}','700') WHERE source_id='moyo.invoice:in_MgaLegacyUnits'",
  );
  await pool.query(
    "UPDATE payload.marketing_outbox SET state='delivered',event=null WHERE source_id LIKE 'moyo.inquiry:%'",
  );
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    throw new Error('Unconverted order must not be sent or polled');
  });
  try {
    await service.drainMarketingOutbox(cronRequest());
    assert.equal(fetchMock.mock.callCount(), 0);
    assert.equal(
      await count(
        'marketing_outbox',
        "WHERE source_id='moyo.invoice:in_MgaLegacyUnits' AND state='blocked' AND event IS NULL AND error_code='invoice_evidence_unverified'",
      ),
      1,
    );
  } finally {
    fetchMock.mock.restore();
  }
  await repository.reconcileVerifiedPayments(org);
  assert.equal(
    await count(
      'marketing_outbox',
      "WHERE source_id IN ('moyo.invoice:in_IskLegacyUnits','moyo.invoice:in_MgaLegacyUnits')",
    ),
    2,
  );
  const facts = (
    await pool.query(
      'SELECT id,amount_cents FROM payload.marketing_verified_payments ORDER BY id',
    )
  ).rows;
  assert.deepEqual(facts, [
    { id: 'in_IskLegacyUnits', amount_cents: 70000 },
    { id: 'in_MgaLegacyUnits', amount_cents: 700 },
  ]);
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

test('release preflight reads only the exact verified adult owner and schema apply is repeatable', async () => {
  await pool.query(`INSERT INTO better_auth."user"(id,name,email,"emailVerified") VALUES('synthetic-preflight-owner','Synthetic owner','preflight-owner@example.invalid',true),('synthetic-other-owner','Other synthetic owner','other-owner@example.invalid',true);
    INSERT INTO better_auth.organization(id,name,slug,"createdAt") VALUES('synthetic-owner-org','Synthetic owner organization','synthetic-owner-org',now()),('synthetic-other-org','Other synthetic organization','synthetic-other-org',now());
    INSERT INTO better_auth.member(id,"organizationId","userId",role,"createdAt") VALUES('synthetic-membership','synthetic-owner-org','synthetic-preflight-owner','owner',now()),('synthetic-other-membership','synthetic-other-org','synthetic-other-owner','owner',now());
    INSERT INTO better_auth.subscription(id,plan,"referenceId",status) VALUES('synthetic-owner-sub','ops-studio','synthetic-owner-org','active')`);
  const run = promisify(execFile);
  const script = fileURLToPath(
    new URL('../../scripts/marketing-migrate.mts', import.meta.url),
  );
  const options = {
    env: {
      ...process.env,
      MOYO_MARKETING_OWNER_EMAIL: 'preflight-owner@example.invalid',
    },
    timeout: 20000,
  };
  const result = await run(
    process.execPath,
    ['--import', 'tsx', script, '--preflight'],
    options,
  );
  const report = JSON.parse(result.stdout);
  assert.equal(report.verifiedAdultAccount, true);
  assert.equal(report.organizations.length, 1);
  assert.equal(report.organizations[0].id, 'synthetic-owner-org');
  assert.equal(report.organizations[0].writeGranted, true);
  assert.equal(result.stdout.includes('synthetic-other-org'), false);
  await run(process.execPath, ['--import', 'tsx', script, '--apply'], options);
  assert.equal(
    await count('marketing_inquiries'),
    0,
    'schema-only release step creates no customer records',
  );
});

test('an in-flight inquiry delivery serializes with withdrawal and cannot resurrect consent', async () => {
  const saved = await repository.saveInquiry(org, input(), 'rate');
  let releaseResponse;
  let announceStarted;
  const started = new Promise((resolve) => {
    announceStarted = resolve;
  });
  const responseReady = new Promise((resolve) => {
    releaseResponse = resolve;
  });
  const fetchMock = mock.method(globalThis, 'fetch', async (url, options) => {
    if (String(url).endsWith('/withdrawals'))
      return Response.json({
        state: 'withdrawn',
        requestId: JSON.parse(options.body).requestId,
      });
    announceStarted();
    await responseReady;
    return Response.json({ sourceEventId: randomUUID(), state: 'processed' });
  });
  try {
    const draining = service.drainMarketingOutbox(cronRequest());
    await started;
    let withdrawn = false;
    const withdrawal = repository
      .saveInquiryUpdate(org, 'synthetic-owner', saved.id, update('withdraw'))
      .then(() => {
        withdrawn = true;
      });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(
      withdrawn,
      false,
      'sender owns the inquiry row while request is in flight',
    );
    releaseResponse();
    await Promise.all([draining, withdrawal]);
    await service.drainMarketingOutbox(cronRequest());
    assert.equal(
      (await repository.listInquiries(org))[0].signal_consent,
      false,
    );
    assert.equal(
      await count(
        'marketing_outbox',
        "WHERE operation='withdrawal' AND state='delivered'",
      ),
      1,
    );
    assert.equal(await count('marketing_outbox', 'WHERE event IS NOT NULL'), 0);
    await assert.rejects(
      repository.saveInquiryUpdate(
        org,
        'synthetic-owner',
        saved.id,
        update('progress', { stage: 'contacted' }),
      ),
      { status: 409 },
    );
  } finally {
    releaseResponse();
    fetchMock.mock.restore();
  }
});

test('explicit recovery posts the exact accepted source event again; terminal suppression cannot retry', async () => {
  const saved = await repository.saveInquiry(org, input(), 'rate');
  const sourceEventId = randomUUID();
  const sent = [];
  const fetchMock = mock.method(globalThis, 'fetch', async (url, options) => {
    sent.push({ method: options.method, body: options.body });
    return Response.json({
      sourceEventId,
      state:
        sent.length === 1
          ? 'queued'
          : sent.length === 2
            ? 'blocked'
            : 'processed',
      ...(sent.length === 2 ? { reason: 'pipeline_mapping_invalid' } : {}),
    });
  });
  try {
    await service.drainMarketingOutbox(cronRequest());
    await pool.query(
      'UPDATE payload.marketing_outbox SET next_attempt_at=now()',
    );
    await service.drainMarketingOutbox(cronRequest());
    let row = (
      await pool.query(
        'SELECT state,source_event_id FROM payload.marketing_outbox',
      )
    ).rows[0];
    assert.equal(row.state, 'blocked');
    assert.equal(row.source_event_id, sourceEventId);
    await repository.saveInquiryUpdate(
      org,
      'synthetic-owner',
      saved.id,
      update('retry-delivery'),
    );
    await service.drainMarketingOutbox(cronRequest());
    assert.deepEqual(
      sent.map((entry) => entry.method),
      ['POST', 'GET', 'POST'],
    );
    assert.equal(sent[0].body, sent[2].body);
    row = (await pool.query('SELECT state FROM payload.marketing_outbox'))
      .rows[0];
    assert.equal(row.state, 'delivered');
    await pool.query(
      "UPDATE payload.marketing_outbox SET state='blocked',error_code='source_consent_withdrawn',event=$1::jsonb",
      [sent[0].body],
    );
    await assert.rejects(
      repository.saveInquiryUpdate(
        org,
        'synthetic-owner',
        saved.id,
        update('retry-delivery'),
      ),
      { status: 409 },
    );
  } finally {
    fetchMock.mock.restore();
  }
});
