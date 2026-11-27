// Platform entry points share the Block without borrowing a customer identity or plan.
// SOT: protected-operation.ts · ../marketing/permissions/marketing.permissions.ts
// SOT-KEYWORDS: protected operation marketing payload cron public billing telemetry security
import assert from 'node:assert/strict';
import { after, beforeEach, mock, test } from 'node:test';
import { registerHooks } from 'node:module';
import { setOperationSink } from './telemetry.ts';
import type { OperationRecord } from './telemetry.ts';

const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@acme/auth/server')
      throw new Error(
        'A platform operation must not initialize customer authentication',
      );
    return next(specifier, context);
  },
});
const { protectedOperation } = await import('./protected-operation.ts');
const records: OperationRecord[] = [];
const telemetry = {
  op: 'marketing.test',
  resource: 'marketing-inquiries',
  action: 'write' as const,
};
const headers = () =>
  new Headers({
    host: 'admin.moyolearn.com',
    origin: 'https://admin.moyolearn.com',
  });
const internal = () => ({
  user: { id: 1, collection: 'users' as const },
  headers: headers(),
});
const saved = Object.fromEntries(
  [
    'MOYO_MARKETING_ADMIN_IDS',
    'MOYO_MARKETING_ADMIN_ORIGIN',
    'MOYO_MARKETING_RATE_SECRET',
    'CRON_SECRET',
    'NODE_ENV',
    'NEXT_PUBLIC_AUTH_MODE',
  ].map((name) => [name, process.env[name]]),
);
beforeEach(() => {
  records.length = 0;
  setOperationSink((record) => records.push(record));
  process.env.MOYO_MARKETING_ADMIN_IDS = '1';
  process.env.MOYO_MARKETING_ADMIN_ORIGIN = 'https://admin.moyolearn.com';
  process.env.MOYO_MARKETING_RATE_SECRET = 'synthetic-private-rate-secret';
  process.env.CRON_SECRET = 'synthetic-private-cron-secret';
  // A customer mock must never authorize a platform entry point.
  process.env.NODE_ENV = 'development';
  process.env.NEXT_PUBLIC_AUTH_MODE = 'mock';
});
after(() => {
  hooks.deregister();
  setOperationSink(null);
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test('internal Payload identity, host and mutation origin are enforced before the handler', async () => {
  let calls = 0;
  const operation = async () => {
    calls++;
  };
  const invalid = [
    { request: { ...internal(), user: null }, status: 401 },
    {
      request: { ...internal(), user: { id: 2, collection: 'users' as const } },
      status: 403,
    },
    {
      request: { ...internal(), user: { id: 1, collection: 'other' } },
      status: 403,
    },
    {
      request: {
        ...internal(),
        headers: new Headers({
          host: 'app.moyolearn.com',
          origin: 'https://admin.moyolearn.com',
        }),
      },
      status: 403,
    },
    {
      request: {
        ...internal(),
        headers: new Headers({
          host: 'admin.moyolearn.com',
          origin: 'https://untrusted.invalid',
        }),
      },
      status: 403,
    },
  ];
  for (const { request, status } of invalid) {
    await assert.rejects(
      protectedOperation({
        source: 'payload-internal',
        request,
        action: 'write',
        telemetry,
        operation,
      }),
      { status },
    );
  }
  assert.equal(calls, 0);
  assert.equal(records.length, invalid.length);
  assert.equal(records[0]?.outcome, 'unauthenticated');
  assert.ok(records.slice(1).every((record) => record.outcome === 'denied'));
  assert.ok(records.every((record) => record.authMode === 'payload-internal'));
  const ctx = await protectedOperation({
    source: 'payload-internal',
    request: internal(),
    action: 'write',
    telemetry,
    operation: async (ctx) => ctx,
  });
  assert.deepEqual(ctx, {
    kind: 'internal-admin',
    scope: 'moyo-platform-sales',
    actorId: 'payload:1',
  });
  assert.equal(records.at(-1)?.ctxKind, 'internal-admin');
  assert.equal(records.at(-1)?.capability, 'platform-sales');
  delete process.env.MOYO_MARKETING_ADMIN_IDS;
  await assert.rejects(
    protectedOperation({
      source: 'payload-internal',
      request: internal(),
      action: 'read',
      telemetry,
      operation,
    }),
    { status: 403 },
  );
});

test('public intake stays anonymous and requires its own origin/configuration in mock mode', async () => {
  const request = {
    headers: new Headers({
      origin: 'https://www.moyolearn.com',
      'x-vercel-forwarded-for': '192.0.2.42',
    }),
  };
  const ctx = await protectedOperation({
    source: 'public-inquiry',
    request,
    telemetry,
    operation: async (ctx) => ctx,
  });
  assert.equal(ctx.kind, 'anonymous');
  assert.equal(ctx.scope, 'moyo-platform-sales');
  assert.match(ctx.rateKey, /^[a-f0-9]{64}$/);
  assert.equal(records.at(-1)?.authMode, 'public-inquiry');
  // The hourly window lives in the repository; the key must not roll over at
  // UTC midnight and hand the same address a fresh bucket mid-hour.
  const keyAt = async (iso: string) => {
    mock.timers.enable({ apis: ['Date'], now: new Date(iso) });
    try {
      return (
        await protectedOperation({
          source: 'public-inquiry',
          request,
          telemetry,
          operation: async (ctx) => ctx,
        })
      ).rateKey;
    } finally {
      mock.timers.reset();
    }
  };
  assert.equal(
    await keyAt('2026-11-25T23:59:30.000Z'),
    await keyAt('2026-11-26T00:00:30.000Z'),
  );
  await assert.rejects(
    protectedOperation({
      source: 'public-inquiry',
      request: {
        headers: new Headers({ origin: 'https://untrusted.invalid' }),
      },
      telemetry,
      operation: async () => {},
    }),
    { status: 403 },
  );
  delete process.env.MOYO_MARKETING_RATE_SECRET;
  await assert.rejects(
    protectedOperation({
      source: 'public-inquiry',
      request,
      telemetry,
      operation: async () => {},
    }),
    { status: 503 },
  );
  assert.equal(records.at(-1)?.outcome, 'error');
});

test('cron credentials cannot be replaced by customer mock auth and denials are recorded', async () => {
  let calls = 0;
  for (const authorization of ['', 'Bearer wrong']) {
    await assert.rejects(
      protectedOperation({
        source: 'marketing-cron',
        request: { headers: new Headers({ authorization }) },
        telemetry,
        operation: async () => {
          calls++;
        },
      }),
      { status: 401 },
    );
  }
  assert.equal(calls, 0);
  assert.ok(records.every((record) => record.outcome === 'unauthenticated'));
  const ctx = await protectedOperation({
    source: 'marketing-cron',
    request: {
      headers: new Headers({
        authorization: 'Bearer synthetic-private-cron-secret',
      }),
    },
    telemetry,
    operation: async (ctx) => ctx,
  });
  assert.deepEqual(ctx, { kind: 'machine', scope: 'moyo-platform-sales' });
  assert.equal(records.at(-1)?.authMode, 'marketing-cron');
});

test('billing callback uses receipt data without manufacturing a learner or logging private facts', async () => {
  const payment = {
    invoiceId: 'in_Synthetic',
    customerId: 'cus_Synthetic',
    subscriptionId: 'sub_Synthetic',
    amountCents: 4900,
    currency: 'USD',
    occurredAt: '2026-11-16T12:00:00.000Z',
    live: true,
    evidenceStatus: 'verified' as const,
    moyoPriceSeen: true,
  };
  const ctx = await protectedOperation({
    source: 'billing-callback',
    payment,
    telemetry,
    operation: async (ctx) => ctx,
  });
  assert.deepEqual(ctx, {
    kind: 'machine',
    scope: 'moyo-platform-sales',
    payment,
  });
  assert.equal(records.at(-1)?.authMode, 'billing-callback');
  await assert.rejects(
    protectedOperation({
      source: 'billing-callback',
      payment: { ...payment, invoiceId: 'invalid' },
      telemetry,
      operation: async () => {},
    }),
    { status: 422 },
  );
  await assert.rejects(
    protectedOperation({
      source: 'payload-internal',
      request: internal(),
      action: 'read',
      telemetry,
      operation: async () => {
        throw new Error('private@example.invalid');
      },
    }),
    /private@example.invalid/,
  );
  const serialized = JSON.stringify(records);
  for (const secret of [
    'private@example.invalid',
    'payload:1',
    'moyo-platform-sales',
    'in_Synthetic',
    'cus_Synthetic',
    'sub_Synthetic',
    'amountCents',
    'synthetic-private',
    '192.0.2.42',
  ])
    assert.equal(serialized.includes(secret), false, secret);
  assert.ok(
    records.every(
      (record) => record.attributed && Number.isFinite(record.latencyMs),
    ),
  );
  assert.equal(records.at(-1)?.outcome, 'error');
});

test('unknown runtime sources and internal actions fail closed without reflecting their values', async () => {
  let calls = 0;
  const operation = async () => {
    calls++;
  };
  await assert.rejects(
    Reflect.apply(protectedOperation, undefined, [
      { source: 'private-source@example.invalid', telemetry, operation },
    ]),
    /Unrecognized operation source/,
  );
  assert.equal(records.length, 1);
  assert.equal(records[0]?.authMode, 'invalid-source');
  assert.equal(records[0]?.outcome, 'error');
  await assert.rejects(
    Reflect.apply(protectedOperation, undefined, [
      {
        source: 'payload-internal',
        request: internal(),
        action: 'private-action@example.invalid',
        telemetry,
        operation,
      },
    ]),
    { status: 403 },
  );
  assert.equal(records.length, 2);
  assert.equal(records[1]?.outcome, 'denied');
  assert.equal(calls, 0);
  assert.equal(JSON.stringify(records).includes('@example.invalid'), false);
});
