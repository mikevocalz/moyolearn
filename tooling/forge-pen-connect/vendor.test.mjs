import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes, createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Exercise the actual vendored adapter while substituting only the OS boundary.
const path = new URL('../../node_modules/@nitro-forge/pen-connect/src/android-ble.native.ts', import.meta.url);
const source = readFileSync(path, 'utf8').replace(
  'import { PermissionsAndroid, Platform } from "react-native";',
  'const Platform = {OS:"android",Version:34}; const PermissionsAndroid = {RESULTS:{GRANTED:"granted"},requestMultiple:async()=>({"android.permission.BLUETOOTH_SCAN":"granted","android.permission.BLUETOOTH_CONNECT":"granted"})};',
);
const { createAndroidBlePenPort } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);

test('cancelled scan completion cannot stop a newer actual adapter scan', async () => {
  let starts = 0;
  let stops = 0;
  const native = {
    startScan() { starts++; }, stopScan() { stops++; },
    getDevicesJson: () => '[]', getScanError: () => '',
  };
  const port = createAndroidBlePenPort(native);
  const oldScan = port.scan();
  port.cancelScan();
  const nextScan = port.scan();
  await oldScan;
  assert.equal(starts, 2);
  assert.equal(stops, 1, 'old finally must not stop the new scanner');
  port.cancelScan();
  await nextScan;
  assert.equal(stops, 2);
});

test('Bluetooth artifact exposes public construction and exactly the host runtime', () => {
  const manifest = JSON.parse(readFileSync(new URL('../../node_modules/@nitro-forge/bluetooth-v1/package.json', import.meta.url)));
  const host = JSON.parse(readFileSync(new URL('../../node_modules/react-native-nitro-modules/package.json', import.meta.url)));
  assert.equal(manifest.peerDependencies['react-native-nitro-modules'], host.version);
  const spec = readFileSync(new URL('../../node_modules/@nitro-forge/bluetooth-v1/src/specs/ForgeBluetooth.nitro.ts', import.meta.url), 'utf8');
  assert.match(spec, /constructor\(\);/);
});

test('closing during connection cancels the pending native GATT attempt immediately', async () => {
  let disconnects = 0;
  let rejectConnect;
  const native = {
    stopScan() {},
    connect: () => new Promise((_, reject) => { rejectConnect = reject; }),
    disconnect() { disconnects++; rejectConnect(new Error('Bluetooth connection cancelled')); },
  };
  const port = createAndroidBlePenPort(native);
  const connecting = port.connect('scanned-device');
  port.cancelScan();
  assert.equal(disconnects, 1);
  await assert.rejects(connecting, /cancelled/);
  port.cancelScan();
  assert.equal(disconnects, 1, 'repeated cancellation does not close an unrelated link');
});


test('consumed Bluetooth archive matches frozen lock integrity and every installed source byte', () => {
  const require = createRequire(import.meta.url);
  const { parse } = require('yaml');
  const root = new URL('../../', import.meta.url);
  const receipt = JSON.parse(readFileSync(new URL('vendors/forge-source-lock.json', root), 'utf8'))['bluetooth-v1'];
  const archive = new URL(`vendors/${receipt.file}`, root);
  const bytes = readFileSync(archive);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.sha256);
  const lock = parse(readFileSync(new URL('pnpm-lock.yaml', root), 'utf8'));
  const entry = Object.values(lock.packages).find((value) => value.resolution?.tarball === `file:vendors/${receipt.file}`);
  assert.ok(entry, 'archive must be present in frozen dependency lock');
  assert.equal(entry.resolution.integrity, `sha512-${createHash('sha512').update(bytes).digest('base64')}`);
  const names = execFileSync('tar', ['-tzf', fileURLToPath(archive)], { encoding: 'utf8' }).trim().split('\n');
  for (const name of names.filter((name) => !name.endsWith('/'))) {
    assert.ok(name.startsWith('package/') && !name.split('/').includes('..'));
    const expected = execFileSync('tar', ['-xOf', fileURLToPath(archive), name]);
    const installed = readFileSync(new URL(`node_modules/@nitro-forge/bluetooth-v1/${name.slice(8)}`, root));
    assert.ok(expected.equals(installed), `installed source must match packed bytes: ${name}`);
  }
});

test('consumed portable archive matches frozen lock integrity and every installed source byte', () => {
  const require = createRequire(import.meta.url);
  const { parse } = require('yaml');
  const root = new URL('../../', import.meta.url);
  const receipt = JSON.parse(readFileSync(new URL('vendors/forge-source-lock.json', root), 'utf8'))['pen-connect'];
  const archive = new URL(`vendors/${receipt.file}`, root);
  const bytes = readFileSync(archive);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.sha256);
  const lock = parse(readFileSync(new URL('pnpm-lock.yaml', root), 'utf8'));
  const entry = Object.values(lock.packages).find((value) => value.resolution?.tarball === `file:vendors/${receipt.file}`);
  assert.ok(entry, 'archive must be present in frozen dependency lock');
  assert.equal(entry.resolution.integrity, `sha512-${createHash('sha512').update(bytes).digest('base64')}`);
  const names = execFileSync('tar', ['-tzf', fileURLToPath(archive)], { encoding: 'utf8' }).trim().split('\n');
  for (const name of names.filter((name) => !name.endsWith('/'))) {
    assert.ok(name.startsWith('package/') && !name.split('/').includes('..'));
    const expected = execFileSync('tar', ['-xOf', fileURLToPath(archive), name]);
    const installed = readFileSync(new URL(`node_modules/@nitro-forge/pen-connect/${name.slice(8)}`, root));
    assert.ok(expected.equals(installed), `installed source must match packed bytes: ${name}`);
  }
});

test('actual adapter preserves OS-bonded selection without fabricating an RSSI', async () => {
  const native = {
    startScan() {}, stopScan() {}, getScanError: () => '',
    getDevicesJson: () => JSON.stringify([
      { id: 'actual-bonded', name: 'Actual bonded peripheral', bonded: true },
      { id: 'actual-scan', name: 'Actual advertiser', bonded: false, rssi: -61 },
    ]),
  };
  const devices = await createAndroidBlePenPort(native, { scanDurationMs: 500 }).scan();
  assert.deepEqual(devices, [
    { id: 'actual-bonded', name: 'Actual bonded peripheral', bonded: true },
    { id: 'actual-scan', name: 'Actual advertiser', bonded: false, rssi: -61 },
  ]);
  assert.equal(Object.hasOwn(devices[0], 'rssi'), false);
});
