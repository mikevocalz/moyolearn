// Acceptance is not processing; retries preserve source IDs and consent tombstones.
// SOT: docs/site/signaliq-business-connection.md
// SOT-KEYWORDS: marketing transport test delivery queued receipt withdrawal
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deliverItem,
  deliveryConfiguration,
  deliveryItem,
} from './delivery.ts';

const id = '04f3dfc3-1a08-4653-872d-b79dd653ecab';
const config = {
  endpoint: 'https://signal.example/api/ingest/v1/business-events',
  key: 'synthetic-not-a-live-key',
};
const item = deliveryItem.parse({
  operation: 'business-event',
  event: {
    sourceId: `moyo.inquiry:${id}`,
    kind: 'inquiry',
    occurredAt: '2026-11-14T10:00:00Z',
    sourceRef: `record:${id}`,
    consent: true,
    path: '/for-schools',
    contact: { email: 'adult@example.invalid', name: 'Synthetic adult' },
    summary: 'Synthetic test inquiry.',
  },
});

test('server configuration rejects browser-inappropriate or ambiguous destinations', () => {
  assert.deepEqual(deliveryConfiguration(config.endpoint, config.key), config);
  for (const endpoint of [
    'http://signal.example/api/ingest/v1/business-events',
    'https://user:password@signal.example/api/ingest/v1/business-events',
    'https://signal.example/api/ingest/v1/business-events?token=x',
    'https://signal.example/other',
  ])
    assert.equal(deliveryConfiguration(endpoint, config.key), null);
  assert.equal(deliveryConfiguration(config.endpoint, ''), null);
});
test('queued receipt stays accepted and later GET proves processing without resending contact details', async () => {
  let calls = 0;
  const transport: typeof fetch = async (url, options) => {
    calls++;
    assert.equal(options?.redirect, 'error');
    assert.equal(new Headers(options?.headers).get('origin'), null);
    assert.equal(
      new Headers(options?.headers).get('authorization'),
      `Bearer ${config.key}`,
    );
    if (calls === 1) {
      assert.equal(options?.method, 'POST');
      assert.equal(options?.body, JSON.stringify(item.event));
    } else {
      assert.equal(options?.method, 'GET');
      assert.equal(options?.body, undefined);
      assert.equal(
        new URL(String(url)).searchParams.get('sourceId'),
        `moyo.inquiry:${id}`,
      );
    }
    return Response.json({
      sourceEventId: id,
      state: calls === 1 ? 'queued' : 'processed',
    });
  };
  assert.deepEqual(await deliverItem(config, item, false, transport), {
    state: 'accepted',
    sourceEventId: id,
  });
  assert.deepEqual(await deliverItem(config, item, true, transport), {
    state: 'delivered',
    sourceEventId: id,
  });
});
test('timeout, invalid acknowledgment, source rejection and processing failure remain visible', async () => {
  assert.deepEqual(
    await deliverItem(config, item, false, async () => {
      throw new Error('timeout');
    }),
    { state: 'retry', error: 'delivery_unconfirmed' },
  );
  assert.deepEqual(
    await deliverItem(config, item, false, async () =>
      Response.json({ ok: true }),
    ),
    { state: 'retry', error: 'invalid_receipt' },
  );
  assert.deepEqual(
    await deliverItem(
      config,
      item,
      false,
      async () => new Response(null, { status: 401 }),
    ),
    { state: 'blocked', error: 'source_authorization' },
  );
  assert.deepEqual(
    await deliverItem(config, item, false, async () =>
      Response.json({
        sourceEventId: id,
        state: 'blocked',
        reason: 'consent_withdrawn',
      }),
    ),
    { state: 'blocked', error: 'consent_withdrawn' },
  );
});
test('withdrawal receipt is bound to its stable request ID', async () => {
  const withdrawal = deliveryItem.parse({
    operation: 'withdrawal',
    event: { requestId: id, inquirySourceId: `moyo.inquiry:${id}` },
  });
  const result = await deliverItem(
    config,
    withdrawal,
    false,
    async (url, options) => {
      assert.equal(
        new URL(String(url)).pathname,
        '/api/ingest/v1/business-events/withdrawals',
      );
      assert.equal(options?.body, JSON.stringify(withdrawal.event));
      return Response.json({ state: 'withdrawn', requestId: id });
    },
  );
  assert.deepEqual(result, { state: 'delivered', sourceEventId: null });
  assert.equal(
    (
      await deliverItem(config, withdrawal, false, async () =>
        Response.json({
          state: 'withdrawn',
          requestId: '86b977e1-c813-4632-94c7-8e2b321fb997',
        }),
      )
    ).state,
    'retry',
  );
});
