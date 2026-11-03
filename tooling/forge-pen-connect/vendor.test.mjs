import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

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
