// The two decisions that made a failed read render as a blank page and as good
// news, pinned where they are now made.
//
// Both were invisible before because both were the ABSENCE of a decision: a
// blanket `retry: 2` treated every failure as transient, and `new Error("HTTP
// 401")` threw the status away so nothing downstream could tell a settled
// refusal from a hiccup, or a missing row from a broken read. The regressions
// are silent and they are the exact bugs that were shipped, so they get a test
// rather than a comment.
// SOT: packages/app/core/api-fetch.ts · packages/app/core/read-failure-copy.ts
// SOT-KEYWORDS: api fetch test retry predicate status not found unauthenticated read failure copy
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApiError, isNotFound, isRetryableError, isUnauthenticated } from './api-fetch.ts';
import { readFailureCopy } from './read-failure-copy.ts';

describe('what a retry can and cannot fix', () => {
  it('does not retry the refusals that never come good', () => {
    // The shipped bug: each of these spent the full backoff in `pending`, and a
    // pending screen draws a skeleton — so a settled answer rendered as a blank
    // page for seconds before its honest error branch ever ran.
    for (const status of [400, 401, 403, 404, 422]) {
      assert.equal(isRetryableError(new ApiError(status)), false, `retried ${String(status)}`);
    }
  });

  it('retries the two 4xx that a retry does fix, and every 5xx', () => {
    for (const status of [408, 429, 500, 502, 503]) {
      assert.equal(isRetryableError(new ApiError(status)), true, `gave up on ${String(status)}`);
    }
  });

  it('retries a failure with no status at all', () => {
    // Offline, DNS, an aborted socket — the case retries exist for. Anything
    // not yet moved onto `getJson` also lands here, so nothing regressed by
    // being left alone.
    assert.equal(isRetryableError(new Error('Failed to fetch')), true);
    assert.equal(isRetryableError(undefined), true);
  });
});

describe('telling failures apart', () => {
  it('separates a missing row from a broken read', () => {
    assert.equal(isNotFound(new ApiError(404)), true);
    assert.equal(isNotFound(new ApiError(500)), false);
    // A bare Error carries no status, so it can never claim to be a 404 — that
    // is what stops a failed read wearing the not-found sentence.
    assert.equal(isNotFound(new Error('HTTP 404')), false);
  });

  it('separates an ended session from everything else', () => {
    assert.equal(isUnauthenticated(new ApiError(401)), true);
    // 403 is "signed in, not yours" — signing in again changes nothing, so it
    // must not offer the sign-in exit.
    assert.equal(isUnauthenticated(new ApiError(403)), false);
  });
});

describe('what the screen says', () => {
  it('offers signing in, not retrying, when the session ended', () => {
    const copy = readFailureCopy(new ApiError(401), 'your alerts', 'Nothing changed.');
    assert.equal(copy.signedOut, true);
    assert.match(copy.description, /Sign in again to see your alerts\./);
  });

  it('names the failure and keeps the reassurance for every other cause', () => {
    const copy = readFailureCopy(new ApiError(500), 'your reports', 'Nothing changed.');
    assert.equal(copy.signedOut, false);
    assert.equal(copy.title, 'We couldn’t load your reports');
    // The reassurance is never dropped: on a family surface a bare "error" is
    // read as bad news about a child.
    assert.match(copy.description, /^Nothing changed\./);
  });
});
