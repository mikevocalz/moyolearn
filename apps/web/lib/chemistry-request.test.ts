import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { fetchChemistryWorker, readChemistryJson } from './chemistry-request.ts';

const encoder = new TextEncoder();

function streamedRequest(chunks: string[], headers?: HeadersInit) {
  const init: RequestInit & { duplex: 'half' } = {
    method: 'POST', headers, duplex: 'half',
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
  };
  return new Request('http://localhost/chemistry', init);
}

test('rejects an oversized chunked body without Content-Length and cancels the remaining stream', async () => {
  let pulls = 0;
  let canceled = false;
  const init: RequestInit & { duplex: 'half' } = {
    method: 'POST', duplex: 'half',
    body: new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls++;
        controller.enqueue(encoder.encode('x'.repeat(256)));
      },
      cancel() { canceled = true; },
    }),
  };
  assert.deepEqual(await readChemistryJson(new Request('http://localhost', init)), { ok: false, tooLarge: true });
  assert.equal(canceled, true);
  assert.ok(pulls <= 4, 'must stop consuming the unbounded stream after crossing the byte limit');
});

test('does not trust an understated or malformed Content-Length', async () => {
  for (const length of ['1', 'invalid']) {
    assert.deepEqual(await readChemistryJson(streamedRequest(['x'.repeat(256), 'x'.repeat(257)], { 'Content-Length': length })), { ok: false, tooLarge: true });
  }
});

test('accepts valid JSON at the exact 512-byte boundary', async () => {
  const json = JSON.stringify({ moleculeId: 'h2-equilibrium' });
  const body = ' '.repeat(512 - encoder.encode(json).byteLength) + json;
  assert.deepEqual(await readChemistryJson(streamedRequest([body.slice(0, 250), body.slice(250)])), { ok: true, value: { moleculeId: 'h2-equilibrium' } });
});

test('counts UTF-8 bytes rather than JavaScript characters and rejects malformed JSON', async () => {
  const unicode = JSON.stringify({ value: 'é'.repeat(252) });
  assert.ok(unicode.length < 512);
  assert.deepEqual(await readChemistryJson(streamedRequest([unicode])), { ok: false, tooLarge: true });
  assert.deepEqual(await readChemistryJson(streamedRequest(['{'])), { ok: false, tooLarge: false });
});

async function listen(server: Server): Promise<URL> {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return new URL(`http://127.0.0.1:${address.port}`);
}

async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

test('sends the selected molecule to the configured worker and accepts its response', async (t) => {
  let observed: { method?: string; path?: string; body: string } | undefined;
  const worker = createServer((request, response) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => { body += chunk; });
    request.on('end', () => {
      observed = { method: request.method, path: request.url, body };
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ moleculeId: 'h2-stretched', energyHartree: -0.9 }));
    });
  });
  const workerUrl = await listen(worker);
  t.after(() => close(worker));
  const response = await fetchChemistryWorker(workerUrl, 'test-worker-token', 'h2-stretched');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { moleculeId: 'h2-stretched', energyHartree: -0.9 });
  assert.deepEqual(observed, { method: 'POST', path: '/v1/chemistry/energy', body: JSON.stringify({ moleculeId: 'h2-stretched' }) });
});

test('never follows a worker redirect or transmits its token to the redirect destination', async (t) => {
  let destinationRequests = 0;
  const destination = createServer((_request, response) => {
    destinationRequests++;
    response.end('{}');
  });
  const destinationUrl = await listen(destination);
  t.after(() => close(destination));

  let workerRequests = 0;
  const worker = createServer((request, response) => {
    workerRequests++;
    assert.equal(request.headers['x-chemistry-worker-token'], 'test-worker-token');
    response.writeHead(307, { Location: destinationUrl.href });
    response.end();
  });
  const workerUrl = await listen(worker);
  t.after(() => close(worker));
  await assert.rejects(fetchChemistryWorker(workerUrl, 'test-worker-token', 'h2-equilibrium'));
  assert.equal(workerRequests, 1);
  assert.equal(destinationRequests, 0);
});
