// Focused executable contracts; no real API key, contact, email send, or GPU.
// SOT: docs/business/creative-studio.md
// SOT-KEYWORDS: business campaign tests tenant security export mailcheap
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { CampaignInputError, MAX_DOCUMENT_BYTES, draftReceipt, httpsUrl, moveBefore, moveBlock, newBlock, newDocument, parseDocument, parseEditableDocument } from './document.ts';
import { renderCampaign, UNSUBSCRIBE } from './render.ts';
import { connectionFor, createMailcheapDraft, MailcheapError, readBoundedBody } from './mailcheap.ts';
import { campaignResponse } from './http.ts';

const theme = { surface: '#ffffff', text: '#111111', primary: '#ffdd00', onPrimary: '#111111' };
const brand = { name: 'Fixture business', postalAddress: 'TEST ADDRESS — NOT A LIVE SENDER' };
const id = '0123456789abcdef01234567';
const entry = { orgId: 'org-a', origin: 'https://mail-a.example.com', apiKey: 'fixture-not-a-live-key', newsletter: 'family-news', businessName: brand.name, postalAddress: brand.postalAddress };
const configured = () => {
  const connection = connectionFor(JSON.stringify([entry]), 'org-a');
  assert.ok(connection); return connection;
};
const request = (body: string, origin = 'https://app.example.com') => new Request('https://app.example.com/api/business/campaigns', {
  method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body,
});

