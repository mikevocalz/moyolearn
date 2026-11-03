import assert from 'node:assert/strict';
import test from 'node:test';
import { createPenConnectionController } from '@nitro-forge/pen-connect';

test('real BLE controller exposes linkage without claiming Muse input readiness', async () => {
  let disconnects = 0;
  const controller = createPenConnectionController({
    mode: 'bluetooth-le', requestAccess: async () => true, ensureEnabled: async () => true,
    scan: async () => [{ id: 'actual-scan-id', name: 'Logitech Muse' }], cancelScan() {},
    connect: async () => ({ disconnect: async () => { disconnects += 1; } }),
  });
  await controller.begin();
  assert.equal(controller.state.getState().kind, 'found');
  await controller.connect('actual-scan-id');
  assert.equal(controller.state.getState().kind, 'linked');
  controller.verifyNativeInput({ tracked: true, evidence: 'visionos-spatial-stream' });
  assert.equal(controller.state.getState().kind, 'linked', 'visionOS evidence cannot verify Android BLE');
  controller.verifyNativeInput({ tracked: true, evidence: 'verified-pen-protocol', deviceId: 'unrelated' });
  assert.equal(controller.state.getState().kind, 'linked', 'another device cannot verify this link');
  await controller.cancel();
  assert.equal(controller.state.getState().kind, 'idle');
  assert.equal(disconnects, 1);
  controller.dispose();
});
