import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateCapture, sessionMetadata, freshEnvelope, evaluationExpression, CAPTURE_PACKAGE } from './live-telemetry-policy.mjs';
import { runBridge, validateConfig } from './live-telemetry-bridge.mjs';

const mapHex = readFileSync(new URL('./fixtures/muse-report-map.hex', import.meta.url), 'utf8').trim();
const nonce = 'unit_test_nonce_123456';
const arm = 100000;
const sample = (sampleIndex, wallTimeMs = 100100) => ({ sampleIndex, wallTimeMs, elapsedPollingMs: wallTimeMs - 100050,
  gattStatus: 0, byteLength: 65, rawHex: '00'.repeat(65) });
function fixture(samples = [sample(0)]) {
  return { schemaVersion: 1, testOnly: true, productionAccess: false, inputProducer: false, package: CAPTURE_PACKAGE,
    wallTimeMs: 100001, matchingBondedDeviceCount: 1, bondState: 12, connectionStatus: 0, discoveryStatus: 0,
    pollingReady: true, pollingStartWallTimeMs: 100050, plannedPollingWindowMs: 25000, maxSamples: 100, maxRateHz: 4,
    reportMaps: [{ gattStatus: 0, byteLength: 457, rawHex: mapHex, serviceInstanceId: 44 }],
    reportReferences: ['0201', '0203'].map((rawHex) => ({ gattStatus: 0, byteLength: 2, rawHex, serviceInstanceId: 44 })),
    feature2: { gattStatus: 0, byteLength: 8, rawHex: '00'.repeat(8) }, samples };
}
const config = { deviceId: 'test-only-device', port: 8081, metaCliPath: '/never/executed/metavr', argentPath: '/never/executed/argent',
  installedCollectorApkPath: '/never/read/apk', armTimeMs: arm, sessionId: nonce, controllerExpression: 'unitController' };

test('faster motion polling forwards new samples once and keeps its rate bounded', async () => {
  for (const pollingIntervalMs of [0, 249, 1001, 250.5, '250']) {
    assert.throws(() => validateConfig({ ...config, pollingIntervalMs }), /pollingIntervalMs/);
  }
  let now = 100100, reads = 0;
  const delivered = [], sleeps = [];
  const snapshots = [fixture(), fixture(), { ...fixture([sample(0), sample(1, 100600)]), completed: true }];
  const result = await runBridge({ ...config, pollingIntervalMs: 250 }, {
    monotonicNow: () => now - 100100, wallNow: () => now,
    sleep: async (duration) => { sleeps.push(duration); now += duration; }, log() {},
    readCapture: async () => JSON.stringify(snapshots[reads++]),
    evaluate: async (method, payload) => {
      if (method === 'ingestCapture') delivered.push(...payload.samples.map((s) => s.sequence));
      return method === 'probe' ? { ready: true, now } : { accepted: true, now };
    },
  });
  assert.deepEqual(sleeps, [250, 250]);
  assert.deepEqual(delivered, [0, 1]);
  assert.equal(result.reason, 'collector-completed');
  assert.equal(result.gapCount, 0);
});

test('valid actual-map/reference schema yields opaque telemetry only', () => {
  const c = fixture(); const v = validateCapture(c, arm, 100200); const m = sessionMetadata(c, nonce, arm, 100200);
  const next = freshEnvelope(v, m, { lastObservedSequence: -1, gapCount: 0 }, 100200);
  assert.equal(next.envelope.samples.length, 1);
  assert.equal(next.envelope.samples[0].rawHex, '00'.repeat(65));
  assert.equal(Object.hasOwn(next.envelope, 'position'), false);
  assert.equal(Object.hasOwn(next.envelope, 'ready'), false);
});

test('wrong map/ref/service/status/length/timestamps fail before forwarding', () => {
  const mutations = [
    (c) => { c.reportMaps[0].rawHex = '00'.repeat(457); },
    (c) => { c.reportReferences[0].rawHex = '0301'; },
    (c) => { c.reportReferences[0].serviceInstanceId = 99; },
    (c) => { c.samples[0].gattStatus = 133; },
    (c) => { c.samples[0].rawHex = '00'; },
    (c) => { c.samples[0].elapsedPollingMs = 1000; },
    (c) => { c.samples[0].wallTimeMs = 200000; },
  ];
  for (const mutate of mutations) { const c = fixture(); mutate(c); assert.throws(() => validateCapture(c, arm, 100200)); }
});

test('old private receipts wait; completed/stale captures cannot start LIVE', () => {
  const old = fixture(); old.wallTimeMs = arm - 1;
  assert.equal(validateCapture(old, arm, 100200).kind, 'waiting');
  const complete = fixture(); complete.completed = true;
  assert.throws(() => sessionMetadata(complete, nonce, arm, 100200), /Completed/);
  assert.throws(() => sessionMetadata(fixture(), nonce, arm, 104000), /fresh/);
});

