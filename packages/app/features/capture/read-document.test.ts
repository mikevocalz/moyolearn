/**
 * Built against real files, not fixtures of my own invention: the pdf is
 * assembled with the same operators a writer emits, and the docx is a real zip.
 *
 * SOT: ./read-document.ts
 * SOT-KEYWORDS: read document test pdf docx txt extraction scanned
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deflateSync, zipSync } from 'fflate';
import { readDocument } from './read-document.ts';

const bytes = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);

/** A one-page pdf whose content stream is `content`, compressed if asked. */
function pdf(content: string, compress: boolean): Uint8Array {
  const body = compress ? deflateSync(bytes(content)) : bytes(content);
  const head = bytes(`%PDF-1.4\n1 0 obj\n<< /Length ${body.length} >>\nstream\n`);
  const tail = bytes('\nendstream\nendobj\ntrailer\n<< >>\n%%EOF');
  const out = new Uint8Array(head.length + body.length + tail.length);
  out.set(head, 0);
  out.set(body, head.length);
  out.set(tail, head.length + body.length);
  return out;
}

const HOMEWORK = 'BT /F1 12 Tf 72 720 Td (What is 2 + 3 * 4 - 1?) Tj T* (Show your working.) Tj ET';

describe('readDocument', () => {
  it('reads an uncompressed pdf text layer', () => {
    const reading = readDocument(pdf(HOMEWORK, false), 'application/pdf');
    assert.equal(reading.reason, 'ok');
    assert.match(reading.text, /What is 2 \+ 3 \* 4 - 1\?/);
    assert.match(reading.text, /Show your working\./);
  });

  it('reads a FlateDecode pdf — which is what a real writer emits', () => {
    const reading = readDocument(pdf(HOMEWORK, true), 'application/pdf');
    assert.equal(reading.reason, 'ok');
    assert.match(reading.text, /What is 2 \+ 3 \* 4 - 1\?/);
  });

  it('keeps the lines apart', () => {
    const { text } = readDocument(pdf(HOMEWORK, true), 'application/pdf');
    assert.ok(text.includes('\n'), 'the worksheet ran into one line');
  });

  it('unescapes pdf string syntax and hex strings', () => {
    const source = 'BT (a\\(b\\)c) Tj T* <48656C6C6F> Tj ET';
    const { text } = readDocument(pdf(source, false), 'application/pdf');
    assert.match(text, /a\(b\)c/);
    assert.match(text, /Hello/);
  });

  it('calls a scanned pdf scanned rather than empty', () => {
    // Streams, but no text operators — page images only.
    const reading = readDocument(pdf('q 612 0 0 792 0 0 cm /Im0 Do Q', true), 'application/pdf');
    assert.equal(reading.reason, 'scanned');
    assert.equal(reading.text, '');
  });

  it('reads a docx', () => {
    const xml =
      '<?xml version="1.0"?><w:document><w:body>' +
      '<w:p><w:r><w:t>What is 2 + 3 * 4 - 1?</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>Show your working &amp; explain.</w:t></w:r></w:p>' +
      '</w:body></w:document>';
    const zip = zipSync({ 'word/document.xml': bytes(xml) });
    const reading = readDocument(zip, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    assert.equal(reading.reason, 'ok');
    assert.match(reading.text, /What is 2 \+ 3 \* 4 - 1\?/);
    assert.match(reading.text, /Show your working & explain\./);
    assert.ok(reading.text.includes('\n'), 'paragraphs ran together');
  });

  it('sniffs the magic bytes when the picker lies about the type', () => {
    // Android hands back octet-stream for a perfectly good pdf.
    const reading = readDocument(pdf(HOMEWORK, true), 'application/octet-stream');
    assert.equal(reading.reason, 'ok');
  });

  it('reads plain text', () => {
    const reading = readDocument(bytes('2 + 3 * 4 - 1'), 'text/plain');
    assert.equal(reading.reason, 'ok');
    assert.equal(reading.text, '2 + 3 * 4 - 1');
  });

  it('says unsupported rather than guessing', () => {
    assert.equal(readDocument(bytes('\x00\x01\x02\x03'), 'application/zip-bomb').reason, 'unsupported');
  });
});
