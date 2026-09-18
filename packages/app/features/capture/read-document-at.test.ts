// Test URI transport failures without loading native modules in Node.
// SOT-KEYWORDS: homework document transport tests unicode failure
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { readDocumentUsing, MAX_DOCUMENT_BYTES } from './read-document-at.shared.ts';
it('preserves source bytes and failures through the document transport', async () => {
  const uri = 'content://picked/homework';
  const reading = await readDocumentUsing(uri, 'text/plain', async (requested) => {
    assert.equal(requested, uri);
    return new TextEncoder().encode('حل ٣ + ٢');
  });
  assert.equal(reading.text, 'حل ٣ + ٢');
  assert.equal(reading.reason, 'ok');
  assert.equal((await readDocumentUsing(uri, 'text/plain', async () => { throw new Error('File no longer available'); })).reason, 'failed');
});
it('refuses oversized document bytes before parsing', async () => {
  assert.equal((await readDocumentUsing('blob:large', 'text/plain', async () => new Uint8Array(MAX_DOCUMENT_BYTES + 1))).reason, 'failed');
});