test('stale samples are omitted and counted once; cumulative snapshots do not replay', () => {
  const c = fixture([sample(0), sample(1, 103000)]);
  const m = sessionMetadata(fixture(), nonce, arm, 100200);
  const v = validateCapture(c, arm, 104000);
  const first = freshEnvelope(v, m, { lastObservedSequence: -1, gapCount: 0 }, 104000);
  assert.deepEqual(first.envelope.samples.map((s) => s.sequence), [1]);
  assert.equal(first.envelope.gapCount, 1);
  const repeated = freshEnvelope(v, m, first.cursor, 104100);
  assert.equal(repeated.envelope.samples.length, 0); assert.equal(repeated.envelope.gapCount, 1);
});

test('duplicate/reordered source sequence and untrusted device ids are rejected', () => {
  assert.throws(() => validateCapture(fixture([sample(1), sample(0)]), arm, 100200));
  assert.throws(() => validateConfig({ ...config, deviceId: 'x; touch /tmp/bad' }));
  assert.throws(() => evaluationExpression('unitController', 'verifyNativeInput', {}));
  const expression = evaluationExpression('unitController', 'startSession', { value: '";globalThis.injected=true;//' });
  const result = Function('unitController', `return ${expression}`)({ startSession: () => true, ingestCapture() {}, finishSession() {}, state: {getState: () => ({})} });
  assert.equal(result.accepted, true); assert.equal(globalThis.injected, undefined);
});

test('finite mock bridge forwards once, then finishes without any device IO', async () => {
  let now = 100100, reads = 0;
  const calls = [];
  const snapshots = [fixture(), { ...fixture([sample(0), sample(1, 101000)]), completed: true }];
  const result = await runBridge(config, {
    monotonicNow: () => now - 100100, wallNow: () => now,
    sleep: async (ms) => { now += ms; }, log() {},
    readCapture: async () => JSON.stringify(snapshots[Math.min(reads++, 1)]),
    evaluate: async (method, payload) => { calls.push({ method, payload }); return method === 'probe' ? { ready: true, now } : { accepted: true, now }; },
  });
  assert.equal(result.totalForwarded, 2);
  assert.deepEqual(calls.map((c) => c.method), ['probe', 'startSession', 'ingestCapture', 'ingestCapture', 'finishSession']);
  assert.equal(calls.some((c) => /ready|pointer|ink|verifyNativeInput/i.test(c.method)), false);
});

test('viewer rejection terminates once and still attempts finite cleanup', async () => {
  const calls = [];
  await assert.rejects(runBridge(config, {
    monotonicNow: () => 0, wallNow: () => 100100, sleep: async () => {}, log() {},
    readCapture: async () => JSON.stringify(fixture()),
    evaluate: async (method) => { calls.push(method); return method === 'probe' ? { ready: true, now: 100100 } : { accepted: method !== 'ingestCapture', now: 100100 }; },
  }), /rejected/);
  assert.equal(calls.filter((m) => m === 'ingestCapture').length, 1);
  assert.equal(calls.at(-1), 'finishSession');
});

test('owned hung child is terminated after bounded grace without touching services', async () => {
  const { processResult } = await import('./live-telemetry-bridge.mjs');
  const started = performance.now();
  await assert.rejects(processResult(process.execPath,
    ['-e', 'process.on("SIGTERM",()=>{});setInterval(()=>{},1000)'], undefined, 150), /deadline/);
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.ok(performance.now() - started < 1500);
});

test('owned subprocess output cap stops buffering and terminates only that child', async () => {
  const { processResult } = await import('./live-telemetry-bridge.mjs');
  await assert.rejects(processResult(process.execPath,
    ['-e', 'process.on("SIGTERM",()=>{});setInterval(()=>process.stdout.write("x".repeat(65536)),1)'], undefined, 2000), /output limit/);
  await new Promise((resolve) => setTimeout(resolve, 300));
});

test('fresh completed final snapshot after25s is forwarded before completion', async () => {
  let now = 100100, reads = 0, phase = 'idle';
  const sent = [];
  const finalSamples = Array.from({ length: 100 }, (_, i) => sample(i, i === 99 ? 125450 : 100100 + i * 250));
  const snapshots = [fixture(), { ...fixture(finalSamples), completed: true }];
  const result = await runBridge(config, {
    monotonicNow: () => now - 100100, wallNow: () => now,
    sleep: async () => { now = 125550; }, log() {},
    readCapture: async () => JSON.stringify(snapshots[Math.min(reads++, 1)]),
    evaluate: async (method, payload) => {
      if (method === 'probe') return { ready: true, now };
      if (method === 'startSession') phase = 'live';
      if (method === 'ingestCapture') sent.push(...payload.samples);
      if (method === 'finishSession') phase = 'completed';
      return { accepted: true, now };
    },
  });
  assert.equal(sent.at(-1).sequence, 99);
  assert.equal(sent.at(-1).wallTimeMs, 125450);
  assert.equal(result.reason, 'collector-completed'); assert.equal(phase, 'completed');
  assert.ok(result.gapCount > 0, 'simulated host stall must retain stale-sample gaps');
});

