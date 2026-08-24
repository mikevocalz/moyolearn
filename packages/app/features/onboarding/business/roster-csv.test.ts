// The forgiving mapper, checked on the shapes real exports actually have. The
// load-bearing claim is "a bad row never costs you the good ones" — if that
// breaks, a business switching tools sees a rejected file and doesn't switch.
// SOT: docs/pack/06-auth-onboarding-spec.md §5
// SOT-KEYWORDS: onboarding business s24 csv test mapper rows quoted forgiving

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { guessMapping, importRoster, parseCsv } from './roster-csv.ts';

describe('parseCsv', () => {
  it('keeps commas inside quoted fields', () => {
    assert.deepEqual(parseCsv('a,"b,c",d'), [['a', 'b,c', 'd']]);
  });

  it('reads a doubled quote as one literal quote', () => {
    assert.deepEqual(parseCsv('"she said ""hi""",x'), [['she said "hi"', 'x']]);
  });

  it('handles CRLF and a trailing newline without inventing a row', () => {
    assert.deepEqual(parseCsv('a,b\r\nc,d\r\n'), [
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});

describe('guessMapping', () => {
  it('matches through punctuation and casing', () => {
    assert.deepEqual(guessMapping(['Student Name', 'Parent E-Mail', 'Grade Level']), [
      'learnerName',
      'guardianEmail',
      'grade',
    ]);
  });

  it('does not map two columns to the same role', () => {
    const mapping = guessMapping(['Name', 'Student Name']);
    assert.equal(mapping.filter((r) => r === 'learnerName').length, 1);
  });

  it('ignores columns it does not recognise rather than failing', () => {
    assert.deepEqual(guessMapping(['Student', 'Balance Owing']), ['learnerName', 'ignore']);
  });
});

describe('importRoster', () => {
  const csv = [
    'Student,Parent Email,Grade,Notes',
    'Maya R,ada@example.com,5,likes fractions',
    ',bad@example.com,4,',
    'Sam T,not-an-email,6,',
    'Jo P,jo@example.com,7,',
  ].join('\n');

  it('imports the good rows and names the bad ones by spreadsheet line', () => {
    const result = importRoster(csv);
    assert.equal(result.rows.length, 4);
    assert.equal(result.ready, 2);
    // Header is line 1, so the two broken rows are 3 and 4 in the operator's file.
    assert.deepEqual(result.problemLines, [3, 4]);
  });

  it('says what is wrong per row, not once for the file', () => {
    const result = importRoster(csv);
    assert.deepEqual(result.rows[1]?.problems, ['No student name']);
    assert.deepEqual(result.rows[2]?.problems, ['Guardian email looks wrong']);
  });

  it('re-reads under a corrected mapping', () => {
    // An export whose header says "Contact" for the guardian's email.
    const odd = 'Student,Contact\nMaya R,ada@example.com';
    assert.equal(importRoster(odd).ready, 0);
    assert.equal(importRoster(odd, ['learnerName', 'guardianEmail']).ready, 1);
  });

  it('survives a file with no rows at all', () => {
    const empty = importRoster('Student,Parent Email');
    assert.equal(empty.rows.length, 0);
    assert.equal(empty.ready, 0);
  });
});
