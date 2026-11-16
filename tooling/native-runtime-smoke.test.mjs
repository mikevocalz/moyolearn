// Fail-closed evidence and target selection contracts. No simulated device pass.
// SOT: tooling/native-runtime-smoke.mjs
// SOT-KEYWORDS: native runtime acceptance evidence emulator simulator tests
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  AGENT_DEVICE, anonymousApiReply, assertAndroidEmulator, metroEnvironment, runtimeEnvironment,
  selectIpad, verifyAgentArchive, verifyRuntimeEvidence,
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
