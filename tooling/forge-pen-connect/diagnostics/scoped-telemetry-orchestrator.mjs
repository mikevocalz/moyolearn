#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { processResult, validateConfig } from './live-telemetry-bridge.mjs';
import { COLLECTOR_APK_SHA256, CAPTURE_PACKAGE, evaluationExpression } from './live-telemetry-policy.mjs';

export const WATCHDOG_MS = 45000, RESTORE_MS = 8000, APPROVED_LIMIT_MS = 60000;
export const COLLECTOR_SOURCE_SHA256 = 'a5b0df9d262a613db22c59e813b04dccdae595b57f65ad123933c8c6c55cd420';
export function validateScopedConfig(config) {
  validateConfig(config);
  if (config.approvedFiniteQuestInspectionPause !== true || config.normalGattClosed !== true || config.collectorInactive !== true) {
    throw new Error('Require explicit scoped approval and operator ownership preflight attestations');
  }
  for (const key of ['reaScriptPath', 'collectorSourcePath', 'outputDirectory']) {
    if (typeof config[key] !== 'string' || !config[key].startsWith('/') || config[key].includes('\0')) throw new Error(`Require absolute ${key}`);
  }
  return config;
}
function cancelled(signal) { if (signal?.aborted) throw signal.reason ?? new Error('Operator cancelled'); }
function abortable(promise, signal) {
  return new Promise((yes, no) => {
    const stop = () => no(signal.reason ?? new Error('Capture cancelled'));
    signal.addEventListener('abort', stop, { once: true });
    if (signal.aborted) stop();
    Promise.resolve(promise).then(yes, no).finally(() => signal.removeEventListener('abort', stop));
  });
}

/** Fixed lifecycle; all hardware/clock boundaries are injected for local tests. */
export async function runScopedCapture(config, io, externalSignal) {
  validateScopedConfig(config);
  cancelled(externalSignal);
  const identity = await io.preflight(config);
  cancelled(externalSignal);
  const controller = new AbortController();
  const onCancel = () => controller.abort(new Error('Operator cancelled capture'));
  externalSignal?.addEventListener('abort', onCancel, { once: true });
  const started = io.now();
  const timer = io.setTimer(() => controller.abort(new Error('45-second inspection-pause watchdog')), WATCHDOG_MS);
  const handles = [];
  let outcome = 'completed', error = null, collectorLaunched = false, captureCompleted = false, restoration;
  io.log({ event: 'pause-starting', deviceId: config.deviceId, watchdogMs: WATCHDOG_MS });
  try {
    // Await this bounded RPC even during cancellation, so restoration follows pause completion.
    await io.pause({ devices: [config.deviceId] }, 10000);
    cancelled(controller.signal);
    await io.connectCdp({ port: config.port, device_id: config.deviceId }, 4000);
    cancelled(controller.signal);
    const arm = await io.armViewer(config, 3000);
    cancelled(controller.signal);
    const runConfig = { ...config, armTimeMs: arm.now };
    handles.push(io.launchCollector(runConfig)); collectorLaunched = true;
    cancelled(controller.signal);
    handles.push(io.launchBridge(runConfig));
    await abortable(Promise.all(handles.map((handle) => handle.done)), controller.signal);
    captureCompleted = true;
  } catch (failure) {
    error = String(failure.message ?? failure).slice(0, 400);
    outcome = controller.signal.aborted ? (/watchdog/.test(error) ? 'timeout' : 'cancelled') : 'error';
  } finally {
    io.clearTimer(timer);
    externalSignal?.removeEventListener('abort', onCancel);
    // Only processes created by this invocation are stopped. No shared daemon is targeted.
    await Promise.all(handles.map((handle) => io.stopOwned(handle, 500).catch((failure) => {
      io.log({ event: 'owned-host-stop-failed', error: String(failure.message).slice(0, 200) });
    })));
    if (collectorLaunched && !captureCompleted) {
      try { await io.terminateCollector({ deviceId: config.deviceId, packageName: CAPTURE_PACKAGE }, 2000); }
      catch (failure) { io.log({ event: 'collector-stop-unconfirmed', error: String(failure.message).slice(0, 200) }); }
    }
    // Preserve measured values; this only ends the matching DEV viewer session.
    if (collectorLaunched) {
      try { await io.finishViewer(config, 1000); }
      catch (failure) { io.log({ event: 'viewer-finish-unconfirmed', error: String(failure.message).slice(0, 200) }); }
    }
    try {
      const acknowledgement = await io.restore({ udid: config.deviceId }, RESTORE_MS);
      const elapsedMs = io.now() - started;
      restoration = { acknowledged: acknowledgement?.source === 'android-devtools' && Boolean(acknowledgement.description?.trim()),
        withinApprovedWindow: elapsedMs < APPROVED_LIMIT_MS, elapsedMs, source: acknowledgement?.source ?? null };
    } catch (failure) {
      restoration = { acknowledged: false, withinApprovedWindow: io.now() - started < APPROVED_LIMIT_MS,
        elapsedMs: io.now() - started, error: String(failure.message).slice(0, 400) };
    }
    io.log({ event: 'inspection-restoration', ...restoration });
  }
  return { outcome, error, identity, restoration, collectorLaunched, captureCompleted,
    success: outcome === 'completed' && restoration.acknowledged && restoration.withinApprovedWindow };
}

