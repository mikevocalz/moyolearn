#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PROBE_PACKAGE = 'com.moyolearn.museledstate';
export const PROBE_SELECTOR = `${PROBE_PACKAGE}/.MuseLedStateInstrumentation`;
export const APK_SHA256 = '751c3a0833f03e3e54958e8db1314381583794ab4895d4427e0feb982b9c76f4';
export const SOURCE_SHA256 = '3a676544628fa7fd500830a55e6efdf17d45294ee6812e4a08f3d6a77454af08';
export const WATCHDOG_MS = 40000, RESTORE_MS = 8000, APPROVED_LIMIT_MS = 60000;
const ARGENT = '/opt/homebrew/bin/argent';
const META = '/Users/mikevocalz/.metavr/npm/binaries/@meta-quest__metavr-darwin-arm64/1.10.0.30.10/metavr';
const REA = '/tmp/moyo-rea-analysis-tool/node_modules/rea-agents/scripts/rea.mjs';
const INSTALLED_APK = '/tmp/moyo-installed-muse-led-state.apk';
const SOURCE = fileURLToPath(new URL('./src/com/moyolearn/museledstate/MuseLedStateInstrumentation.java', import.meta.url));
const allowed = new Set(['deviceId', 'outputDirectory', 'approvedFiniteQuestInspectionPause', 'normalGattClosed', 'probeInactive', 'installedApkPullVerified']);
/** Only operator attestation/one device/one new private output directory are configurable; commands and target are fixed. */
export function validateLedConfig(config, requireApproval = true) {
  if (!config || typeof config !== 'object' || Array.isArray(config) || Object.keys(config).some(k => !allowed.has(k))) throw new Error('Unexpected LED configuration field');
  if (typeof config.deviceId !== 'string' || !/^[A-Za-z0-9_-]{4,128}$/.test(config.deviceId)) throw new Error('Require explicit Quest deviceId');
  if (typeof config.outputDirectory !== 'string' || !/^(\/private)?\/tmp\/moyo-led-[A-Za-z0-9_-]+$/.test(config.outputDirectory)) throw new Error('Require one new /tmp/moyo-led-* output directory');
  for (const key of ['approvedFiniteQuestInspectionPause', 'normalGattClosed', 'probeInactive', 'installedApkPullVerified']) {
    if (typeof config[key] !== 'boolean' || (requireApproval && config[key] !== true)) throw new Error('Require explicit fresh scoped approval and ownership/installed-pull attestations');
  }
  return config;
}
const errorText = e => String(e?.message ?? e).slice(0, 400);
function checkCancelled(signal) { if (signal?.aborted) throw signal.reason ?? new Error('Operator cancelled'); }
function abortable(promise, signal) {
  return new Promise((yes, no) => {
    const stop = () => no(signal.reason ?? new Error('Operator cancelled'));
    signal.addEventListener('abort', stop, { once: true });
    if (signal.aborted) stop();
    Promise.resolve(promise).then(yes, no).finally(() => signal.removeEventListener('abort', stop));
  });
}
/** Fixed scoped lifecycle. Injected IO makes offline tests incapable of device actions. */
export async function runScopedLedRead(config, io, externalSignal) {
  validateLedConfig(config); checkCancelled(externalSignal);
  const identity = await io.preflight(); checkCancelled(externalSignal);
  const controller = new AbortController();
  const onCancel = () => controller.abort(new Error('Operator cancelled LED read'));
  externalSignal?.addEventListener('abort', onCancel, { once: true });
  if (externalSignal?.aborted) onCancel();
  const started = io.now();
  const timer = io.setTimer(() => controller.abort(new Error('40-second inspection-pause watchdog')), WATCHDOG_MS);
  let handle, launched = false, completed = false, outcome = 'completed', error = null, restoration;
  const cleanup = { hostProcessStopped: null, probeForceStopAcknowledged: null };
  try {
    // This IO call must itself honor its deadline. Do not race a still-running pause against restoration.
    await io.pause({ devices: [config.deviceId] }, 8000);
    checkCancelled(controller.signal);
    handle = io.launchRead({ deviceId: config.deviceId, selector: PROBE_SELECTOR }); launched = true;
    await abortable(handle.done, controller.signal);
    checkCancelled(controller.signal); completed = true;
  } catch (failure) {
    error = errorText(failure);
    outcome = controller.signal.aborted ? (/watchdog/.test(error) ? 'timeout' : 'cancelled') : 'error';
  } finally {
    io.clearTimer(timer); externalSignal?.removeEventListener('abort', onCancel);
    if (handle) {
      try { await io.stopOwned(handle, 500); cleanup.hostProcessStopped = true; }
      catch (failure) { cleanup.hostProcessStopped = false; cleanup.hostProcessError = errorText(failure); }
    }
    if (launched && !completed) {
      try { await io.terminateProbe({ deviceId: config.deviceId, packageName: PROBE_PACKAGE }, 2000); cleanup.probeForceStopAcknowledged = true; }
      catch (failure) { cleanup.probeForceStopAcknowledged = false; cleanup.probeForceStopError = errorText(failure); }
    }
    // Always restore after a pause attempt, including partial failure; no unrelated devices are touched.
    try {
      const acknowledgement = await io.restore({ udid: config.deviceId }, RESTORE_MS);
      const elapsedMs = io.now() - started;
      restoration = { acknowledged: acknowledgement?.source === 'android-devtools' && typeof acknowledgement.description === 'string' && Boolean(acknowledgement.description.trim()), source: acknowledgement?.source ?? null, elapsedMs, withinApprovedWindow: elapsedMs < APPROVED_LIMIT_MS };
    } catch (failure) {
      const elapsedMs = io.now() - started;
      restoration = { acknowledged: false, elapsedMs, withinApprovedWindow: elapsedMs < APPROVED_LIMIT_MS, error: errorText(failure) };
    }
  }
  return { outcome, error, identity, launched, completed, cleanup, restoration, success: outcome === 'completed' && completed && cleanup.hostProcessStopped === true && restoration.acknowledged && restoration.withinApprovedWindow };
}

