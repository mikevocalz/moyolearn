// The sign-in return path is client input; these hold the open-redirect gate
// (PR #157 review: alert destination lost after sign-in).
// SOT-KEYWORDS: return path test open redirect login next alerts
import assert from 'node:assert/strict';
import test from 'node:test';
import { safeReturnPath } from './return-path.ts';

test('keeps a same-origin path with its query and fragment', () => {
  assert.equal(safeReturnPath('/alerts'), '/alerts');
  assert.equal(safeReturnPath('/alerts?incident=abc#top'), '/alerts?incident=abc#top');
  assert.equal(safeReturnPath('/children/ada_1/homework'), '/children/ada_1/homework');
});

test('refuses anything that could leave the origin', () => {
  for (const raw of [
    'https://evil.test/alerts',
    '//evil.test/alerts',
    '/\\evil.test',
    '\\\\evil.test',
    '/alerts\\..\\..',
    'javascript:alert(1)',
    'alerts',
    ' /alerts',
    '/\talerts',
    '/%0d%0aSet-Cookie:x',
  ]) {
    const out = safeReturnPath(raw);
    if (out !== null) {
      // An encoded CR/LF stays encoded inside the path, which is harmless; it
      // must never come back as a different origin.
      assert.equal(new URL(out, 'https://app.test').origin, 'https://app.test', raw);
    }
  }
  assert.equal(safeReturnPath('https://evil.test/alerts'), null);
  assert.equal(safeReturnPath('//evil.test/alerts'), null);
  assert.equal(safeReturnPath('/\\evil.test'), null);
  assert.equal(safeReturnPath('javascript:alert(1)'), null);
  assert.equal(safeReturnPath('alerts'), null);
  assert.equal(safeReturnPath('/\talerts'), null);
});

test('refuses empty, missing, a login loop and API paths', () => {
  assert.equal(safeReturnPath(undefined), null);
  assert.equal(safeReturnPath(null), null);
  assert.equal(safeReturnPath(''), null);
  assert.equal(safeReturnPath('/login'), null);
  assert.equal(safeReturnPath('/login/riverside'), null);
  assert.equal(safeReturnPath('/api/tutor/coach'), null);
  assert.equal(safeReturnPath('/' + 'a'.repeat(4096)), null);
});
