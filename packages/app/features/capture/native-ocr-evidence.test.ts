// Verify native evidence semantics without invoking mobile runtime or model downloads.
// SOT: ./native-ocr-evidence.ts
// SOT-KEYWORDS: native ocr evidence test confidence geometry cancellation failure
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createNativeOcrReader, nativeOcrEvidence } from './native-ocr-evidence.ts';

const detection = (text = '2 + 2 = 5', score = 0.75) => ({
  text, score, bbox: { x1: 10, y1: 20, x2: 100, y2: 40 },
});

it('preserves source mistakes, detector geometry and score granularity', () => {
  const input = [detection(), { ...detection('Yo tieno dos hermanos', 0.9), bbox: { x1: 10, y1: 50, x2: 200, y2: 70 } }];
  const result = nativeOcrEvidence('file:///source.png', input);
  assert.equal(result.text, '2 + 2 = 5\nYo tieno dos hermanos');
  assert.deepEqual(result.detections, input);
  assert.equal(result.confidence, 75);
  assert.equal(result.scoreGranularity, 'detection');
  assert.equal(result.masterTransform, 'unverified');
  assert.equal(result.requiresSourceCheck, true);
  input[0]!.bbox.x1 = 999;
  assert.equal(result.detections[0]!.bbox.x1, 10);
});

it('retains invalid geometry and invalid scores without manufacturing certainty', () => {
  const result = nativeOcrEvidence('file:///source.png', [
    { ...detection('−3²', Number.NaN), bbox: { x1: -1, y1: 2, x2: 0, y2: 1 } },
  ]);
  assert.equal(result.geometryValid, false);
  assert.equal(result.confidence, undefined);
  assert.equal(result.text, '−3²');
  assert.equal(result.detections[0]!.bbox.x1, -1);
  assert.equal(result.requiresSourceCheck, true);
  assert.equal(nativeOcrEvidence('empty', []).status, 'empty');
  assert.equal(nativeOcrEvidence('empty', []).confidence, undefined);
});

it('does not load an unavailable runtime and preserves explicit unsupported status', async () => {
  const read = createNativeOcrReader(async () => { throw new Error('Must not load'); }, () => false);
  const result = await read('file:///source.png');
  assert.equal(result.status, 'unsupported');
  assert.equal(result.reason, 'unsupported');
});

it('serializes reads and advances after a failed source', async () => {
  let concurrent = 0;
  let peak = 0;
  const read = createNativeOcrReader(async () => ({
    async forward(uri) {
      concurrent++;
      peak = Math.max(peak, concurrent);
      await Promise.resolve();
      concurrent--;
      if (uri === 'broken') throw new Error('Decode failed');
      return [detection(uri)];
    },
  }), () => true);
  const results = await Promise.all(['first', 'broken', 'last'].map((source) => read(source)));
  assert.equal(peak, 1);
  assert.deepEqual(results.map(({ status }) => status), ['recognized', 'failed', 'recognized']);
  assert.equal(results[2]!.text, 'last');
});

it('discards an in-flight read and skips a cancelled queued source', async () => {
  function deferred() {
    let resolve: () => void = () => {};
    const promise = new Promise<void>((done) => { resolve = done; });
    return { promise, resolve };
  }
  const started = deferred();
  const finish = deferred();
  const activeAbort = new AbortController();
  const queuedAbort = new AbortController();
  const calls: string[] = [];
  const read = createNativeOcrReader(async () => ({
    async forward(source) {
      calls.push(source);
      if (source === 'active') {
        started.resolve();
        await finish.promise;
      }
      return [detection(source)];
    },
  }), () => true);
  const active = read('active', activeAbort.signal);
  await started.promise;
  const queued = read('queued', queuedAbort.signal);
  activeAbort.abort();
  queuedAbort.abort();
  finish.resolve();
  assert.equal((await active).status, 'cancelled');
  assert.equal((await queued).status, 'cancelled');
  assert.deepEqual(calls, ['active']);
  assert.equal((await read('fresh')).text, 'fresh');
});
