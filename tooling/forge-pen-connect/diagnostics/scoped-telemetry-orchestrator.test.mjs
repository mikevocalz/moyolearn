import test from 'node:test';
import assert from 'node:assert/strict';
import { runScopedCapture, WATCHDOG_MS, RESTORE_MS } from './scoped-telemetry-orchestrator.mjs';
import { CAPTURE_PACKAGE } from './live-telemetry-policy.mjs';

const config = { deviceId: '340_TEST_QUEST', port: 8081, metaCliPath: '/not/run/metavr', argentPath: '/not/run/argent',
  installedCollectorApkPath: '/not/read/installed.apk', armTimeMs: 100000, sessionId: 'local_test_nonce_12345', controllerExpression: 'localController',
  reaScriptPath: '/not/run/rea.mjs', collectorSourcePath: '/not/read/collector.java', outputDirectory: '/not/write/output',
  approvedFiniteQuestInspectionPause: true, normalGattClosed: true, collectorInactive: true };
function harness(mode = 'normal', external) {
  let now = 0, watchdog;
  const calls = [];
  const record = (name, args, timeout) => { calls.push({ name, args, timeout, at: now }); };
  const handles = [{ id: 'owned-collector', done: Promise.resolve() }, { id: 'owned-bridge', done: Promise.resolve() }];
  const io = {
    now: () => now, setTimer: (fn, ms) => { assert.equal(ms, WATCHDOG_MS); watchdog = fn; return 1; }, clearTimer: () => record('clear-watchdog'), log: (args) => record('log', args),
    preflight: async () => { record('preflight'); if (mode === 'identity-error') throw new Error('Wrong installed collector'); return { apk: 'verified-test-fixture' }; },
    pause: async (args, timeout) => { record('pause', args, timeout); now += 1000; if (mode === 'pause-error') throw new Error('Pause failed'); },
    connectCdp: async (args, timeout) => { record('cdp', args, timeout); now += 100; },
    armViewer: async () => { record('arm'); return { now: 100000 + now }; },
    launchCollector: (args) => { record('collector', { deviceId: args.deviceId, sessionId: args.sessionId }); return handles[0]; },
    launchBridge: (args) => {
      record('bridge', { deviceId: args.deviceId, sessionId: args.sessionId });
      if (mode === 'error') return { ...handles[1], done: Promise.reject(new Error('Bridge failed')) };
      if (mode === 'cancel') { external.abort(); return { ...handles[1], done: new Promise(() => {}) }; }
      if (mode === 'timeout') { now = WATCHDOG_MS; watchdog(); return { ...handles[1], done: new Promise(() => {}) }; }
      now += 27000; return handles[1];
    },
    stopOwned: async (handle, timeout) => { record('stop-own', handle.id, timeout); now += 100; },
    terminateCollector: async (args, timeout) => { record('terminate-test-only', args, timeout); now += 1000; },
    finishViewer: async (args, timeout) => { record('finish-viewer', args.sessionId, timeout); now += 100; },
    restore: async (args, timeout) => {
      record('restore', args, timeout); now += mode === 'offline' ? RESTORE_MS : 2000;
      if (mode === 'offline') throw new Error('Device offline');
      return { source: 'android-devtools', description: 'Retained measured values; no fabricated zeros' };
    },
  };
  return { io, calls };
}
function verifyRestoredOnce(calls) {
  const restore = calls.filter((c) => c.name === 'restore'); assert.equal(restore.length, 1);
  assert.deepEqual(restore[0].args, { udid: config.deviceId }); assert.equal(restore[0].timeout, 8000);
  assert.deepEqual(calls.find((c) => c.name === 'pause').args, { devices: [config.deviceId] });
  for (const c of calls.filter((c) => c.name === 'terminate-test-only')) assert.deepEqual(c.args, { deviceId: config.deviceId, packageName: CAPTURE_PACKAGE });
  assert.equal(calls.some((c) => /kill-server|clear-data|zero|release|BoardDoc/.test(c.name)), false);
}

test('normal completion restores immediately once and preserves historical viewer data', async () => {
  const h = harness(); const result = await runScopedCapture(config, h.io);
  assert.equal(result.success, true); assert.equal(result.captureCompleted, true);
  verifyRestoredOnce(h.calls);
  assert.equal(h.calls.some((c) => c.name === 'terminate-test-only'), false);
  assert.ok(result.restoration.elapsedMs < 45000);
});
test('capture failure stops only owned collector and still restores once', async () => {
  const h = harness('error'); const result = await runScopedCapture(config, h.io);
  assert.equal(result.outcome, 'error'); assert.equal(result.success, false);
  verifyRestoredOnce(h.calls); assert.equal(h.calls.filter((c) => c.name === 'terminate-test-only').length, 1);
});
test('operator cancellation restores once without changing measurement values', async () => {
  const external = new AbortController(); const h = harness('cancel', external);
  const result = await runScopedCapture(config, h.io, external.signal);
  assert.equal(result.outcome, 'cancelled'); verifyRestoredOnce(h.calls);
});
test('hard45s watchdog stops owned test role then restores before60s', async () => {
  const h = harness('timeout'); const result = await runScopedCapture(config, h.io);
  assert.equal(result.outcome, 'timeout'); verifyRestoredOnce(h.calls);
  assert.equal(result.restoration.acknowledged, true); assert.equal(result.restoration.withinApprovedWindow, true);
  assert.ok(result.restoration.elapsedMs < 60000);
  assert.ok(h.calls.findIndex((c) => c.name === 'terminate-test-only') < h.calls.findIndex((c) => c.name === 'restore'));
});
test('partial pause failure still makes exactly one scoped restoration attempt', async () => {
  const h = harness('pause-error'); const result = await runScopedCapture(config, h.io);
  assert.equal(result.outcome, 'error'); verifyRestoredOnce(h.calls);
  assert.equal(h.calls.some((c) => c.name === 'collector'), false);
});
test('offline restoration is explicitly failed, never claimed successful', async () => {
  const h = harness('offline'); const result = await runScopedCapture(config, h.io);
  verifyRestoredOnce(h.calls); assert.equal(result.success, false); assert.equal(result.restoration.acknowledged, false);
  assert.match(result.restoration.error, /offline/);
});
test('approval and installed-identity failures leave inspection untouched', async () => {
  const h = harness('identity-error');
  await assert.rejects(runScopedCapture({ ...config, approvedFiniteQuestInspectionPause: false }, h.io), /approval/);
  assert.equal(h.calls.length, 0);
  await assert.rejects(runScopedCapture(config, h.io), /Wrong installed/);
  assert.equal(h.calls.some((c) => c.name === 'pause' || c.name === 'restore'), false);
});
