// Fail-closed evidence and target selection contracts. No simulated device pass.
// SOT: tooling/native-runtime-smoke.mjs
// SOT-KEYWORDS: native runtime acceptance evidence emulator simulator tests
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AGENT_DEVICE, IOS_STARTUP_BUDGET, RUNTIME_TEST_BUDGET, agentEnvironment, anonymousApiReply, assertAndroidEmulator, command, metroEnvironment, runtimeEnvironment,
  retainAgentDiagnostics, retainAndroidFailureDiagnostics, selectIpad, verifyAgentArchive, verifyRuntimeEvidence,
} from './native-runtime-smoke.mjs';

const file = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const udid = '11111111-2222-3333-4444-555555555555';
const device = (name, overrides = {}) => ({ name, udid, isAvailable: true, ...overrides });
const screenshots = ['01-adapter.png', '02-triangle.png', '03-cube.png', '04-resumed-cube.png', '05-cold-cube.png'];
const passed = '<testsuites><testsuite tests="1" failures="0" skipped="0"><testcase name="render-lifecycle"><system-out>status: passed</system-out></testcase></testsuite></testsuites>';

test('selects an actual available iPad on the newest installed iOS runtime', () => {
  const result = selectIpad({ devices: {
    'com.apple.CoreSimulator.SimRuntime.iOS-26-5': [device('iPad (A16)')],
    'com.apple.CoreSimulator.SimRuntime.iOS-27-1': [device('iPhone 18'), device('iPad Pro 13-inch (M5)')],
    'com.apple.CoreSimulator.SimRuntime.visionOS-27-1': [device('iPad invalid platform')],
  } });
  assert.equal(result.runtime, 'com.apple.CoreSimulator.SimRuntime.iOS-27-1');
  assert.equal(result.name, 'iPad Pro 13-inch (M5)');
  assert.equal(result.udid, udid);
  assert.equal(result.kind, 'iPad simulator');
});

test('does not substitute an iPhone, unavailable iPad, or guessed target for iPad acceptance', () => {
  for (const devices of [[], [device('iPhone 18')], [device('iPad', { isAvailable: false })], [device('iPad', { udid: 'booted' })]]) {
    assert.throws(() => selectIpad({ devices: { 'com.apple.CoreSimulator.SimRuntime.iOS-27-1': devices } }), /No available iPad/);
  }
});

test('refuses physical devices and mismatched emulator ABI before clearing application state', () => {
  assert.equal(assertAndroidEmulator('emulator-5554', '1\n', 'x86_64,x86\n').graphics, 'SwiftShader software GPU');
  for (const args of [['physical-usb-id', '1', 'x86_64'], ['emulator-5554', '0', 'x86_64'], ['emulator-5554', '1', 'arm64-v8a']]) {
    assert.throws(() => assertAndroidEmulator(...args), /CI-owned x86_64 Android emulator/);
  }
});

test('anonymous CI service exposes no account, fixture, or write operation', () => {
  assert.deepEqual(anonymousApiReply('GET', '/api/auth/get-session?disableCookieCache=true'), { status: 200, body: 'null' });
  for (const [method, path] of [['POST', '/api/auth/get-session'], ['POST', '/api/auth/sign-up/email'], ['GET', '/api/students'], ['GET', '/api/billing'], ['GET', '/']]) {
    assert.equal(anonymousApiReply(method, path).status, 503);
  }
});

test('Metro cannot inherit production application URLs, telemetry, or demo-auth mode', () => {
  const environment = runtimeEnvironment({
    PATH: '/toolchain', EXPO_PUBLIC_APP_URL: 'https://app.moyolearn.com', NEXT_PUBLIC_APP_URL: 'https://app.moyolearn.com',
    EXPO_PUBLIC_AUTH_URL: 'https://app.moyolearn.com', NEXT_PUBLIC_AUTH_URL: 'https://app.moyolearn.com',
    EXPO_PUBLIC_AUTH_MODE: 'mock', NEXT_PUBLIC_AUTH_MODE: 'mock',
    EXPO_PUBLIC_SENTRY_DSN: 'configured', EXPO_PUBLIC_SENTRY_DSN_MOBILE: 'configured',
  });
  for (const key of ['EXPO_PUBLIC_APP_URL', 'NEXT_PUBLIC_APP_URL', 'EXPO_PUBLIC_AUTH_URL', 'NEXT_PUBLIC_AUTH_URL']) {
    assert.equal(environment[key], 'http://127.0.0.1:39001');
  }
  assert.equal(environment.EXPO_PUBLIC_AUTH_MODE, 'live');
  assert.equal(environment.NEXT_PUBLIC_AUTH_MODE, 'live');
  assert.equal(environment.EXPO_NO_DOTENV, '1');
  assert.equal(environment.EXPO_NO_TELEMETRY, '1');
  assert.equal(environment.DO_NOT_TRACK, '1');
  assert.equal(environment.TURBO_TELEMETRY_DISABLED, '1');
  assert.equal(environment.NEXT_TELEMETRY_DISABLED, '1');
  assert.equal(environment.EXPO_PUBLIC_SENTRY_DSN, '');
  assert.equal(environment.EXPO_PUBLIC_SENTRY_DSN_MOBILE, '');
  assert.equal(environment.PATH, '/toolchain');
});

