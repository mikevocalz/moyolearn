#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { CAPTURE_PACKAGE, CAPTURE_FILE, COLLECTOR_APK_SHA256, validateCapture,
  sessionMetadata, freshEnvelope, evaluationExpression } from './live-telemetry-policy.mjs';

export function validateConfig(config) {
  if (!config || !/^[a-zA-Z0-9._:-]{1,160}$/.test(config.deviceId ?? '')) throw new Error('Invalid device id');
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error('Invalid Metro port');
  for (const name of ['metaCliPath', 'argentPath', 'installedCollectorApkPath']) {
    if (typeof config[name] !== 'string' || !config[name].startsWith('/') || config[name].includes('\0')) throw new Error(`Require absolute ${name}`);
  }
  if (!Number.isSafeInteger(config.armTimeMs) || config.armTimeMs < 1) throw new Error('Require preflight app armTimeMs');
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(config.sessionId ?? '')) throw new Error('Require fresh session nonce');
  if (config.pollingIntervalMs !== undefined && (!Number.isInteger(config.pollingIntervalMs) || config.pollingIntervalMs < 250 || config.pollingIntervalMs > 1000)) {
    throw new Error('Require pollingIntervalMs between250 and1000');
  }
  evaluationExpression(config.controllerExpression, 'probe');
  return config;
}