test('exact global expiry is unavailable and never forwarded as a fresh sample', () => {
  const m = sessionMetadata(fixture(), nonce, arm, 100200);
  assert.equal(m.expiresAtWallTimeMs, fixture().wallTimeMs + 40000);
  const c = fixture([sample(0, m.expiresAtWallTimeMs)]);
  const v = validateCapture(c, arm, m.expiresAtWallTimeMs);
  const next = freshEnvelope(v, m, { lastObservedSequence: -1, gapCount: 0 }, m.expiresAtWallTimeMs);
  assert.equal(next.envelope.samples.length, 0); assert.equal(next.envelope.gapCount, 1);
});

test('capture replacement cannot silently enter an already-started session', async () => {
  let now = 100100, reads = 0;
  const changed = fixture([]); changed.pollingStartWallTimeMs = 100250;
  await assert.rejects(runBridge(config, {
    monotonicNow: () => now - 100100, wallNow: () => now,
    sleep: async (ms) => { now += ms; }, log() {},
    readCapture: async () => JSON.stringify(reads++ === 0 ? fixture() : changed),
    evaluate: async (method) => method === 'probe' ? { ready: true, now } : { accepted: true, now },
  }), /run changed/);
});

test('14s pre-capture arm lead does not expire the actual25.5s final snapshot', async () => {
  let now = 114600, reads = 0, phase = 'idle';
  const sent = [], journal = [];
  const first = fixture([]); first.wallTimeMs = 114000; first.pollingStartWallTimeMs = 114500;
  first.samples = [sample(0, 114600)]; first.samples[0].elapsedPollingMs = 100;
  const final = structuredClone(first);
  final.completed = true;
  final.samples = Array.from({ length: 100 }, (_, i) => {
    const wall = i === 99 ? 139950 : 114600 + i * 250;
    return { ...sample(i, wall), elapsedPollingMs: wall - 114500 };
  });
  const result = await runBridge(config, {
    monotonicNow: () => now - 114600, wallNow: () => now,
    sleep: async () => { now = 140050; }, log: (record) => journal.push(record),
    readCapture: async () => JSON.stringify(reads++ === 0 ? first : final),
    evaluate: async (method, payload) => {
      if (method === 'probe') return { ready: true, now };
      if (method === 'startSession') { phase = 'live'; assert.equal(payload.expiresAtWallTimeMs, 154000); }
      if (method === 'ingestCapture') sent.push(...payload.samples);
      if (method === 'finishSession') phase = 'completed';
      return { accepted: true, now, viewer: { phase, samples: sent.length, lastSequence: sent.at(-1)?.sequence ?? -1, missingSequences: 0, values: null } };
    },
  });
  assert.equal(sent.at(-1).sequence, 99);
  assert.equal(result.reason, 'collector-completed'); assert.equal(phase, 'completed');
  assert.equal(journal.filter((r) => r.event === 'forwarded').at(-1).viewer.lastSequence, 99);
  assert.equal(journal.find((r) => r.event === 'viewer-finished').viewer.phase, 'completed');
});

test('evaluation acknowledgement exposes only mapped viewer fields', () => {
  const state = { phase: 'live', samples: 7, lastSequence: 6, missingSequences: 0,
    sessionId: 'private-correlation', reason: 'private error', rawImu: [99], authState: 'not-for-journal',
    values: { tip: 18, tipForce: 18, roundHeld: true, oval: 3, ovalForce: 4, vendor: 'omit' } };
  const controller = { state: { getState: () => state }, startSession: () => true, ingestCapture: () => true, finishSession: () => true };
  const expression = evaluationExpression('controller', 'ingestCapture', {});
  const result = Function('controller', `return ${expression}`)(controller);
  assert.deepEqual(result.viewer, { phase: 'live', samples: 7, lastSequence: 6, missingSequences: 0,
    values: { tip: 18, tipForce: 18, roundHeld: true, oval: 3, ovalForce: 4 } });
  assert.equal(JSON.stringify(result).includes('private'), false);
  assert.equal(JSON.stringify(result).includes('vendor'), false);
  assert.equal(JSON.stringify(result).includes('rawImu'), false);
});