test('Metro keeps Node settings and resolves a real localhost listener on the IPv4 bridge', () => {
  const inherited = '--max-old-space-size=256 --dns-result-order=verbatim';
  const environment = metroEnvironment({ ...process.env, NODE_OPTIONS: inherited });
  assert.equal(environment.NODE_OPTIONS, `${inherited} --dns-result-order=ipv4first`);
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { createServer } from 'node:http';
    const server = createServer((_request, response) => response.end('packager-status:running'));
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, 'localhost', resolve);
    });
    try {
      const address = server.address();
      const response = await fetch('http://127.0.0.1:' + address.port, { signal: AbortSignal.timeout(2000) });
      console.log(JSON.stringify({ address: address.address, status: await response.text() }));
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  `], { env: environment, encoding: 'utf8', timeout: 10_000 });
  assert.equal(child.error, undefined);
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), { address: '127.0.0.1', status: 'packager-status:running' });
});

test('isolates device state and gives cold boot both daemon and device startup budgets', () => {
  const environment = agentEnvironment({ AGENT_DEVICE_STATE_DIR: '/unrelated', AGENT_DEVICE_EXEC_TRACE: '0', AGENT_DEVICE_DAEMON_STARTUP_TIMEOUT_MS: '1' }, '/ci-owned/state');
  assert.equal(environment.AGENT_DEVICE_STATE_DIR, '/ci-owned/state');
  assert.equal(environment.AGENT_DEVICE_EXEC_TRACE, '1');
  assert.equal(Number(environment.AGENT_DEVICE_DAEMON_STARTUP_TIMEOUT_MS), IOS_STARTUP_BUDGET.daemonMs);
  assert.ok(IOS_STARTUP_BUDGET.processMs > IOS_STARTUP_BUDGET.daemonMs + IOS_STARTUP_BUDGET.bootMs);
  assert.ok(IOS_STARTUP_BUDGET.processMs < 15 * 60_000, 'cold startup remains bounded');
  assert.equal(RUNTIME_TEST_BUDGET.flowMs, 600_000, 'the rendering flow keeps its existing deadline');
  assert.equal(RUNTIME_TEST_BUDGET.reportingMs, 60_000);
  assert.equal(RUNTIME_TEST_BUDGET.processMs, IOS_STARTUP_BUDGET.daemonMs + RUNTIME_TEST_BUDGET.flowMs + RUNTIME_TEST_BUDGET.reportingMs);
  const harness = file('./native-runtime-smoke.mjs');
  assert.match(harness, /'--timeout', String\(RUNTIME_TEST_BUDGET.flowMs\), '--retries', '0'/);
  assert.match(harness, /phase: 'execute-render-lifecycle', timeout: RUNTIME_TEST_BUDGET.processMs/);
});

function commandLog() {
  let output = '';
  return {
    log: { write: (chunk) => { output += chunk.toString(); } },
    events: () => output.split('\n').filter((line) => line.startsWith('[native-command] ')).map((line) => JSON.parse(line.slice('[native-command] '.length))),
    output: () => output,
  };
}

test('a real child completing before its deadline records phase, timing and output', async () => {
  const capture = commandLog();
  assert.equal(await command(process.execPath, ['-e', 'console.log("ready")'], { phase: 'startup-probe', log: capture.log, timeout: 2000 }), 'ready');
  const events = capture.events();
  assert.deepEqual(events.map((event) => event.event), ['start', 'exit']);
  assert.ok(events.every((event) => event.phase === 'startup-probe' && event.timeoutMs === 2000));
  assert.ok(events[1].elapsedMs >= 0);
  assert.equal(events[1].code, 0);
  assert.equal(events[1].timedOut, false);
});

test('a harness deadline fails even when the real child handles SIGTERM and exits zero', async () => {
  const capture = commandLog();
  await assert.rejects(command(process.execPath, ['-e', `
    process.on('SIGTERM', () => process.exit(0));
    console.log('handler-ready');
    setInterval(() => {}, 1000);
  `], { phase: 'cold-boot-probe', log: capture.log, timeout: 1500 }), /cold-boot-probe exceeded its 1500ms process deadline/);
  assert.match(capture.output(), /handler-ready/);
  const events = capture.events();
  assert.deepEqual(events.map((event) => event.event), ['start', 'deadline', 'exit']);
  assert.equal(events.at(-1).code, 0);
  assert.equal(events.at(-1).timedOut, true);
});

test('an external SIGTERM remains distinguishable from the harness deadline', async () => {
  const capture = commandLog();
  await assert.rejects(command(process.execPath, ['-e', "process.kill(process.pid, 'SIGTERM')"], {
    phase: 'external-stop-probe', log: capture.log, timeout: 2000,
  }), /external-stop-probe failed \(SIGTERM\)/);
  assert.deepEqual(capture.events().map((event) => event.event), ['start', 'exit']);
  assert.equal(capture.events().at(-1).timedOut, false);
});

test('retains only documented diagnostic logs without daemon credentials or symlink escapes', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'moyo-device-diagnostics-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const state = join(root, 'state'); const destination = join(root, 'artifacts');
  const write = (path, contents) => { mkdirSync(join(state, path, '..'), { recursive: true }); writeFileSync(join(state, path), contents); };
  write('daemon.log', 'daemon startup timing');
  write('sessions/default/runner.log', 'xcodebuild timing');
  write('sessions/default/requests/request-1.ndjson', '{"phase":"bootstatus"}\n');
  const privateFiles = ['daemon.json', 'daemon.lock', 'auth.json', 'sessions/default/session.json', 'sessions/default/requests/token.json', 'cache/runner.log'];
  for (const path of privateFiles) write(path, 'DO NOT UPLOAD');
  symlinkSync(join(state, 'auth.json'), join(state, 'sessions/default/requests/escape.ndjson'));
  symlinkSync(join(state, 'cache'), join(state, 'sessions/foreign'));
  assert.deepEqual(await retainAgentDiagnostics(state, destination), [
    'daemon.log', 'sessions/default/requests/request-1.ndjson', 'sessions/default/runner.log',
  ]);
  for (const path of [...privateFiles, 'sessions/foreign/runner.log', 'sessions/default/requests/escape.ndjson']) assert.equal(existsSync(join(destination, path)), false);
  assert.equal(readFileSync(join(destination, 'sessions/default/runner.log'), 'utf8'), 'xcodebuild timing');
  assert.deepEqual(await retainAgentDiagnostics(join(root, 'missing'), destination), []);
});

test('Android failure diagnostics refuse unverified targets before invoking adb', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'moyo-android-target-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const target of [undefined, { kind: 'Android emulator', serial: 'physical-usb-id', abis: ['x86_64'] },
    { kind: 'Android emulator', serial: 'emulator-5554', abis: ['arm64-v8a'] }]) {
    await assert.rejects(retainAndroidFailureDiagnostics(target, join(root, 'artifacts')), /already-verified CI emulator/);
  }
  assert.equal(existsSync(join(root, 'artifacts')), false);
});

test('failed Android diagnostic collection stays bounded and still retains the other OS report', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'moyo-android-diagnostics-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, 'bin'); mkdirSync(bin);
  const calls = join(root, 'calls.jsonl');
  const adb = join(bin, 'adb');
  writeFileSync(adb, `#!${process.execPath}
    const fs = require('node:fs');
    const args = process.argv.slice(2);
    fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify(args) + '\\n');
    if (args.includes('logcat')) {
      process.stdout.write('crash-diagnostic\\n' + 'x'.repeat(600 * 1024));
      process.exitCode = 17;
    } else { console.log('app-exit-reason'); }
  `);
  chmodSync(adb, 0o755);
  const destination = join(root, 'artifacts');
  const result = await retainAndroidFailureDiagnostics(assertAndroidEmulator('emulator-5554', '1', 'x86_64,arm64-v8a'), destination, {
    env: { ...runtimeEnvironment(process.env), PATH: bin },
  });
  assert.deepEqual(readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse), [
    ['-s', 'emulator-5554', 'logcat', '-b', 'crash', '-d', '-v', 'threadtime', '-t', '400'],
    ['-s', 'emulator-5554', 'shell', 'dumpsys', 'activity', 'exit-info', 'com.moyolearn.app'],
  ]);
  assert.deepEqual(result.files, ['android-crash.log', 'android-app-exit-info.log']);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /android-crash-buffer failed \(17\)/);
  const crash = readFileSync(join(destination, result.files[0]));
  assert.ok(crash.length < 513 * 1024);
  assert.match(crash.toString(), /crash-diagnostic/);
  assert.match(crash.toString(), /truncated at 512 KiB/);
  const exit = readFileSync(join(destination, result.files[1]), 'utf8');
  assert.match(exit, /app-exit-reason/);
  assert.match(exit, /"timeoutMs":20000/);
  assert.match(exit, /"timedOut":false/);
});

test('requires actual non-skipped test cases and every execution screenshot', () => {
  assert.deepEqual(verifyRuntimeEvidence(passed, screenshots), { tests: 1, screenshots });
  for (const report of [
    '', '<testsuites/>', '<testsuites><testsuite tests="0"></testsuite></testsuites>',
    passed.replace('tests="1"', 'tests="2"'),
    passed.replace('<system-out>', '<failure/> <system-out>'),
    passed.replace('<system-out>', '<error/> <system-out>'),
    passed.replace('skipped="0"', 'skipped="1"'),
    passed.replace('<system-out>', '<skipped/> <system-out>'),
    passed.slice(0, passed.indexOf('</testcase>')),
  ]) assert.throws(() => verifyRuntimeEvidence(report, screenshots), /Runtime report/);
  assert.throws(() => verifyRuntimeEvidence(passed, screenshots.slice(0, -1)), /Missing executed-device screenshot/);
});

test('rejects altered device-tool archives before extraction or execution', () => {
  assert.equal(AGENT_DEVICE.url, `https://registry.npmjs.org/agent-device/-/agent-device-${AGENT_DEVICE.version}.tgz`);
  assert.equal(Buffer.from(AGENT_DEVICE.sha512, 'base64').length, 64);
  assert.throws(() => verifyAgentArchive(Buffer.from('a successful HTTP response is not integrity proof')), /SHA-512 pin/);
});