/** No shell is spawned. Every argument and stdin value stays an independent value. */
export function processResult(executable, args, input, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', failed = false, forceTimer;
    const terminate = () => {
      child.kill('SIGTERM');
      forceTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      }, 200);
    };
    const timer = setTimeout(() => { failed = true; terminate(); reject(new Error('Bridge subprocess deadline exceeded')); }, Math.max(1, timeoutMs));
    const append = (which, chunk) => {
      if (failed) return;
      if (which === 'out') stdout += chunk.toString('utf8'); else stderr += chunk.toString('utf8');
      if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) > 262144 && !failed) {
        failed = true; terminate(); clearTimeout(timer); reject(new Error('Bridge subprocess output limit exceeded'));
      }
    };
    child.stdout.on('data', (chunk) => append('out', chunk));
    child.stderr.on('data', (chunk) => append('err', chunk));
    child.once('error', (error) => { clearTimeout(timer); clearTimeout(forceTimer); if (!failed) { failed = true; reject(error); } });
    child.once('close', (code) => {
      clearTimeout(timer); clearTimeout(forceTimer);
      if (failed) return;
      if (code !== 0) reject(new Error(`Bridge subprocess failed (${code}): ${stderr.slice(0, 400) || stdout.slice(0, 400)}`));
      else resolve(stdout);
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

/** Injected IO/clock boundary makes policy tests incapable of touching devices. */
export async function runBridge(config, io) {
  validateConfig(config);
  const end = io.monotonicNow() + 40000;
  const remaining = () => Math.max(0, end - io.monotonicNow());
  const pollingIntervalMs = config.pollingIntervalMs ?? 1000;
  let session, lastNow, cursor = { lastObservedSequence: -1, gapCount: 0 }, forwarded = 0, reason = 'deadline';
  const probe = await io.evaluate('probe', undefined, Math.min(4000, remaining()));
  if (probe.ready !== true || !Number.isSafeInteger(probe.now)) throw new Error('DEV viewer is not ready');
  if (config.armTimeMs > probe.now + 2000 || probe.now - config.armTimeMs > 60000) throw new Error('Preflight arm time is invalid or expired');
  const deviceClockOffset = probe.now - io.wallNow();
  io.log({ event: 'armed', sessionId: config.sessionId, armTimeMs: config.armTimeMs, maximumBridgeMs: 40000 });
  try {
    while (remaining() > 100) {
      let raw;
      try { raw = await io.readCapture(Math.min(3000, remaining())); }
      catch (error) {
        // A not-yet-created private file is expected before the collector is ready.
        if (!session && /No such file|does not exist/.test(String(error))) { await io.sleep(Math.min(pollingIntervalMs, remaining())); continue; }
        throw error;
      }
      const deviceNow = io.wallNow() + deviceClockOffset;
      const validated = validateCapture(JSON.parse(raw), config.armTimeMs, deviceNow);
      if (validated.kind === 'waiting') { await io.sleep(Math.min(pollingIntervalMs, remaining())); continue; }
      if (!session) {
        session = sessionMetadata(validated.capture, config.sessionId, config.armTimeMs, deviceNow);
        const started = await io.evaluate('startSession', session, Math.min(3000, remaining()));
        if (started.accepted !== true) throw new Error('DEV viewer rejected the LIVE session');
        lastNow = started.now;
        io.log({ event: 'started', sessionId: session.sessionId, startedAtWallTimeMs: session.startedAtWallTimeMs, expiresAtWallTimeMs: session.expiresAtWallTimeMs, viewer: started.viewer });
      }
      if (validated.start !== session.startedAtWallTimeMs) throw new Error('Collector run changed during the finite session');
      if (deviceNow >= session.expiresAtWallTimeMs) { reason = 'capture-window-ended'; break; }
      const next = freshEnvelope(validated, session, cursor, deviceNow);
      if (next.envelope.samples.length || next.cursor.gapCount !== cursor.gapCount) {
        const ingested = await io.evaluate('ingestCapture', next.envelope, Math.min(3000, remaining()));
        if (ingested.accepted !== true) throw new Error('DEV viewer rejected telemetry; no retry/replay');
        lastNow = ingested.now;
        forwarded += next.envelope.samples.length;
        io.log({ event: 'forwarded', sampleCount: next.envelope.samples.length, totalForwarded: forwarded, gapCount: next.cursor.gapCount, viewer: ingested.viewer });
      }
      cursor = next.cursor;
      if (validated.capture.completed === true) { reason = 'collector-completed'; break; }
      await io.sleep(Math.min(pollingIntervalMs, remaining()));
    }
  } catch (error) {
    reason = 'error';
    throw error;
  } finally {
    if (session && remaining() > 100) {
      try {
        const finished = await io.evaluate('finishSession', session.sessionId, Math.min(2000, remaining()));
        io.log({ event: 'viewer-finished', viewer: finished.viewer, accepted: finished.accepted });
        if (finished.accepted === false) io.log({ event: 'finish-unconfirmed', reason: 'viewer-not-live-or-expired' });
      }
      catch (error) { io.log({ event: 'finish-unconfirmed', error: String(error.message).slice(0, 200) }); }
    }
    // Viewer expiry is independent if transport loss/deadline prevents finish.
    io.log({ event: 'finished', sessionId: config.sessionId, reason, totalForwarded: forwarded, gapCount: cursor.gapCount, lastDeviceTimeMs: lastNow ?? null });
  }
  return { sessionId: config.sessionId, reason, totalForwarded: forwarded, gapCount: cursor.gapCount };
}

async function main() {
  const chunks = [];
  let total = 0;
  for await (const chunk of process.stdin) { total += chunk.length; if (total > 32768) throw new Error('Config too large'); chunks.push(chunk); }
  const config = validateConfig(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  const hash = createHash('sha256').update(readFileSync(config.installedCollectorApkPath)).digest('hex');
  if (hash !== COLLECTOR_APK_SHA256) throw new Error('Preflight installed-collector APK bytes do not match pinned collector');
  await runBridge(config, {
    monotonicNow: () => performance.now(), wallNow: () => Date.now(), sleep,
    log: (record) => process.stdout.write(JSON.stringify(record) + '\n'),
    readCapture: (timeoutMs) => processResult(config.metaCliPath,
      ['--device', config.deviceId, 'adb', 'shell', 'run-as', CAPTURE_PACKAGE, 'cat', CAPTURE_FILE], undefined, timeoutMs),
    evaluate: async (method, payload, timeoutMs) => {
      const input = JSON.stringify({ port: config.port, device_id: config.deviceId,
        expression: evaluationExpression(config.controllerExpression, method, payload) });
      const output = await processResult(config.argentPath, ['run', 'debugger-evaluate', '--args', '-', '--json'], input, timeoutMs);
      const result = JSON.parse(output).result;
      if (!result || !Number.isSafeInteger(result.now)) throw new Error('Debugger returned no valid viewer acknowledgement');
      return result;
    },
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { process.stderr.write(JSON.stringify({ event: 'bridge-error', error: String(error.message).slice(0, 400) }) + '\n'); process.exitCode = 1; });
}
