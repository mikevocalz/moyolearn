import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emailPreviewDocument } from './email-document-policy.ts';
const html = '<!DOCTYPE html><html><head></head><body><a href="https://example.com">Link</a></body></html>';
test('blocks scripts, remote resources, forms and base navigation by default', () => {
  const result = emailPreviewDocument(html, false);
  for (const directive of ["default-src 'none'", "script-src 'none'", "img-src 'none'", "form-action 'none'", "base-uri 'none'"]) assert.ok(result.includes(directive));
  assert.ok(result.indexOf('Content-Security-Policy') < result.indexOf('<body>'));
});
test('explicit image opt-in only permits HTTPS images', () => {
  const result = emailPreviewDocument(html, true);
  assert.ok(result.includes('img-src https:')); assert.ok(result.includes("script-src 'none'"));
});
test('link target cannot navigate the preview context', () => assert.ok(emailPreviewDocument(html, false).includes('<a target="_blank" ')));
test('rejects malformed document envelopes', () => {
  assert.throws(() => emailPreviewDocument('<body>hello</body>', false));
  assert.throws(() => emailPreviewDocument('<!DOCTYPE html><html><body>x</body></html>', false));
});

test('accepts the actual lowercase envelope emitted by renderCampaign', () => assert.ok(emailPreviewDocument(html.replace('<!DOCTYPE html>', '<!doctype html>'), false).includes('Content-Security-Policy')));
