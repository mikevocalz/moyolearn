// Authenticated cron observability must never log credentials or source records.
// SOT: docs/site/signaliq-business-connection.md
// SOT-KEYWORDS: marketing cron structured receipt privacy test
import { after, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const data = (source: string) =>
  `data:text/javascript,${encodeURIComponent(source)}`;
const serviceUrl = data(`
  export const fixture = { calls: 0, result: { state: 'ready', processed: 0 }, error: null };
  export async function drainMarketingOutbox(inspect) {
    fixture.calls++;
    if (typeof inspect !== 'function') throw new Error('Missing invoice repair adapter');
    if (fixture.error) throw fixture.error;
    return fixture.result;
  }
`);
const aliases: Record<string, string> = {
  '@/lib/marketing/marketing.service': serviceUrl,
  '@acme/auth/server': data('export function recheckMoyoPaidInvoice() {}'),
};
const hooks = registerHooks({
  resolve(specifier, context, next) {
    return aliases[specifier]
      ? { url: aliases[specifier], shortCircuit: true }
      : next(specifier, context);
  },
});
const { fixture } = await import(serviceUrl);
const { GET } = await import('../../app/api/marketing/sync/route.ts');
const savedSecret = process.env.CRON_SECRET;
after(() => {
  hooks.deregister();
  if (savedSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = savedSecret;
});
const request = (bearer: string) =>
  new Request('https://app.example.invalid/api/marketing/sync', {
    headers: { authorization: `Bearer ${bearer}` },
  });

test('only an authenticated drain emits aggregate success status and preserves its response', async () => {
  process.env.CRON_SECRET = 'synthetic-cron-secret';
  fixture.calls = 0;
  fixture.error = null;
  const info = mock.method(console, 'info', () => {});
  const error = mock.method(console, 'error', () => {});
  try {
    assert.equal((await GET(request('incorrect'))).status, 401);
    assert.equal(fixture.calls, 0);
    assert.equal(info.mock.callCount(), 0);
    assert.equal(error.mock.callCount(), 0);
    for (const result of [
      { state: 'ready', processed: 3 },
      { state: 'not-configured', processed: 0 },
    ]) {
      fixture.result = {
        ...result,
        privateFutureField: 'never-log@example.invalid',
      };
      const response = await GET(request('synthetic-cron-secret'));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await response.json(), fixture.result);
      const logged = info.mock.calls.at(-1)?.arguments;
      assert.deepEqual(logged, [
        JSON.stringify({ event: 'moyo.marketing.sync', ...result }),
      ]);
      assert.equal(JSON.stringify(logged).includes('never-log'), false);
      assert.equal(
        JSON.stringify(logged).includes('synthetic-cron-secret'),
        false,
      );
    }
  } finally {
    info.mock.restore();
    error.mock.restore();
  }
});

test('failed drains emit a fixed failure receipt without exception text or invented counts', async () => {
  process.env.CRON_SECRET = 'synthetic-cron-secret';
  fixture.error = new Error(
    'Private customer or credential must never enter logs',
  );
  const info = mock.method(console, 'info', () => {});
  const error = mock.method(console, 'error', () => {});
  try {
    const response = await GET(request('synthetic-cron-secret'));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: 'Marketing delivery could not finish.',
    });
    assert.equal(info.mock.callCount(), 0);
    assert.deepEqual(error.mock.calls[0]?.arguments, [
      JSON.stringify({ event: 'moyo.marketing.sync', state: 'failed' }),
    ]);
  } finally {
    fixture.error = null;
    info.mock.restore();
    error.mock.restore();
  }
});
