// The media window. A child's photograph and their recorded voice are the most
// sensitive things this product holds, so the rule that removes them is tested
// rather than assumed.
// SOT-KEYWORDS: media retention ttl expiry test privacy child
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { expiredKeys, isMediaExpired, mediaExpiry, MEDIA_TTL_DAYS } from './retention.ts';

const NOW = new Date('2026-01-10T00:00:00.000Z');

describe('media retention', () => {
  it('is one week — shorter than the transcript that quotes it', () => {
    assert.equal(MEDIA_TTL_DAYS, 7);
  });

  it('expires exactly a week out', () => {
    assert.equal(mediaExpiry(NOW), '2026-01-17T00:00:00.000Z');
  });

  it('treats the boundary as expired rather than alive', () => {
    assert.equal(isMediaExpired('2026-01-10T00:00:00.000Z', NOW), true);
    assert.equal(isMediaExpired('2026-01-10T00:00:01.000Z', NOW), false);
  });

  it('never expires an item with no window, rather than guessing one', () => {
    assert.equal(isMediaExpired(undefined, NOW), false);
  });

  it('collects only expired items that actually have something to delete', () => {
    const keys = expiredKeys(
      [
        { storageKey: 'a.jpg', expiresAt: '2026-01-01T00:00:00.000Z' },
        { storageKey: 'b.jpg', expiresAt: '2026-02-01T00:00:00.000Z' },
        { expiresAt: '2026-01-01T00:00:00.000Z' },
        { storageKey: 'd.jpg' },
      ],
      NOW,
    );
    assert.deepEqual(keys, ['a.jpg']);
  });
});