test('flow requires triangle presentation and new positive frame output after resume and relaunch', () => {
  const flow = file('./fixtures/native-runtime/render-lifecycle.yaml');
  assert.match(flow, /openLink: moyo:\/\/native-3d-smoke/);
  assert.match(flow, /triangle: submitted and presented at \[1-9\]/);
  assert.equal((flow.match(/visible: '\[1-9\]\[0-9\]\* fps'/g) ?? []).length, 3);
  assert.match(flow, /pressKey: Home\n- launchApp:\n    stopApp: false[\s\S]*tapOn: Stop\n- assertNotVisible: '\[0-9\]\+ fps'[\s\S]*tapOn: Cube/);
  assert.match(flow, /stopApp\n- launchApp\n- openLink: moyo:\/\/native-3d-smoke/);
  assert.doesNotMatch(flow, /optional: true|retry:|mock|sign-in|sign-up/);
});

test('runtime workflows preserve existing native build gates and add blocking execution', () => {
  const android = file('../.github/workflows/android-native.yml');
  const ios = file('../.github/workflows/ios-native.yml');
  const [quest, emulator] = android.split('  mobile-runtime:');
  assert.match(quest, /:app:assembleQuestDebug --stacktrace --max-workers=1 --no-parallel -PreactNativeArchitectures=arm64-v8a/);
  assert.match(quest, /node tooling\/verify-native-compile-pools\.mjs/);
  assert.match(emulator, /:app:assembleMobileDebug --stacktrace --max-workers=1 --no-parallel -PreactNativeArchitectures=x86_64/);
  assert.match(emulator, /reactivecircus\/android-emulator-runner@[0-9a-f]{40}/);
  assert.match(emulator, /disable-animations: false/);
  assert.match(emulator, /-gpu swiftshader_indirect/);
  assert.match(emulator, /native-runtime-smoke\.mjs --platform android/);
  assert.match(ios, /generic\/platform=iOS Simulator/);
  assert.match(ios, /ARCHS=arm64 CODE_SIGNING_ALLOWED=NO build/);
  assert.match(ios, /native-runtime-smoke\.mjs --platform ios/);
  assert.doesNotMatch(`${ios}\n${android}`, /continue-on-error|native-runtime-smoke\.mjs[^\n]*\|\| true/);
  for (const [, reference] of emulator.matchAll(/uses: ([^\s]+)/g)) assert.match(reference, /@[0-9a-f]{40}$/);
  assert.match(ios, /runner\.temp }}\/moyo-ios-runtime/);
  assert.match(emulator, /if: always\(\)/);
  assert.match(emulator, /runner\.temp }}\/moyo-android-runtime/);
});
