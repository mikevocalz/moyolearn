// Doc 36 §2: the handoff code is a spoken-aloud, single-use credential. The
// properties a leak or a typo would exploit get tests: alphabet legibility,
// hash/secret domain separation, and normalization on the child's side.
// SOT: docs/pack/36-role-navigation-flows.md §2
// SOT-KEYWORDS: test handoff code alphabet normalize hash secret

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HANDOFF_CODE_LENGTH,
  generateHandoffCode,
  handoffSecret,
  handoffUrl,
  hashHandoffCode,
  isWellFormedHandoffCode,
  normalizeHandoffCode,
} from './handoff.ts';

test('codes never contain the glyphs that fail across a room', () => {
  for (let i = 0; i < 50; i++) {
    const code = generateHandoffCode();
    assert.equal(code.length, HANDOFF_CODE_LENGTH);
    assert.doesNotMatch(code, /[ILO01]/);
  }
});

test('a child typing lowercase with spaces still redeems', () => {
  assert.equal(normalizeHandoffCode(' ab c-d2f '), 'ABCD2F');
  assert.ok(isWellFormedHandoffCode('abcd2f'));
  assert.equal(hashHandoffCode('abcd2f'), hashHandoffCode('AB CD-2F'));
});

test('malformed input is refused before any lookup', () => {
  assert.equal(isWellFormedHandoffCode(''), false);
  assert.equal(isWellFormedHandoffCode('ABC'), false);
  assert.equal(isWellFormedHandoffCode('ABCD10'), false); // 1 and 0 are not in the alphabet
});

test('the stored hash can never be replayed as the credential', () => {
  const code = generateHandoffCode();
  assert.notEqual(hashHandoffCode(code), handoffSecret(code));
});

test('the QR payload carries the normalized code', () => {
  assert.equal(handoffUrl('ab-c d2f'), 'moyo://handoff?code=ABCD2F');
});