/** Bounded owned child only. Output, timeout and stop failures cannot silently become acknowledgement. */
export function launchOwnedLedCommand(executable, args, { input, timeoutMs = 0, maxBytes = 524288 } = {}) {
  const child = spawn(executable, args, { stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '', bytes = 0, closed = false, failure = null, timeout, killTimer;
  const terminate = () => {
    if (closed) return;
    child.kill('SIGTERM');
    if (!killTimer) killTimer = setTimeout(() => { if (!closed) child.kill('SIGKILL'); }, 200);
  };
  const done = new Promise((yes, no) => {
    // Latch failure, but never settle while the owned command can still execute a pause RPC.
    const fail = message => { if (!failure) failure = new Error(message); terminate(); };
    if (timeoutMs) timeout = setTimeout(() => fail('Owned command deadline exceeded'), timeoutMs);
    const append = (which, data) => {
      bytes += data.length;
      if (bytes > maxBytes) { fail('Owned command output bound exceeded'); return; }
      if (which === 'out') stdout += data.toString('utf8'); else stderr += data.toString('utf8');
    };
    child.stdout.on('data', d => append('out', d)); child.stderr.on('data', d => append('err', d));
    // Node emits close after a spawn error as well. That remains the sole settlement boundary.
    child.once('error', error => { if (!failure) failure = error; });
    child.once('close', code => {
      closed = true; clearTimeout(timeout); clearTimeout(killTimer);
      if (failure) no(failure);
      else if (code === 0) yes({ stdout, stderr });
      else no(new Error(`Owned command exit ${code}: ${stderr.slice(0, 250)}`));
    });
  });
  done.catch(() => {}); child.stdin.on('error', () => {}); child.stdin.end(input);
  return { done, pid: child.pid, async stop() {
    if (closed) return;
    terminate();
    // The child has SIGKILL scheduled; await the same close acknowledgement, never a timer-only success.
    await done.catch(() => {});
    if (!closed) throw new Error('Owned host process termination unconfirmed');
  } };
}
export function verifyLedReadEvidence(raw) {
  const evidence = JSON.parse(raw);
  if (!evidence.evidence_id || evidence.operation !== 'capture_process_scenario') throw new Error('Expected actual REA process Evidence');
  const capture = evidence.normalized_result;
  if (capture?.exit?.reason !== 'exited' || capture.exit.code !== 0 || capture.truncated !== false || capture.cleanup?.owned_process_group !== 'verified') throw new Error('REA owned command did not exit completely');
  // Raw process frames retain stdout bytes; do not infer completion from a clipped terminal rendering.
  const stdout = (capture.frames ?? []).map(frame => frame.data ?? '').join('');
  const line = stdout.split(/\r?\n/).find(line => line.startsWith('INSTRUMENTATION_RESULT: resultJson='));
  if (!line) throw new Error('Actual instrumentation JSON receipt missing');
  const receipt = JSON.parse(line.slice('INSTRUMENTATION_RESULT: resultJson='.length));
  if (receipt.completed !== true || receipt.cleanupCompleted !== true || receipt.reportMapSha256 !== MAP_HASH || receipt.outputReportReadStatus !== 0 || receipt.outputReportReferenceHex !== '0402' || receipt.outputPayloadByteLength !== 14 || receipt.deviceWrites !== false || receipt.productionAccess !== false || receipt.opticalEmissionVerified !== false) throw new Error('LED instrumentation completion/cleanup/read receipt unconfirmed');
  return { evidenceId: evidence.evidence_id, receipt };
}
const MAP_HASH = '4708e62215883a297c88be41600d2ddea20345ecfbe41213db47f7d6778b3405';
export function ledReadPlan(config) {
  validateLedConfig(config, false);
  return { executionAuthorized: config.approvedFiniteQuestInspectionPause === true, deviceId: config.deviceId, packageName: PROBE_PACKAGE, selector: PROBE_SELECTOR, apkSha256: APK_SHA256, sourceSha256: SOURCE_SHA256, installedApkPath: INSTALLED_APK, sourcePath: SOURCE, pause: { tool: 'stop-all-simulator-servers', args: { devices: [config.deviceId] } }, read: { executable: META, arguments: ['--device', config.deviceId, 'adb', 'shell', 'am', 'instrument', '-w', PROBE_SELECTOR] }, watchdogMs: WATCHDOG_MS, restore: { tool: 'describe', args: { udid: config.deviceId } }, outputDirectory: config.outputDirectory };
}
async function main() {
  let raw = ''; for await (const part of process.stdin) { raw += part; if (Buffer.byteLength(raw) > 8192) throw new Error('Config too large'); }
  const config = JSON.parse(raw);
  if (process.argv.includes('--plan')) { process.stdout.write(JSON.stringify(ledReadPlan(config), null, 2) + '\n'); return; }
  validateLedConfig(config);
  if (realpathSync(dirname(resolve(config.outputDirectory))) !== '/private/tmp') throw new Error('Output parent must resolve to /private/tmp');
  const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex');
  // Verify before directory creation or any pause. The APK must be a fresh operator-verified installed pull.
  if (digest(INSTALLED_APK) !== APK_SHA256 || digest(SOURCE) !== SOURCE_SHA256) throw new Error('Reviewed installed APK/source mismatch; inspection untouched');
  mkdirSync(config.outputDirectory, { mode: 0o700 });
  const record = (name, value) => writeFileSync(join(config.outputDirectory, name), JSON.stringify(value, null, 2), { mode: 0o600, flag: 'wx' });
  const tool = async (name, args, timeoutMs) => JSON.parse((await launchOwnedLedCommand(ARGENT, ['run', name, '--args', '-', '--json'], { input: JSON.stringify(args), timeoutMs }).done).stdout);
  const stop = new AbortController(); const cancel = () => stop.abort(new Error('Operator cancelled')); process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
  try {
    const result = await runScopedLedRead(config, {
      now: () => performance.now(), setTimer: setTimeout, clearTimer: clearTimeout,
      preflight: async () => ({ apkSha256: APK_SHA256, sourceSha256: SOURCE_SHA256, installedIdentity: 'operator-verified installed APK pull' }),
      pause: (args, ms) => tool('stop-all-simulator-servers', args, ms),
      launchRead: () => {
        const scenario = { executable: META, arguments: ['--device', config.deviceId, 'adb', 'shell', 'am', 'instrument', '-w', PROBE_SELECTOR], working_directory: config.outputDirectory, events: [], timeout_ms: 30000, idle_timeout_ms: 29000, settle_ms: 100, filesystem_observation_paths: [], limits: { output_bytes: 131072, files: 4, file_bytes: 131072, processes: 16, filesystem_depth: 0 } };
        const path = join(config.outputDirectory, 'led-read-scenario.json'); record('led-read-scenario.json', scenario);
        const process = launchOwnedLedCommand(processExec(), [REA, 'capture-process', path, '--format', 'json']);
        const done = process.done.then(value => { record('led-read-rea-private.json', JSON.parse(value.stdout)); if (value.stderr) record('led-read-progress-private.json', { stderr: value.stderr }); verifyLedReadEvidence(value.stdout); }); done.catch(() => {});
        return { done, stop: () => process.stop() };
      },
      stopOwned: h => h.stop(),
      terminateProbe: (args, ms) => launchOwnedLedCommand(META, ['--device', args.deviceId, 'adb', 'shell', 'am', 'force-stop', PROBE_PACKAGE], { timeoutMs: ms }).done,
      restore: async (args, ms) => { const acknowledgement = await tool('describe', args, ms); record('restored-inspection-private.json', acknowledgement); return acknowledgement; },
    }, stop.signal);
    record('orchestrator-result.json', result); process.stdout.write(JSON.stringify({ outcome: result.outcome, success: result.success, restoration: result.restoration }) + '\n'); if (!result.success) process.exitCode = 1;
  } finally { process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel); }
}
const processExec = () => process.execPath;
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { process.stderr.write(errorText(error) + '\n'); process.exitCode = 1; });
