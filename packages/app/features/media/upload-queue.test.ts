// The retry policy, the success channel, and reading back a queue an older
// build wrote. Pure by design, so all three are testable without a device —
// which matters because they only ever run on a bad network, in a background
// wake-up, or on the one launch after an upgrade.
// SOT-KEYWORDS: upload queue retry backoff test offline drain revive completed
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  abandoned,
  afterFailure,
  backoffMs,
  drainQueue,
  due,
  isDue,
  MAX_ATTEMPTS,
  reviveQueue,
  type CompletedUpload,
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

/*
  Read back the way the store reads it — `JSON.parse` then revive — because the
  bug this guards against is a shape difference between builds, and a hand-built
  object would be written by today's build and prove nothing.
*/
const persisted = (json: string): QueuedUpload[] =>
  reviveQueue(JSON.parse(json) as readonly Partial<QueuedUpload>[]);

describe('a queue persisted by an older build', () => {
  it('loads items that predate messageId and attachmentId', () => {
    const queue = persisted(
      '[{"id":"1","uri":"file://a.jpg","name":"a.jpg","mimeType":"image/jpeg","sessionId":"s","attempts":2,"lastAttemptAt":1000,"expiresAt":"2026-01-01T00:00:00.000Z"}]',
    );
    assert.equal(queue.length, 1);
    assert.equal(queue[0]?.sessionId, 's');
    assert.equal(queue[0]?.attempts, 2);
    assert.equal(queue[0]?.expiresAt, '2026-01-01T00:00:00.000Z');
    assert.equal(queue[0]?.messageId, undefined);
    assert.equal(queue[0]?.attachmentId, undefined);
  });

  it('starts an uncounted item at zero attempts rather than NaN', () => {
    const queue = persisted('[{"id":"1","uri":"file://a.jpg","name":"a.jpg","mimeType":"image/jpeg","sessionId":"s"}]');
    assert.equal(queue[0]?.attempts, 0);
    assert.equal(isDue(queue[0] ?? item()), true);
  });

  it('drops the one item that could never upload, not the photos beside it', () => {
    const queue = persisted(
      '[{"id":"1","sessionId":"s","attempts":0},{"id":"2","uri":"file://b.jpg","name":"b.jpg","mimeType":"image/jpeg","sessionId":"s","attempts":0}]',
    );
    assert.deepEqual(
      queue.map((q) => q.id),
      ['2'],
    );
  });

  it('refuses a stored value that was never a queue, so the store can drop it', () => {
    assert.throws(() => persisted('{"media-upload-queue":"nope"}'));
  });
});

const landed = (over: Partial<CompletedUpload> = {}): CompletedUpload => ({
  id: '1',
  sessionId: 's',
  url: 'https://cdn.example/org/a.jpg',
  storageKey: 'org/a.jpg',
  ...over,
});

/** Stands in for the store: holds the queue, applies the same transforms to it. */
function harness(initial: QueuedUpload[]) {
  let queue = initial;
  return {
    queue: () => queue,
    apply: (transform: (q: readonly QueuedUpload[]) => QueuedUpload[]) => {
      queue = transform(queue);
    },
  };
}

describe('the drain success channel', () => {
  it('reports where the bytes landed, not merely that they left', async () => {
    const store = harness([item()]);
    const seen: CompletedUpload[] = [];

    const completed = await drainQueue([item()], {
      upload: async () => landed(),
      apply: store.apply,
      onUploaded: (done) => seen.push(done),
    });

    assert.deepEqual(seen, [landed()]);
    assert.deepEqual(completed, [landed()]);
    assert.equal(seen[0]?.url, 'https://cdn.example/org/a.jpg');
    assert.equal(seen[0]?.storageKey, 'org/a.jpg');
  });

  it('addresses the completion to the attachment it came from', async () => {
    const queued = item({ id: 'q1', sessionId: 'sess', messageId: 'm1', attachmentId: 'a1' });
    const store = harness([queued]);
    const seen: CompletedUpload[] = [];

    await drainQueue([queued], {
      // Mirrors `uploadQueued`: the identifiers travel back out with the location.
      upload: async (i) => ({
        id: i.id,
        sessionId: i.sessionId,
        messageId: i.messageId,
        attachmentId: i.attachmentId,
        url: 'https://cdn.example/org/a.jpg',
        storageKey: 'org/a.jpg',
      }),
      apply: store.apply,
      onUploaded: (done) => seen.push(done),
    });

    assert.equal(seen[0]?.id, 'q1');
    assert.equal(seen[0]?.sessionId, 'sess');
    assert.equal(seen[0]?.messageId, 'm1');
    assert.equal(seen[0]?.attachmentId, 'a1');
  });

  it('deletes an item that landed', async () => {
    const store = harness([item()]);
    await drainQueue([item()], { upload: async () => landed(), apply: store.apply });
    assert.deepEqual(store.queue(), []);
  });

  it('drains with nobody listening rather than crashing', async () => {
    const store = harness([item()]);
    const completed = await drainQueue([item()], { upload: async () => landed(), apply: store.apply });
    assert.equal(completed.length, 1);
    assert.deepEqual(store.queue(), []);
  });

  it('keeps and counts a failed upload, and reports nothing for it', async () => {
    const store = harness([item()]);
    const seen: CompletedUpload[] = [];

    const completed = await drainQueue([item()], {
      upload: () => Promise.reject(new Error('offline')),
      apply: store.apply,
      onUploaded: (done) => seen.push(done),
    });

    assert.deepEqual(completed, []);
    assert.deepEqual(seen, []);
    assert.equal(store.queue().length, 1);
    assert.equal(store.queue()[0]?.attempts, 1);
    assert.equal(typeof store.queue()[0]?.lastAttemptAt, 'number');
  });

  it('does not re-upload the same bytes when the listener throws', async () => {
    const store = harness([item()]);
    let uploads = 0;

    const completed = await drainQueue([item()], {
      upload: async () => {
        uploads += 1;
        return landed();
      },
      apply: store.apply,
      onUploaded: () => {
        throw new Error('consumer blew up');
      },
    });

    assert.equal(uploads, 1);
    assert.deepEqual(completed, [landed()]);
    assert.deepEqual(store.queue(), [], 'a succeeded transfer stays succeeded');
  });

  it('leaves an item that is still backing off alone', async () => {
    const waiting = item({ attempts: 1, lastAttemptAt: 1_000 });
    const store = harness([waiting]);
    let uploads = 0;

    const completed = await drainQueue(
      [waiting],
      {
        upload: async () => {
          uploads += 1;
          return landed();
        },
        apply: store.apply,
      },
      1_500,
    );

    assert.equal(uploads, 0);
    assert.deepEqual(completed, []);
    assert.deepEqual(store.queue(), [waiting]);
  });
});
