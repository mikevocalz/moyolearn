import assert from 'node:assert/strict';
import test from 'node:test';
import { parseForgePenDiagnostics } from './forge-pen-diagnostics.ts';

const snapshot = (extra = {}) => JSON.stringify({ version: 1, connected: true, connectionGeneration: 2, servicesState: 'ready', totalNotifications: 0, lastSequence: 0, services: [], events: [], ...extra });

test('observed zero bytes and timestamps remain raw, without decoded pen claims', () => {
  const result = parseForgePenDiagnostics(snapshot({ totalNotifications: 1, lastSequence: 0, bondState: 10, capturing: false, blocked: false,
    events: [{ sequence: 0, connectionGeneration: 2, elapsedRealtimeMs: 0, kind: 'notification', status: 0, byteLength: 2, hex: '0000' }],
  }));
  assert.equal(result.totalNotifications, 1);
  assert.equal(result.bondState, 10);
  assert.equal(result.nativeCapturing, false);
  assert.equal(result.blocked, false);
  assert.equal(result.events[0], '#0 t=0ms generation=2 notification status=0 bytes=2 hex=0000');
  assert.equal('pressure' in result, false);
  assert.equal('buttons' in result, false);
  assert.equal('tracked' in result, false);
});

test('the actual opaque characteristic and descriptor keys remain unchanged', () => {
  const result = parseForgePenDiagnostics(snapshot({ services: [{ uuid: 'actual-service', characteristics: [
    { key: 'opaque:characteristic:1', uuid: 'actual-characteristic', properties: 0x12, descriptors: [{ key: 'opaque:descriptor:2', uuid: 'actual-descriptor' }] },
    { key: null, uuid: 'invalid', properties: 0 },
  ] }] }));
  assert.deepEqual(result.characteristics, [{ key: 'opaque:characteristic:1', uuid: 'actual-characteristic', serviceUuid: 'actual-service', properties: 0x12, descriptors: [{ key: 'opaque:descriptor:2', uuid: 'actual-descriptor' }] }]);
});

test('event display stays bounded and preserves native truncation flags', () => {
  const events = Array.from({ length: 200 }, (_, sequence) => ({ sequence, connectionGeneration: 2, elapsedRealtimeMs: sequence, kind: 'notification', hex: '0'.repeat(2000), truncated: true }));
  const result = parseForgePenDiagnostics(snapshot({ events }));
  assert.equal(result.events.length, 32);
  assert.ok(result.events[0]?.startsWith('#168 '));
  assert.ok(result.events.at(-1)?.includes('[truncated]'));
  assert.ok(result.events.every((event) => event.length < 1200));
});

test('invalid snapshots and incomplete events do not produce synthetic measurements', () => {
  for (const json of ['not json', '{}', snapshot({ version: 2 }), snapshot({ connectionGeneration: null }), ' '.repeat(1024 * 1024 + 1)]) assert.throws(() => parseForgePenDiagnostics(json));
  const result = parseForgePenDiagnostics(snapshot({ events: [{ kind: 'notification', hex: '00' }, null] }));
  assert.deepEqual(result.events, []);
});


test('inventory limits are explicit rather than silently dropping later discovered characteristics', () => {
  const characteristics = Array.from({ length: 300 }, (_, id) => ({ key: `actual-${id}`, uuid: `uuid-${id}`, properties: 2 }));
  const result = parseForgePenDiagnostics(snapshot({ services: [{ uuid: 'actual-service', characteristics }] }));
  assert.equal(result.characteristics.length, 256);
  assert.equal(result.characteristics.at(-1)?.key, 'actual-255');
  assert.equal(result.inventoryTruncated, true);
  assert.equal(parseForgePenDiagnostics(snapshot({ inventoryTruncated: true })).inventoryTruncated, true);
});
