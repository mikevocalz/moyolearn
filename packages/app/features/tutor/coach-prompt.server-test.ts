// What the coaching turn tells the model about a problem it did not type.
//
// The bug behind this file: `OCR_ENGLISH`'s recogniser charset has no `÷` and
// no `×`, so a photographed division problem reaches the coach as `12 : 4`,
// `12 + 4`, or a gap — and it coached the wrong operation, confidently, with
// the child's own worksheet on screen beside it. Rewriting the suspect
// character was rejected: `+`, `-` and `:` are all legitimate arithmetic, so a
// repair pass corrupts the problems the recogniser got right.
//
// So the fix is two sentences of prompt, and these are the assertions on them.
// A `.server-test` because `coach.service` is `server-only`.
// SOT: packages/app/features/tutor/coach.service.ts · packages/app/features/capture/photograph-for-model.ts
// SOT-KEYWORDS: coach prompt reading caveat ocr operators photograph turn text
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readingCaveat } from './coach.service.ts';

const problem = { problem: '12 : 4', message: '' };
const photo = { mediaType: 'image/jpeg' as const, data: 'QUJD' };

describe('what the coach is told about an OCR reading', () => {
  it('says nothing at all about a problem nobody photographed', () => {
    // The default has to be silence. A caveat on a served practice problem
    // teaches the model to doubt text that is exactly right.
    assert.equal(readingCaveat(problem), '');
    assert.equal(readingCaveat({ ...problem, image: photo }), '');
  });

  it('names the operators as the lossy part, not the digits', () => {
    const caveat = readingCaveat({ ...problem, problemIsReading: true });

    // "may contain errors" would invite doubt about the numbers, which is the
    // part the recogniser is good at. The charset gap is the part it is not.
    assert.match(caveat, /÷/);
    assert.match(caveat, /×/);
  });

  it('tells a photographed turn to read the page and trust it over the text', () => {
    const caveat = readingCaveat({ ...problem, problemIsReading: true, image: photo });

    assert.match(caveat, /photograph is attached/);
    assert.match(caveat, /trust it over the text/);
  });

  it('tells an unphotographed reading to ask the child instead', () => {
    // The turn after the photo has no pixels — every coaching call is one
    // system half and one message, with no history — so the only move left is
    // the one a tutor would make anyway.
    const caveat = readingCaveat({ ...problem, problemIsReading: true });

    assert.match(caveat, /ask the student/);
    assert.doesNotMatch(caveat, /photograph is attached/);
  });
});