test('valid document round-trips', () => assert.deepEqual(parseDocument(JSON.stringify(newDocument())), newDocument()));
for (const field of ['orgId', 'userId', 'html', 'recipients', 'send', 'newsletter', 'origin']) {
  test(`client ${field} cannot cross the document boundary`, () => {
    assert.throws(() => parseDocument(JSON.stringify({ ...newDocument(), [field]: 'injected' })), CampaignInputError);
  });
}
for (const url of ['http://example.com/a', 'javascript:alert(1)', 'data:image/png;base64,AA', 'file:///etc/passwd', 'https://u:p@example.com/a', 'https://example.com/a b', '//example.com/a']) {
  test(`reject unsafe image/button URL: ${url}`, () => assert.throws(() => httpsUrl(url, 'URL'), CampaignInputError));
}
test('accept absolute HTTPS asset URL', () => assert.equal(httpsUrl('https://assets.example.com/a.png?version=2', 'URL'), 'https://assets.example.com/a.png?version=2'));
test('duplicate block IDs fail', () => {
  const document = newDocument(); document.blocks.push({ ...document.blocks[0]! });
  assert.throws(() => parseDocument(JSON.stringify(document)), /unique/);
});
test('unknown block cannot masquerade as raw HTML', () => {
  assert.throws(() => parseDocument(JSON.stringify({ ...newDocument(), blocks: [{ id: 'raw', kind: 'html', html: '<script>x</script>' }] })), /Unsupported/);
});
test('subject rejects header injection', () => assert.throws(() => parseDocument(JSON.stringify({ ...newDocument(), subject: 'hello\r\nBcc: other@example.com' })), /single line/));
test('all-divider export fails', () => assert.throws(() => parseDocument(JSON.stringify({ ...newDocument(), blocks: [newBlock('divider', 'line')] })), /Add some/));
test('image description is mandatory on export', () => assert.throws(() => parseDocument(JSON.stringify({ ...newDocument(), blocks: [{ id: 'pic', kind: 'image', src: 'https://assets.example.com/a.png', alt: '' }] })), /description/));
test('unfinished fields survive editable download/restore but cannot export', () => {
  const draft = { ...newDocument(), subject: '', blocks: [newBlock('image', 'image'), newBlock('button', 'cta')] };
  assert.deepEqual(parseEditableDocument(JSON.stringify(draft)), draft);
  assert.throws(() => parseDocument(JSON.stringify(draft)), CampaignInputError);
});
test('unfinished or unsafe draft URLs remain inert and cannot render/export', () => {
  const draft = { ...newDocument(), blocks: [{ id: 'pic', kind: 'image', src: 'javascript:alert(1)', alt: '' }] };
  assert.deepEqual(parseEditableDocument(JSON.stringify(draft)), draft);
  assert.throws(() => renderCampaign(parseEditableDocument(JSON.stringify(draft)), brand, theme), CampaignInputError);
});
test('HTML is escaped and authored macros cannot suppress the footer', () => {
  const document = newDocument(); document.blocks = [{ id: 'text', kind: 'paragraph', text: '<script>alert(1)</script> {{unsubscribe_url}} & hello' }];
  const html = renderCampaign(document, brand, theme);
  assert.ok(!html.includes('<script>')); assert.ok(html.includes('&lt;script&gt;'));
  assert.equal(html.split(UNSUBSCRIBE).length - 1, 1);
  assert.ok(html.includes('&#123;&#123;unsubscribe_url&#125;&#125;'));
  assert.ok(html.includes('role="presentation"')); assert.ok(html.includes('lang="en"'));
});
test('brand is escaped and missing sender address blocks export', () => {
  const html = renderCampaign(newDocument(), { ...brand, name: 'A < B' }, theme);
  assert.ok(html.includes('A &lt; B'));
  assert.throws(() => renderCampaign(newDocument(), { ...brand, postalAddress: '' }, theme), /postal address/);
});
test('CSS cannot enter through theme values', () => assert.throws(() => renderCampaign(newDocument(), brand, { ...theme, text: 'red; background:url(https://bad.example)' }), /tokens/));
test('rendered HTML has a separate byte budget', () => {
  const document = newDocument(); document.blocks = Array.from({ length: 15 }, (_, n) => ({ id: `p${n}`, kind: 'paragraph', text: '&'.repeat(2_000) }));
  assert.throws(() => renderCampaign(document, brand, theme), /too large/);
});
test('document byte budget counts UTF-8, not characters', () => assert.throws(() => parseDocument('🎨'.repeat(MAX_DOCUMENT_BYTES / 3)), /64 KiB/));
test('keyboard reorder is immutable and boundaries are no-ops', () => {
  const document = newDocument(); const moved = moveBlock(document, 'welcome', 1);
  assert.equal(document.blocks[0]?.id, 'welcome'); assert.equal(moved.blocks[1]?.id, 'welcome');
  assert.equal(moveBlock(document, 'welcome', -1), document); assert.equal(moveBlock(document, 'missing', 1), document);
});
test('drag reorder validates both IDs', () => {
  const document = newDocument(); assert.equal(moveBefore(document, 'missing', 'intro'), document);
  assert.equal(moveBefore(document, 'intro', 'missing'), document); assert.equal(moveBefore(document, 'intro', 'intro'), document);
  assert.equal(moveBefore(document, 'intro', 'welcome').blocks[0]?.id, 'intro');
});
test('connection lookup cannot fall back to another organization', () => {
  assert.equal(connectionFor(undefined, 'org-a'), null);
  assert.equal(connectionFor(JSON.stringify([entry]), 'org-b'), null);
  assert.equal(configured().newsletter, 'family-news');
});
test('each tenant gets its own explicit origin', () => {
  const b = { ...entry, orgId: 'org-b', origin: 'https://mail-b.example.com', newsletter: 'b-news' };
  assert.equal(connectionFor(JSON.stringify([entry, b]), 'org-b')?.newsletter, 'b-news');
  assert.throws(() => connectionFor(JSON.stringify([entry, { ...b, origin: entry.origin }]), 'org-b'), MailcheapError);
});
for (const origin of ['http://example.com', 'https://localhost', 'https://127.0.0.1', 'https://mail.example.com/api', 'https://mail.example.com:444', 'https://mail.internal']) {
  test(`reject invalid configured origin: ${origin}`, () => assert.throws(() => connectionFor(JSON.stringify([{ ...entry, origin }]), 'org-a'), MailcheapError));
}
test('configuration errors never disclose credentials', () => {
  assert.throws(() => connectionFor(JSON.stringify([{ ...entry, apiKey: 'secret with spaces' }]), 'org-a'), (error: Error) => !error.message.includes('secret'));
});
test('forged response URL is discarded', () => assert.equal(draftReceipt(JSON.stringify({ id, url: 'https://attacker.example/phish' }), entry.origin).url, `${entry.origin}/campaigns/${id}`));
test('draft adapter uses documented payload, server-selected newsletter, no send', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (url, init) => {
    calls++; assert.equal(url, `${entry.origin}/api/v1/campaigns`);
    assert.equal(init?.redirect, 'error'); assert.equal(init?.credentials, 'omit');
    const headers = new Headers(init?.headers); assert.equal(headers.get('Authorization'), `Bearer ${entry.apiKey}`);
    assert.equal(typeof init?.body, 'string');
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(Object.keys(body).sort(), ['html', 'newsletter', 'previewText', 'subject']);
    assert.equal(body.newsletter, entry.newsletter);
    return Response.json({ id, url: 'https://attacker.example' }, { status: 201 });
  };
  const receipt = await createMailcheapDraft(configured(), newDocument(), '<p>fixture</p>', fetcher);
  assert.equal(calls, 1); assert.equal(receipt.url, `${entry.origin}/campaigns/${id}`);
  assert.ok(!JSON.stringify(receipt).includes(entry.apiKey));
});
test('network error is uncertain and never automatically retried', async () => {
  let calls = 0;
  await assert.rejects(createMailcheapDraft(configured(), newDocument(), '<p>fixture</p>', async () => { calls++; throw new Error(entry.apiKey); }), (error: MailcheapError) => error.status === 504 && !error.message.includes(entry.apiKey));
  assert.equal(calls, 1);
});
test('429 is preserved without retry', async () => {
  let calls = 0;
  await assert.rejects(createMailcheapDraft(configured(), newDocument(), 'fixture', async () => { calls++; return new Response('rate', { status: 429 }); }), (error: MailcheapError) => error.status === 429);
  assert.equal(calls, 1);
});
test('unbounded/malformed success receipts do not claim success', async () => {
  await assert.rejects(createMailcheapDraft(configured(), newDocument(), 'fixture', async () => new Response('x'.repeat(9_000), { status: 201 })), /receipt/);
  await assert.rejects(createMailcheapDraft(configured(), newDocument(), 'fixture', async () => Response.json({ id: '../escape' }, { status: 201 })), /receipt/);
});
test('stream reader rejects dishonest or missing length headers through actual bytes', async () => {
  const response = new Response('🎨'.repeat(10), { headers: { 'Content-Length': '1' } });
  await assert.rejects(readBoundedBody(response.body, 20), /size/);
});
test('same-origin web envelope rejects CSRF before invoking the service', async () => {
  let calls = 0;
  const result = await campaignResponse(request(JSON.stringify(newDocument()), 'https://attacker.example'), async () => { calls++; return { id, url: entry.origin }; });
  assert.equal(result.status, 403); assert.equal(calls, 0);
});
test('web envelope rejects client tenant hints before invoking service', async () => {
  let calls = 0;
  const result = await campaignResponse(request(JSON.stringify({ ...newDocument(), orgId: 'other' })), async () => { calls++; return { id, url: entry.origin }; });
  assert.equal(result.status, 400); assert.equal(calls, 0);
});
test('web envelope rejects oversized body without invoking service', async () => {
  let calls = 0;
  const result = await campaignResponse(request('x'.repeat(MAX_DOCUMENT_BYTES + 1)), async () => { calls++; return { id, url: entry.origin }; });
  assert.equal(result.status, 400); assert.equal(calls, 0);
});
test('service refusal is preserved and responses are not cacheable', async () => {
  const result = await campaignResponse(request(JSON.stringify(newDocument())), async () => { throw new MailcheapError('Owner only.', 403); });
  assert.equal(result.status, 403); assert.equal(result.headers.get('Cache-Control'), 'private, no-store');
});
test('native fetch rejects a real redirect without hitting its destination', async () => {
  let redirected = 0;
  const server = createServer((req, res) => {
    if (req.url === '/destination') { redirected++; res.end('bad'); return; }
    res.writeHead(307, { Location: '/destination' }); res.end();
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const local = `http://127.0.0.1:${address.port}/start`;
  try {
    await assert.rejects(createMailcheapDraft(configured(), newDocument(), 'fixture', (_url, init) => fetch(local, init)), /could not be confirmed/);
    assert.equal(redirected, 0);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});

test('near-limit editable downloads remain restorable without pretty-print inflation', async () => {
  const { serializeEditableDocument } = await import('./document.ts');
  const document = { ...newDocument(), blocks: Array.from({ length: 30 }, (_, index) => ({
    id: `image-${index}`, kind: 'image' as const, src: `https://example.com/${'a'.repeat(2_000)}`, alt: 'a'.repeat(75),
  })) };
  assert.ok(new TextEncoder().encode(JSON.stringify(document, null, 2)).length > MAX_DOCUMENT_BYTES);
  const download = serializeEditableDocument(document);
  assert.ok(new TextEncoder().encode(download).length <= MAX_DOCUMENT_BYTES);
  assert.deepEqual(parseEditableDocument(download), document);
});

for (const bytes of [new Uint8Array([0xff]), new Uint8Array([0xe2, 0x82])]) {
  test(`malformed UTF-8 ${[...bytes]} is rejected as client input before draft creation`, async () => {
    let calls = 0;
    const response = await campaignResponse(new Request('https://business.example/api/business/campaigns', {
      method: 'POST', headers: { origin: 'https://business.example', 'content-type': 'application/json' }, body: bytes,
    }), async () => { calls += 1; return { id, url: `https://mail.example.com/campaigns/${id}` }; });
    assert.equal(response.status, 400);
    assert.equal(calls, 0);
    assert.match(await response.text(), /valid UTF-8/);
  });
}
test('UTF-8 multibyte characters survive stream chunk boundaries', async () => {
  const bytes = new TextEncoder().encode('learning 🌱');
  const stream = new ReadableStream({ start(controller) {
    for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
    controller.close();
  } });
  assert.equal(await readBoundedBody(stream, MAX_DOCUMENT_BYTES), 'learning 🌱');
});
