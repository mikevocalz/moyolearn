/**
 * Synthetic format fixtures exercise parsing and source-preservation boundaries.
 * These do not substitute for a corpus of real teacher-authored documents.
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
      '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
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

// Non-ASCII bytes must survive before any tutoring or interpretation happens.
it('preserves multilingual UTF-8 and student errors in text and DOCX', () => {
  for (const source of ['¿Cuántos lápices? 12 ÷ 4', 'حل ٣ + ٢', 'اردو', 'Yo tieno dos hermanos.', '2 + 2 = 5', '(-3)²']) {
    const utf8 = new TextEncoder().encode(source);
    assert.equal(readDocument(utf8, 'text/plain').text, source);
    const xml = new TextEncoder().encode(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${source}</w:t></w:r></w:p></w:body></w:document>`);
    assert.equal(readDocument(zipSync({ 'word/document.xml': xml })).text, source);
  }
});

const wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const mathNamespace = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
function docx(body: string) {
  return zipSync({ 'word/document.xml': new TextEncoder().encode(`<x:document xmlns:x="${wordNamespace}" xmlns:m="${mathNamespace}"><x:body>${body}</x:body></x:document>`) });
}
it('preserves table cells, numeric text, entities, tabs and intentional spaces', () => {
  const source = docx('<x:p><x:r><x:t xml:space="preserve">001  + </x:t><x:tab/><x:t>&#x663; &amp; 2</x:t></x:r></x:p><x:tbl><x:tr><x:tc><x:p><x:r><x:t>A</x:t></x:r></x:p></x:tc><x:tc><x:p><x:r><x:t>B</x:t></x:r></x:p></x:tc></x:tr></x:tbl>');
  assert.equal(readDocument(source).text, '001  + \t٣ & 2\nA\tB');
});
it('keeps fractions and exponents distinct from adjacent digits', () => {
  const source = docx('<x:p><m:oMath><m:f><m:num><m:r><m:t>1</m:t></m:r></m:num><m:den><m:r><m:t>2</m:t></m:r></m:den></m:f><m:r><m:t> + </m:t></m:r><m:sSup><m:e><m:r><m:t>x</m:t></m:r></m:e><m:sup><m:r><m:t>2</m:t></m:r></m:sup></m:sSup></m:oMath></x:p>');
  assert.equal(readDocument(source).text, '(1)/(2) + (x)^(2)');
});
it('marks embedded and unsupported equation content rather than dropping it', () => {
  const reading = readDocument(docx('<x:p><x:drawing/><m:oMath><m:m><m:mr/></m:m></m:oMath></x:p>'));
  assert.match(reading.text, /Embedded content requires source review/);
  assert.match(reading.text, /Equation structure requires source review/);
});
it('rejects malformed XML and DTDs', () => {
  for (const xml of ['<x:document>', '<!DOCTYPE x [<!ENTITY e "bad">]><x/>']) {
    assert.equal(readDocument(zipSync({ 'word/document.xml': new TextEncoder().encode(xml) })).reason, 'failed');
  }
});
it('resolves the package main document relationship without fetching external targets', () => {
  const rel = (target: string, mode = '') => new TextEncoder().encode(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="${target}" ${mode}/></Relationships>`);
  const xml = new TextEncoder().encode(`<x:document xmlns:x="${wordNamespace}"><x:body><x:p><x:r><x:t>2 + 2 = 5</x:t></x:r></x:p></x:body></x:document>`);
  assert.equal(readDocument(zipSync({ '_rels/.rels': rel('custom/main.xml'), 'custom/main.xml': xml })).text, '2 + 2 = 5');
  assert.equal(readDocument(zipSync({ '_rels/.rels': rel('https://example.com/main.xml', 'TargetMode="External"') })).reason, 'failed');
});
it('retains equation XML alongside its readable projection', () => {
  const reading = readDocument(docx('<x:p><m:oMath><m:r><m:t>x</m:t></m:r></m:oMath></x:p>'));
  assert.equal(reading.equations?.[0]?.text, 'x');
  assert.match(reading.equations?.[0]?.sourceXml ?? '', /<m:t>x<\/m:t>/);
});
it('flags tracked changes, fields, and automatic numbering for source review', () => {
  const reading = readDocument(docx('<x:p><x:pPr><x:numPr/></x:pPr><x:ins><x:r><x:t>wrong</x:t></x:r></x:ins><x:del/><x:fldSimple x:instr="DATE"/><x:footnoteReference x:id="1"/></x:p>'));
  for (const phrase of ['List numbering', 'Tracked insertion', 'Tracked deletion', 'Document field', 'Referenced content']) assert.ok(reading.text.includes(phrase));
});
it('does not collapse indentation, blank lines, or student spacing in plain text', () => {
  const source = '  12\n+  3\n\n  14  \n';
  assert.equal(readDocument(new TextEncoder().encode(source), 'text/plain').text, source);
});
