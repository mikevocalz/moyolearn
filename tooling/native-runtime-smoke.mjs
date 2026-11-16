#!/usr/bin/env node
// Execute the existing native smoke route on CI-owned virtual devices.
// SOT: .github/workflows/{ios,android}-native.yml; docs/business/native-runtime-checks.md
// SOT-KEYWORDS: native runtime iPad simulator Android emulator agent-device evidence
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream, readdirSync, statSync } from 'node:fs';
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer, get as httpGet } from 'node:http';
import { basename, dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP_ID = 'com.moyolearn.app';
const METRO_PORT = 8081;
const API_PORT = 39001;
const FLOW = join(ROOT, 'tooling/fixtures/native-runtime/render-lifecycle.yaml');
export const IOS_STARTUP_BUDGET = Object.freeze({ daemonMs: 120_000, bootMs: 600_000, processMs: 750_000 });
export const RUNTIME_TEST_BUDGET = Object.freeze({ flowMs: 600_000, reportingMs: 60_000, processMs: 780_000 });
export const METRO_BUNDLE_TIMEOUT_MS = 360_000;
export const AGENT_DEVICE = Object.freeze({
  version: '0.21.37',
  url: 'https://registry.npmjs.org/agent-device/-/agent-device-0.21.37.tgz',
  sha512: 'IepPH4OtF3rrf51bxAACGCCaHX4Uj7xt5vlbG3sQyNAVzYnSJpOXpn3INQ1gZhZV/tiCIxI3Z+KAIGeiULKc1A==',
});
const SCREENSHOTS = ['01-adapter', '02-triangle', '03-cube', '04-resumed-cube', '05-cold-cube'];

export function selectIpad(inventory) {
  const candidates = Object.entries(inventory.devices ?? {})
    .filter(([runtime]) => /^com\.apple\.CoreSimulator\.SimRuntime\.iOS-\d/.test(runtime))
    .flatMap(([runtime, devices]) => devices
      .filter((device) => device.isAvailable === true && /^iPad\b/.test(device.name)
        && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(device.udid))
      .map((device) => ({ kind: 'iPad simulator', runtime, name: device.name, udid: device.udid })))
    .sort((a, b) => b.runtime.localeCompare(a.runtime, 'en', { numeric: true }) || a.name.localeCompare(b.name));
  if (!candidates.length) throw new Error('No available iPad simulator; an iPhone or build-only result cannot satisfy this check');
  return candidates[0];
}

export function assertAndroidEmulator(serial, qemu, abis) {
  if (!/^emulator-\d+$/.test(serial) || qemu.trim() !== '1' || !abis.trim().split(',').includes('x86_64')) {
    throw new Error('Runtime checks require the CI-owned x86_64 Android emulator, never a physical device');
  }
  return { kind: 'Android emulator', serial, abis: abis.trim().split(','), graphics: 'SwiftShader software GPU' };
}

// Do not use the application's mock-auth mode: it creates a demo identity.
// The only successful response here is a real anonymous-session shape (null).
export function anonymousApiReply(method, url) {
  return method === 'GET' && new URL(url, 'http://127.0.0.1').pathname === '/api/auth/get-session'
    ? { status: 200, body: 'null' }
    : { status: 503, body: '{"error":"Native CI has no application data service"}' };
}

export function runtimeEnvironment(base) {
  const origin = `http://127.0.0.1:${API_PORT}`;
  return {
    ...base,
    CI: '1', EXPO_NO_DOTENV: '1', NODE_ENV: 'development',
    DO_NOT_TRACK: '1', EXPO_NO_TELEMETRY: '1', TURBO_TELEMETRY_DISABLED: '1', NEXT_TELEMETRY_DISABLED: '1',
    EXPO_PUBLIC_APP_URL: origin, NEXT_PUBLIC_APP_URL: origin,
    EXPO_PUBLIC_AUTH_URL: origin, NEXT_PUBLIC_AUTH_URL: origin,
    EXPO_PUBLIC_AUTH_MODE: 'live', NEXT_PUBLIC_AUTH_MODE: 'live',
    EXPO_PUBLIC_SENTRY_DSN: '', EXPO_PUBLIC_SENTRY_DSN_MOBILE: '',
  };
}

export function metroEnvironment(base) {
  return {
    ...runtimeEnvironment(base),
    // Expo's --localhost binds the first resolved localhost address. Keep it
    // on IPv4 to match the readiness URL and adb reverse, without exposing it
    // on a LAN interface or discarding existing Node memory/debug settings.
    NODE_OPTIONS: [base.NODE_OPTIONS, '--dns-result-order=ipv4first'].filter(Boolean).join(' '),
  };
}

export function agentEnvironment(base, stateDir) {
  return {
    ...runtimeEnvironment(base),
    AGENT_DEVICE_STATE_DIR: stateDir,
    AGENT_DEVICE_EXEC_TRACE: '1',
    AGENT_DEVICE_DAEMON_STARTUP_TIMEOUT_MS: String(IOS_STARTUP_BUDGET.daemonMs),
  };
}

// Device state also contains daemon credentials and ownership registrations.
// Retain only the pinned tool's documented diagnostic files, never its state.
export async function retainAgentDiagnostics(stateDir, destination) {
  const copied = [];
  const inspect = async (path) => {
    try { return await lstat(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  };
  const entries = async (path) => (await inspect(path))?.isDirectory() ? readdir(path, { withFileTypes: true }) : [];
  const copy = async (relativePath) => {
    const source = join(stateDir, relativePath);
    if (!(await inspect(source))?.isFile()) return;
    const target = join(destination, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
    copied.push(relativePath);
  };
  await copy('daemon.log');
  for (const session of await entries(join(stateDir, 'sessions'))) {
    if (!session.isDirectory()) continue;
    const relative = join('sessions', session.name);
    await copy(join(relative, 'runner.log'));
    for (const request of await entries(join(stateDir, relative, 'requests'))) {
      if (request.isFile() && request.name.endsWith('.ndjson')) await copy(join(relative, 'requests', request.name));
    }
  }
  return copied.sort();
}

// A failed launch can leave only the Android launcher in the UI hierarchy.
// Capture the OS crash/exit evidence while the verified temporary emulator is
// still alive; never turn a diagnostic failure into a replacement test result.
export async function retainAndroidFailureDiagnostics(device, destination, { env = runtimeEnvironment(process.env) } = {}) {
  if (device?.kind !== 'Android emulator' || !/^emulator-\d+$/.test(device.serial)
    || !device.abis?.includes('x86_64')) {
    throw new Error('Android failure diagnostics require the already-verified CI emulator');
  }
  await mkdir(destination, { recursive: true });
  const files = []; const warnings = [];
  const diagnostics = [
    ['android-crash.log', 'android-crash-buffer', ['logcat', '-b', 'crash', '-d', '-v', 'threadtime', '-t', '400']],
    ['android-app-exit-info.log', 'android-app-exit-info', ['shell', 'dumpsys', 'activity', 'exit-info', APP_ID]],
  ];
  for (const [name, phase, args] of diagnostics) {
    const chunks = []; let bytes = 0; let truncated = false;
    const log = { write: (chunk) => {
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const remaining = Math.max(0, 512 * 1024 - bytes);
      if (remaining === 0) { truncated ||= data.length > 0; return; }
      if (data.length > remaining) truncated = true;
      const retained = data.subarray(0, remaining);
      chunks.push(retained); bytes += retained.length;
    } };
    await command('adb', ['-s', device.serial, ...args], { env, log, phase, timeout: 20_000 })
      .catch((error) => { warnings.push(error.message); });
    if (truncated) chunks.push(Buffer.from('\n[diagnostic output truncated at 512 KiB]\n'));
    await writeFile(join(destination, name), Buffer.concat(chunks));
    files.push(name);
  }
  return { files, warnings };
}

export function verifyRuntimeEvidence(junit, screenshotNames) {
  const suites = [...junit.matchAll(/<testsuite\b([^>]*)>/g)];
  const cases = [...junit.matchAll(/<testcase\b/g)];
  if (!suites.length || !cases.length || /<(?:failure|error|skipped)\b/.test(junit)
    || [...junit.matchAll(/<\/testsuite>/g)].length !== suites.length
    || (/<testsuites\b/.test(junit) && !/<\/testsuites>\s*$/.test(junit.trim()))) {
    throw new Error('Runtime report has no executed passing tests, or contains failed/skipped tests');
  }
  let declaredTests = 0;
  for (const [, attributes] of suites) {
    const count = /\btests=["'](\d+)["']/.exec(attributes);
    if (!count || Number(count[1]) < 1 || /\b(?:failures|errors|skipped)=["'][1-9]\d*["']/.test(attributes)) {
      throw new Error('Runtime report is empty, failed, or skipped');
    }
    declaredTests += Number(count[1]);
  }
  if (declaredTests !== cases.length) throw new Error('Runtime report test count does not match its cases');
  for (const name of SCREENSHOTS) {
    if (!screenshotNames.includes(`${name}.png`)) throw new Error(`Missing executed-device screenshot: ${name}`);
  }
  return { tests: cases.length, screenshots: SCREENSHOTS.map((name) => `${name}.png`) };
}

export function verifyAgentArchive(bytes) {
  if (createHash('sha512').update(bytes).digest('base64') !== AGENT_DEVICE.sha512) {
    throw new Error('agent-device archive does not match the reviewed SHA-512 pin');
  }
}

async function hashFile(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

const diagnosticIdentifier = (value) => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(value) ? value : null;
const errorIdentity = (error) => ({
  errorName: diagnosticIdentifier(error?.name), errorCode: diagnosticIdentifier(error?.code),
  causeName: diagnosticIdentifier(error?.cause?.name), causeCode: diagnosticIdentifier(error?.cause?.code),
});

export function runtimeFailureDetails(error, metro) {
  return {
    ...(error.nativeRuntimeDetails ?? { phase: 'native-runtime', ...errorIdentity(error) }),
    // Snapshot before cleanup intentionally stops Metro; a cleanup SIGTERM
    // must never be mistaken for the process state that caused the failure.
    metroExitCode: metro?.exitCode ?? null,
    metroSignalCode: diagnosticIdentifier(metro?.signalCode),
  };
}

export async function hashMetroBundle(url, { log, timeout = METRO_BUNDLE_TIMEOUT_MS } = {}) {
  const target = new URL(url);
  if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1') throw new Error('Metro bundle preflight requires local HTTP');
  const started = Date.now();
  const signal = AbortSignal.timeout(timeout);
  const hash = createHash('sha256');
  let request; let firstRequestError; let firstResponseError; let bytes = 0; let httpStatus = null; let stage = 'headers';
  const timing = () => ({ elapsedMs: Date.now() - started, timeoutMs: timeout, timedOut: signal.aborted, responseBytes: bytes, httpStatus, stage });
  const record = (event, details = {}) => log?.write(`[native-http] ${JSON.stringify({ phase: 'fetch-metro-bundle', event, at: new Date().toISOString(), ...timing(), ...details })}\n`);
  record('start');
  try {
    // Node's global fetch has an independent 300s Undici headers deadline.
    // Use one local request with the existing 360s total budget, spanning
    // headers and body; no pool timeout, redirect, retry or body buffering.
    const response = await new Promise((resolveResponse, reject) => {
      request = httpGet(target, { agent: false, signal }, (incoming) => {
        incoming.once('error', (error) => { firstResponseError ??= error; });
        resolveResponse(incoming);
      });
      request.once('error', (error) => { firstRequestError ??= error; reject(error); });
    });
    httpStatus = response.statusCode;
    stage = 'body';
    record('headers');
    if (httpStatus < 200 || httpStatus >= 300) {
      response.destroy();
      throw Object.assign(new Error('Metro bundle returned an unsuccessful HTTP status'), { code: 'METRO_HTTP_STATUS' });
    }
    for await (const chunk of response) { bytes += chunk.length; hash.update(chunk); }
    if (!response.complete) throw Object.assign(new Error('Metro bundle HTTP response was incomplete'), { code: 'METRO_INCOMPLETE_RESPONSE' });
    const result = { sha256: hash.digest('hex'), ...timing() };
    record('complete');
    return result;
  } catch (caught) {
    // Aborting the request can make the body emit a later ECONNRESET. Keep
    // the first ABORT_ERR/TimeoutError instead of replacing it during cleanup.
    const cause = firstRequestError ?? firstResponseError ?? caught;
    const details = { phase: 'fetch-metro-bundle', ...timing(), ...errorIdentity(cause) };
    record('failure', errorIdentity(cause));
    throw Object.assign(new Error(`Metro bundle preflight failed (${details.errorCode ?? details.errorName ?? 'unknown'}); see native runtime log`, { cause }), { nativeRuntimeDetails: details });
  } finally {
    request?.destroy();
  }
}

export function command(executable, args, {
  env = runtimeEnvironment(process.env), log, timeout = 120_000, cwd = ROOT,
  phase = `${basename(executable)} ${args[0] ?? ''}`.trim(),
} = {}) {
  return new Promise((resolveResult, reject) => {
    const started = Date.now();
    let timedOut = false;
    const record = (event, details = {}) => log?.write(`[native-command] ${JSON.stringify({
      phase, event, at: new Date().toISOString(), elapsedMs: Date.now() - started, timeoutMs: timeout, ...details,
    })}\n`);
    record('start');
    const child = spawn(executable, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const capture = (data) => {
      log?.write(data);
      // Device inventories and tool diagnostics are bounded; full output stays in the log.
      if (output.length < 2_000_000) output += data.toString();
    };
    child.stdout.on('data', capture); child.stderr.on('data', (data) => log?.write(data));
    const timer = setTimeout(() => {
      timedOut = true; record('deadline', { signal: 'SIGTERM' }); child.kill('SIGTERM');
    }, timeout);
    const killTimer = setTimeout(() => { record('force-kill', { signal: 'SIGKILL' }); child.kill('SIGKILL'); }, timeout + 10_000);
    child.on('error', (error) => {
      clearTimeout(timer); clearTimeout(killTimer); record('spawn-error', { message: error.message }); reject(error);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer); clearTimeout(killTimer);
      record('exit', { code, signal, timedOut });
      if (timedOut) reject(new Error(`${phase} exceeded its ${timeout}ms process deadline (${signal ?? code}); see native runtime log`));
      else if (code !== 0) reject(new Error(`${phase} failed (${signal ?? code}); see native runtime log`));
      else resolveResult(output.trim());
    });
  });
}

async function installAgent(temp, log) {
  const location = await mkdtemp(join(temp, 'moyo-agent-device-'));
  const response = await fetch(AGENT_DEVICE.url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Pinned agent-device download failed (${response.status})`);
  const archive = Buffer.from(await response.arrayBuffer());
  verifyAgentArchive(archive);
  const archivePath = join(location, 'agent-device.tgz');
  await writeFile(archivePath, archive);
  await command('tar', ['-xzf', archivePath, '-C', location], { log });
  const manifest = JSON.parse(await readFile(join(location, 'package/package.json'), 'utf8'));
  if (manifest.name !== 'agent-device' || manifest.version !== AGENT_DEVICE.version) throw new Error('Unexpected device tool identity');
  return join(location, 'package/bin/agent-device.mjs');
}

async function startAnonymousApi(log) {
  const server = createServer((request, response) => {
    const result = anonymousApiReply(request.method, request.url);
    log.write(`${request.method} ${new URL(request.url, 'http://127.0.0.1').pathname} ${result.status}\n`);
    response.writeHead(result.status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(result.body);
  });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(API_PORT, '127.0.0.1', resolveListen);
  });
  return server;
}

async function waitForMetro(child) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error('Metro exited before readiness');
    try {
      const response = await fetch(`http://127.0.0.1:${METRO_PORT}/status`, { signal: AbortSignal.timeout(2000) });
      if (response.ok && (await response.text()).trim() === 'packager-status:running') return;
    } catch { /* The server has not bound yet. */ }
    await delay(1000);
  }
  throw new Error('Metro readiness timed out');
}

async function stopMetro(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch { return; }
  for (let attempt = 0; attempt < 30 && child.exitCode === null && child.signalCode === null; attempt += 1) await delay(100);
  if (child.exitCode === null && child.signalCode === null) {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Already exited. */ }
  }
}

async function main() {
  const { values } = parseArgs({ options: {
    platform: { type: 'string' }, app: { type: 'string' }, artifacts: { type: 'string' }, serial: { type: 'string' },
  } });
  if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.RUNNER_TEMP) throw new Error('Run only on an isolated GitHub Actions runner');
  if (!['ios', 'android'].includes(values.platform) || !values.app || !values.artifacts) throw new Error('Expected --platform ios|android --app <built artifact> --artifacts <directory>');
  if ((values.platform === 'ios' && process.platform !== 'darwin') || (values.platform === 'android' && process.platform !== 'linux')) {
    throw new Error('The selected platform requires its native hosted runner');
  }
  const artifacts = resolve(values.artifacts);
  await mkdir(dirname(artifacts), { recursive: true });
  // Refuse a reused directory so stale screenshots/reports cannot satisfy a new run.
  await mkdir(artifacts);
  const log = createWriteStream(join(artifacts, 'runtime.log'));
  const metroLog = createWriteStream(join(artifacts, 'metro.log'));
  const apiLog = createWriteStream(join(artifacts, 'anonymous-api.log'));
  const receiptPath = join(artifacts, 'receipt.json');
  const receipt = {
    schema: 1, status: 'running', startedAt: new Date().toISOString(), platform: values.platform,
    sourceCommit: await command('git', ['rev-parse', 'HEAD']),
    pullRequestHead: process.env.MOYO_PR_HEAD_SHA ?? null,
    runUrl: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    tool: AGENT_DEVICE, appId: APP_ID, flowBudget: RUNTIME_TEST_BUDGET,
    pnpmLockSha256: await hashFile(join(ROOT, 'pnpm-lock.yaml')),
    flowSha256: await hashFile(FLOW),
    limitations: [
      'Virtual-device execution only; not physical hardware, touch latency, thermal or frame-budget acceptance.',
      'Android uses SwiftShader. A software adapter is recorded in screenshots, not represented as a hardware-GPU pass.',
      'iOS tests the existing SwiftPM/Ganesh app, not a CocoaPods/Graphite or visionOS build.',
      'The existing rendering/lifecycle route is exercised anonymously; no customer, student, billing or production fixture is used.',
      'Positive FPS proves the native render loop executes; retained screenshots still require visual inspection.',
    ],
  };
  let agent; let agentState; let agentEnv; let metro; let server; let deviceFlags; let failure;
  const saveReceipt = () => writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  try {
    await saveReceipt();
    const artifact = resolve(values.app);
    const binary = values.platform === 'ios' ? join(artifact, 'Moyo') : artifact;
    receipt.binary = { path: artifact, sha256: await hashFile(binary), size: statSync(binary).size };
    if (values.platform === 'ios') {
      const bundleId = await command('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleIdentifier', join(artifact, 'Info.plist')], { log, phase: 'verify-ios-bundle' });
      if (bundleId !== APP_ID) throw new Error('The built simulator app has a different bundle identifier');
      const architecture = await command('lipo', ['-archs', binary], { log, phase: 'verify-ios-architecture' });
      if (process.arch !== 'arm64' || !architecture.split(/\s+/).includes('arm64')) throw new Error('Expected the admitted arm64 simulator app and runner');
      receipt.device = selectIpad(JSON.parse(await command('xcrun', ['simctl', 'list', 'devices', 'available', '--json'], { log, phase: 'select-ipad-simulator' })));
      receipt.binary.architectures = architecture;
      deviceFlags = ['--platform', 'ios', '--udid', receipt.device.udid];
    } else {
      const serial = values.serial ?? 'emulator-5554';
      const qemu = await command('adb', ['-s', serial, 'shell', 'getprop', 'ro.kernel.qemu']);
      const abis = await command('adb', ['-s', serial, 'shell', 'getprop', 'ro.product.cpu.abilist']);
      receipt.device = assertAndroidEmulator(serial, qemu, abis);
      receipt.device.apiLevel = await command('adb', ['-s', serial, 'shell', 'getprop', 'ro.build.version.sdk']);
      receipt.device.buildFingerprint = await command('adb', ['-s', serial, 'shell', 'getprop', 'ro.build.fingerprint']);
      deviceFlags = ['--platform', 'android', '--serial', serial];
      for (const port of [METRO_PORT, API_PORT]) await command('adb', ['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`], { log });
    }
    await saveReceipt();
    agent = await installAgent(process.env.RUNNER_TEMP, log);
    agentState = await mkdtemp(join(process.env.RUNNER_TEMP, 'moyo-device-state-'));
    agentEnv = agentEnvironment(process.env, agentState);
    if (values.platform === 'ios') {
      receipt.startupBudget = IOS_STARTUP_BUDGET;
      await saveReceipt();
      // Daemon attachment precedes the tool's boot deadline. The outer limit
      // must cover both budgets plus shutdown/scheduling margin on a cold VM.
      await command(process.execPath, [agent, 'boot', ...deviceFlags, '--timeout', String(IOS_STARTUP_BUDGET.bootMs)], {
        env: agentEnv, log, phase: 'boot-ipad-simulator', timeout: IOS_STARTUP_BUDGET.processMs,
      });
    }
    await command(process.execPath, [agent, 'install', APP_ID, artifact, ...deviceFlags], { env: agentEnv, log, phase: 'install-native-app', timeout: 500_000 });
    server = await startAnonymousApi(apiLog);
    metro = spawn('pnpm', ['--filter', 'mobile', 'exec', 'expo', 'start', '--localhost', '--port', String(METRO_PORT)], {
      cwd: ROOT, env: metroEnvironment(process.env), detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    metro.stdout.pipe(metroLog, { end: false }); metro.stderr.pipe(metroLog, { end: false });
    metro.on('error', (error) => { log.write(`Metro process error: ${error.message}\n`); });
    await waitForMetro(metro);
    const bundleUrl = `http://127.0.0.1:${METRO_PORT}/.expo/.virtual-metro-entry.bundle?platform=${values.platform}&dev=true&minify=false`;
    const bundle = await hashMetroBundle(bundleUrl, { log });
    receipt.metroBundleSha256 = bundle.sha256;
    receipt.metroBundleRequest = bundle;
    const junit = join(artifacts, 'junit.xml');
    // A long Metro bundle can outlast the daemon's idle window. Its fresh
    // attachment precedes the unchanged per-attempt test deadline too.
    await command(process.execPath, [agent, 'test', FLOW, '--maestro', ...deviceFlags,
      '--metro-host', '127.0.0.1', '--metro-port', String(METRO_PORT),
      '--env', `EVIDENCE_DIR=${artifacts}`, '--timeout', String(RUNTIME_TEST_BUDGET.flowMs), '--retries', '0',
      '--artifacts-dir', join(artifacts, 'attempts'), '--reporter', 'default', '--reporter', `junit:${junit}`,
    ], { env: agentEnv, log, phase: 'execute-render-lifecycle', timeout: RUNTIME_TEST_BUDGET.processMs });
    receipt.evidence = verifyRuntimeEvidence(await readFile(junit, 'utf8'), readdirSync(artifacts));
    for (const screenshot of receipt.evidence.screenshots) {
      const bytes = await readFile(join(artifacts, screenshot));
      if (!bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) || bytes.length < 100) throw new Error(`Invalid screenshot: ${screenshot}`);
    }
    receipt.status = 'passed';
  } catch (error) {
    receipt.status = 'failed'; receipt.failure = error.message; failure = error;
    receipt.failureDetails = runtimeFailureDetails(error, metro);
  } finally {
    if (failure && receipt.device?.kind === 'Android emulator') {
      await retainAndroidFailureDiagnostics(receipt.device, artifacts)
        .then((diagnostics) => { receipt.androidFailureDiagnostics = diagnostics; })
        .catch((error) => { receipt.androidDiagnosticsWarning = error.message; });
    }
    await stopMetro(metro);
    if (server) { server.closeAllConnections(); await new Promise((done) => server.close(done)); }
    if (agent && agentEnv) {
      await command(process.execPath, [agent, 'daemon', 'stop', '--clean'], { env: agentEnv, log, phase: 'stop-device-daemon', timeout: 30_000 }).catch((error) => { receipt.cleanupWarning = error.message; });
      await retainAgentDiagnostics(agentState, join(artifacts, 'device-tool'))
        .then((files) => { receipt.toolDiagnosticFiles = files; })
        .catch((error) => { receipt.toolDiagnosticsWarning = error.message; });
    }
    // The Android action owns emulator shutdown. This job owns only its chosen iPad.
    if (receipt.device?.udid) await command('xcrun', ['simctl', 'shutdown', receipt.device.udid], { log, phase: 'shutdown-ipad-simulator', timeout: 30_000 }).catch(() => {});
    receipt.finishedAt = new Date().toISOString();
    await saveReceipt();
    for (const stream of [log, metroLog, apiLog]) await new Promise((done) => stream.end(done));
  }
  console.log(`Native runtime ${receipt.status}: ${receiptPath}`);
  if (failure) throw failure;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
