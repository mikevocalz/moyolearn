// Native PDF input must enter manual recovery until page rendering is available.
// SOT: ./read-document-at.native.ts; ./native-document-policy.ts
// SOT-KEYWORDS: native pdf completeness manual recovery test
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { readDocumentUsing } from './read-document-at.shared.ts';
import { readUnsupportedNativePdf } from './native-document-policy.ts';

it('rejects apparent PDF text instead of accepting an incomplete native transcript', async () => {
  const bytes = new TextEncoder().encode('%PDF-1.7\nstream\nBT (Only visible text) Tj ET\nendstream');
  for (const mime of ['application/pdf', 'application/octet-stream', undefined]) {
    const result = await readDocumentUsing('content://worksheet', mime, async () => bytes, readUnsupportedNativePdf);
    assert.deepEqual(result, { text: '', reason: 'unsupported' });
  }
});

it('preserves supported text documents with native PDF policy installed', async () => {
  const text = 'Yo tieno dos hermanos. 2 + 2 = 5';
  const result = await readDocumentUsing('content://worksheet', 'text/plain', async () => new TextEncoder().encode(text), readUnsupportedNativePdf);
  assert.deepEqual(result, { text, reason: 'ok' });
});
