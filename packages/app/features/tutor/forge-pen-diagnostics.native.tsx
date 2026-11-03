import { useCallback, useEffect, useRef } from 'react';
import { AppState, Modal, ScrollView } from 'react-native';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { Button, Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { parseForgePenDiagnostics, type ForgePenDiagnostics, type ForgePenDiagnosticsPort } from './forge-pen-diagnostics';

interface DiagnosticState {
  visible: boolean;
  busy: boolean;
  capturing: boolean;
  error: string | null;
  snapshot: ForgePenDiagnostics | null;
  enabled: readonly string[];
}

/** Development-only viewer for actual GATT inventory and packets from the existing connection. */
export function useForgePenDiagnostics(readPort: () => ForgePenDiagnosticsPort | null) {
  const stateRef = useRef<StoreApi<DiagnosticState> | null>(null);
  if (!stateRef.current) stateRef.current = createStore<DiagnosticState>(() => ({ visible: false, busy: false, capturing: false, error: null, snapshot: null, enabled: [] }));
  const state = stateRef.current;
  const view = useStore(state, (s) => s);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const owned = useRef<{ port: ForgePenDiagnosticsPort; generation: number; keys: Set<string> } | null>(null);
  const lastJson = useRef('');
  const stopCapture = useCallback(() => {
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null;
    state.setState({ capturing: false });
  }, [state]);
  const refresh = useCallback(() => {
    const port = readPort();
    if (!port) throw new Error('Connect a Bluetooth device first.');
    const json = port.getGattDiagnosticsJson();
    const snapshot = parseForgePenDiagnostics(json);
    if (owned.current && (owned.current.port !== port || owned.current.generation !== snapshot.connectionGeneration)) {
      owned.current = null;
      state.setState({ enabled: [] });
    }
    // Native snapshot generation time changes on reads; render only changed observations.
    const fingerprint = JSON.stringify(snapshot);
    if (fingerprint !== lastJson.current) { lastJson.current = fingerprint; state.setState({ snapshot }); }
    return { port, snapshot };
  }, [readPort, state]);
  const releaseNotifications = useCallback(() => {
    queue.current = queue.current.then(async () => {
      const held = owned.current;
      owned.current = null;
      state.setState({ enabled: [] });
      if (!held) return;
      for (const key of held.keys) {
        try {
          const snapshot = parseForgePenDiagnostics(held.port.getGattDiagnosticsJson());
          if (!snapshot.connected || snapshot.connectionGeneration !== held.generation) break;
          await held.port.setGattNotification(key, false);
        } catch (error) {
          state.setState({ error: error instanceof Error ? error.message : 'A diagnostic notification could not be disabled. Disconnect the pen to stop its stream.' });
        }
      }
      try { if (state.getState().visible) refresh(); } catch { /* The connection may have closed during cleanup. */ }
    });
  }, [refresh, state]);
  const stopNative = useCallback(() => {
    try {
      (readPort() ?? owned.current?.port)?.stopGattDiagnostics();
      if (readPort()) refresh();
    }
    catch (error) { state.setState({ error: error instanceof Error ? error.message : 'Native Bluetooth capture could not stop.' }); }
  }, [readPort, refresh, state]);
  const close = useCallback(() => {
    stopCapture();
    stopNative();
    state.setState({ visible: false });
    releaseNotifications();
  }, [releaseNotifications, state, stopCapture, stopNative]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (next) => {
      if (next !== 'active') { stopCapture(); stopNative(); releaseNotifications(); }
    });
    return () => { listener.remove(); stopCapture(); stopNative(); releaseNotifications(); };
  }, [releaseNotifications, stopCapture, stopNative]);
  const open = useCallback(() => {
    state.setState({ visible: true, error: null });
    try { refresh(); } catch (error) { state.setState({ error: error instanceof Error ? error.message : 'Bluetooth diagnostics are unavailable.' }); }
  }, [refresh, state]);
  const run = useCallback((kind: 'discover' | 'bond' | 'read' | 'descriptor' | 'enable' | 'disable', key = '') => {
    if (state.getState().busy) return;
    state.setState({ busy: true, error: null });
    queue.current = queue.current.then(async () => {
      try {
        const { port, snapshot } = refresh();
        if (!snapshot.connected) throw new Error('The Bluetooth link is disconnected.');
        if (kind === 'discover') await port.discoverGattServices();
        else if (kind === 'bond') await port.requestBond();
        else if (kind === 'read') await port.readGattCharacteristic(key);
        else if (kind === 'descriptor') await port.readGattDescriptor(key);
        else {
          await port.setGattNotification(key, kind === 'enable');
          if (!owned.current || owned.current.port !== port || owned.current.generation !== snapshot.connectionGeneration) owned.current = { port, generation: snapshot.connectionGeneration, keys: new Set() };
          if (kind === 'enable') owned.current.keys.add(key); else owned.current.keys.delete(key);
          state.setState({ enabled: [...owned.current.keys] });
        }
        refresh();
      } catch (error) { state.setState({ error: error instanceof Error ? error.message : 'Bluetooth inspection failed.' }); }
      finally { state.setState({ busy: false }); }
    });
  }, [refresh, state]);
  const capture = useCallback(() => {
    stopCapture();
    try { refresh(); } catch (error) { state.setState({ error: String(error) }); return; }
    if (AppState.currentState !== 'active') return;
    const deadline = performance.now() + 120_000;
    state.setState({ capturing: true, error: null });
    timer.current = setInterval(() => {
      if (performance.now() >= deadline || AppState.currentState !== 'active' || !state.getState().visible) { stopCapture(); stopNative(); releaseNotifications(); return; }
      try { refresh(); } catch (error) { state.setState({ error: String(error) }); stopCapture(); stopNative(); releaseNotifications(); }
    }, 250);
  }, [refresh, releaseNotifications, state, stopCapture, stopNative]);
  const dialog = (
    <Modal visible={view.visible} onRequestClose={close}>
      <View className="flex-1 bg-surface">
      <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }}>
        <Text variant="heading">Pen Bluetooth diagnostics</Text>
        <Text>Raw Bluetooth observations only. Packet bytes are not decoded as buttons, pressure or spatial tracking.</Text>
        <View className="flex-row flex-wrap gap-element">
          <Button title="Close diagnostics" onPress={close} />
          {view.snapshot?.bondState === 10 ? <Button title="Pair with Quest" disabled={view.busy || !view.snapshot.connected} onPress={() => run('bond')} /> : null}
          <Button title="Discover services" disabled={view.busy || !view.snapshot?.connected} onPress={() => run('discover')} />
          <Button title="Capture Muse tip for 120 seconds" disabled={view.capturing || !view.snapshot?.connected} onPress={capture} />
          <Button title="Stop capture" disabled={!view.capturing} onPress={() => { stopCapture(); stopNative(); releaseNotifications(); }} />
        </View>
        <Text>Pair with Quest opens Android's own pairing prompt for this connected device. Bluetooth bonding alone does not verify pen input.</Text>
        <Text testID="forge-pen-diagnostic-status">Link: {view.snapshot ? (view.snapshot.connected ? 'connected' : 'disconnected') : 'not observed'} · Native bond state: {view.snapshot?.bondState ?? 'not reported'} · Services: {view.snapshot?.servicesState ?? 'unknown'} · Notifications: {view.snapshot?.totalNotifications ?? 'not reported'} · Sequence: {view.snapshot?.lastSequence ?? 'not reported'} · Generation: {view.snapshot?.connectionGeneration ?? 'not reported'} · Polling: {view.capturing ? 'active' : 'stopped'} · Native capture: {view.snapshot?.nativeCapturing === null || !view.snapshot ? 'not reported' : String(view.snapshot.nativeCapturing)} · Blocked: {view.snapshot?.blocked === null || !view.snapshot ? 'not reported' : String(view.snapshot.blocked)}</Text>
        {view.snapshot?.inventoryTruncated ? <Text tone="danger">The native or displayed service inventory was truncated. Unlisted data has not been inspected.</Text> : null}
        {view.error ? <Text tone="danger" selectable>{view.error}</Text> : null}
        <Text>Enable notifications explicitly to write the standard notification descriptor, then start capture and press and release the Muse tip. Closing stops local capture and attempts to disable the subscriptions enabled here. If an operation was cancelled or timed out, reconnect before inspecting again.</Text>
        {view.snapshot?.characteristics.map((characteristic) => (
          <View key={characteristic.key} className="gap-element">
            <Text selectable>Service {characteristic.serviceUuid}</Text>
            <Text selectable>{characteristic.uuid} · properties 0x{characteristic.properties.toString(16)}</Text>
            <Text variant="caption" selectable>{characteristic.key}</Text>
            <View className="flex-row flex-wrap gap-element">
              {(characteristic.properties & 0x02) !== 0 ? <Button title="Read characteristic" size="sm" disabled={view.busy} onPress={() => run('read', characteristic.key)} /> : null}
              {(characteristic.properties & 0x30) !== 0 ? <>
                <Button title="Enable notifications" size="sm" disabled={view.busy || view.enabled.includes(characteristic.key)} onPress={() => run('enable', characteristic.key)} />
                <Button title="Disable notifications" size="sm" disabled={view.busy || !view.enabled.includes(characteristic.key)} onPress={() => run('disable', characteristic.key)} />
              </> : null}
            </View>
            {characteristic.descriptors.map((descriptor) => (
              <View key={descriptor.key} className="gap-element">
                <Text variant="caption" selectable>Descriptor {descriptor.uuid}</Text>
                <Button title="Read descriptor" size="sm" variant="outline" disabled={view.busy} onPress={() => run('descriptor', descriptor.key)} />
              </View>
            ))}
          </View>
        ))}
        <Text variant="heading">Latest native events</Text>
        {view.snapshot?.events.map((event, index) => <Text key={index} selectable>{event}</Text>)}
      </ScrollView>
      </View>
    </Modal>
  );
  return { open, dialog };
}