function launchOwned(executable, args, input, outputFile, validateOutput) {
  const child = spawn(executable, args, { stdio: ['pipe', 'pipe', 'pipe'] });
  let exited = false, output = '', size = 0;
  const done = new Promise((yes, no) => {
    const append = (chunk) => {
      size += chunk.length;
      if (size > 1048576) { child.kill('SIGTERM'); no(new Error('Owned capture output exceeded1MiB')); return; }
      output += chunk.toString('utf8');
    };
    child.stdout.on('data', append); child.stderr.on('data', append);
    child.once('error', no);
    child.once('close', (code) => {
      exited = true; writeFileSync(outputFile, output, { mode: 0o600 });
      if (code === 0) { try { validateOutput?.(output); yes(); } catch (error) { no(error); } }
      else no(new Error(`Owned process failed (${code}); see ${outputFile}`));
    });
  });
  // Both promises are observed even if launch/cancellation interrupts before Promise.all.
  done.catch(() => {});
  child.stdin.on('error', () => {}); child.stdin.end(input);
  return { done, async stop() {
    if (exited) return;
    child.kill('SIGTERM');
    await Promise.race([done.catch(() => {}), new Promise((yes) => setTimeout(yes, 200))]);
    if (!exited) child.kill('SIGKILL');
  } };
}
async function main() {
  let raw = '';
  for await (const chunk of process.stdin) { raw += chunk; if (Buffer.byteLength(raw) > 32768) throw new Error('Config too large'); }
  const config = validateScopedConfig(JSON.parse(raw));
  mkdirSync(config.outputDirectory, { recursive: false, mode: 0o700 });
  const log = (value) => process.stdout.write(JSON.stringify(value) + '\n');
  const tool = async (name, args, timeoutMs) => JSON.parse(await processResult(config.argentPath,
    ['run', name, '--args', '-', '--json'], JSON.stringify(args), timeoutMs));
  const evaluate = async (method, payload, timeoutMs) => (await tool('debugger-evaluate', {
    port: config.port, device_id: config.deviceId, expression: evaluationExpression(config.controllerExpression, method, payload),
  }, timeoutMs)).result;
  const stop = new AbortController();
  const cancel = () => stop.abort(new Error('Operator cancelled'));
  process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
  try {
    const result = await runScopedCapture(config, {
      now: () => performance.now(), setTimer: setTimeout, clearTimer: clearTimeout, log,
      preflight: async () => {
        const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
        if (digest(config.installedCollectorApkPath) !== COLLECTOR_APK_SHA256 || digest(config.collectorSourcePath) !== COLLECTOR_SOURCE_SHA256) {
          throw new Error('Reviewed collector APK/source identity mismatch; inspection untouched');
        }
        const warm = await evaluate('probe', undefined, 4000);
        if (warm.ready !== true || warm.viewer?.phase === 'live') throw new Error('Require warm, idle DEV viewer before pausing inspection');
        return { apkSha256: COLLECTOR_APK_SHA256, sourceSha256: COLLECTOR_SOURCE_SHA256, installerIdentity: 'operator-attested installed APK pull' };
      },
      pause: (args, timeout) => tool('stop-all-simulator-servers', args, timeout),
      connectCdp: async (args, timeout) => { const value = await tool('debugger-connect', args, timeout); if (value.connected !== true) throw new Error('CDP did not reconnect'); },
      armViewer: async (_config, timeout) => { const value = await evaluate('probe', undefined, timeout); if (!value.ready) throw new Error('Viewer unavailable after scoped pause'); return value; },
      launchCollector: () => {
        const scenario = { executable: config.metaCliPath,
          arguments: ['--device', config.deviceId, 'adb', 'shell', 'am', 'instrument', '-w', `${CAPTURE_PACKAGE}/.MuseLiveReadInstrumentation`],
          working_directory: config.outputDirectory, filesystem_observation_paths: [config.installedCollectorApkPath, config.collectorSourcePath],
          events: [], timeout_ms: 42000, idle_timeout_ms: 41000, settle_ms: 100,
          limits: { output_bytes: 262144, files: 8, file_bytes: 262144, processes: 32, filesystem_depth: 0 } };
        const path = join(config.outputDirectory, 'collector-scenario.json'); writeFileSync(path, JSON.stringify(scenario), { mode: 0o600 });
        return launchOwned(process.execPath, [config.reaScriptPath, 'capture-process', path, '--format', 'json'], undefined, join(config.outputDirectory, 'collector-rea.log'));
      },
      launchBridge: (runConfig) => launchOwned(process.execPath, [resolve(new URL('./live-telemetry-bridge.mjs', import.meta.url).pathname)],
        JSON.stringify(runConfig), join(config.outputDirectory, 'bridge.jsonl'), (output) => {
          const records = output.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
          if (!records.some((r) => r.event === 'finished' && r.reason === 'collector-completed') ||
              !records.some((r) => r.event === 'viewer-finished' && r.accepted === true && r.viewer?.phase === 'completed')) {
            throw new Error('Bridge did not confirm capture completion in the actual viewer');
          }
        }),
      stopOwned: (handle) => handle.stop(),
      terminateCollector: (args, timeout) => processResult(config.metaCliPath,
        ['--device', args.deviceId, 'adb', 'shell', 'am', 'force-stop', CAPTURE_PACKAGE], undefined, timeout),
      finishViewer: (_config, timeout) => evaluate('finishSession', config.sessionId, timeout),
      restore: async (args, timeout) => {
        const value = await tool('describe', args, timeout);
        writeFileSync(join(config.outputDirectory, 'restored-inspection.json'), JSON.stringify(value), { mode: 0o600 }); return value;
      },
    }, stop.signal);
    writeFileSync(join(config.outputDirectory, 'orchestrator-result.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
    log({ event: 'scoped-capture-result', ...result }); if (!result.success) process.exitCode = 1;
  } finally { process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { process.stderr.write(JSON.stringify({ event: 'orchestrator-error', error: String(error.message).slice(0, 400) }) + '\n'); process.exitCode = 1; });
}
