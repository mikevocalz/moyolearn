// The retry policy. Pure by design, so it is testable without a device — which
// matters because the failure it guards against only happens on a bad network.
// SOT-KEYWORDS: upload queue retry backoff test offline
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  abandoned,
  afterFailure,
  backoffMs,
  due,
  isDue,
  MAX_ATTEMPTS,
  type QueuedUpload,
} from './upload-queue.shared.ts';

const item = (over: Partial<QueuedUpload> = {}): QueuedUpload => ({
  id: '1',
  uri: 'file://a.jpg',
  name: 'a.jpg',
  mimeType: 'image/jpeg',
  sessionId: 's',
  attempts: 0,
  ...over,
});

describe('the upload retry policy', () => {
  it('tries a fresh item immediately', () => {
    assert.equal(isDue(item()), true);
  });

  it('waits out the backoff after a failure', () => {
    const failed = afterFailure(item(), 1_000);
    assert.equal(isDue(failed, 1_500), false);
    assert.equal(isDue(failed, 1_000 + backoffMs(1)), true);
  });

  it('backs off exponentially rather than hammering a flapping network', () => {
    assert.equal(backoffMs(1), 2_000);
    assert.equal(backoffMs(2), 8_000);
    assert.equal(backoffMs(3), 32_000);
  });

  it('gives up, so a stuck upload is reported rather than retried forever', () => {
    const dead = item({ attempts: MAX_ATTEMPTS, lastAttemptAt: 0 });
    assert.equal(isDue(dead, Number.MAX_SAFE_INTEGER), false);
    assert.deepEqual(abandoned([dead]).length, 1);
  });

  it('never reports an abandoned item as due, however long it waits', () => {
    const dead = item({ attempts: MAX_ATTEMPTS, lastAttemptAt: 0 });
    assert.deepEqual(due([dead], Number.MAX_SAFE_INTEGER), []);
  });
});
