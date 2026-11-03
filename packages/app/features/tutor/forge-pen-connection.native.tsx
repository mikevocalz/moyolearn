import { useCallback, useEffect, useRef } from 'react';
import { AppState, Modal, Platform } from 'react-native';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { Button, Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { getForgeBluetooth } from '@nitro-forge/bluetooth-v1';
import {
  createAndroidBlePenPort, createPenConnectionController, PenConnectionDialog,
  visionOSMusePort, type PenConnectionController,
} from '@nitro-forge/pen-connect/native';
import { canVerifyMuseFrame, type MuseVerificationFrame } from './forge-pen-verification';
import type { ForgePenDiagnosticsPort } from './forge-pen-diagnostics';

/** Owns one user-initiated pen connection; drawing remains in the existing Muse input owner. */
export function useForgePenConnection(visionOS: boolean) {
  const stateRef = useRef<StoreApi<{ visible: boolean; available: boolean; error: string | null }> | null>(null);
  if (!stateRef.current) stateRef.current = createStore(() => ({ visible: false, available: false, error: null }));
  const state = stateRef.current;
  const visible = useStore(state, (s) => s.visible);
  const available = useStore(state, (s) => s.available);
  const error = useStore(state, (s) => s.error);
  const controller = useRef<PenConnectionController | null>(null);
  const nativeDiagnostics = useRef<ForgePenDiagnosticsPort | null>(null);
  const openSettings = useRef<(() => void) | undefined>(undefined);
  const initialize = useCallback(() => {
    if (controller.current) return;
    try {
      if (visionOS) controller.current = createPenConnectionController(visionOSMusePort);
      else if (Platform.OS === 'android') {
        const NativeBluetooth = getForgeBluetooth();
        if (!NativeBluetooth) throw new Error('Bluetooth connection is unavailable in this app build.');
        const native = new NativeBluetooth();
        nativeDiagnostics.current = native;
        openSettings.current = () => native.openBluetoothSettings();
        controller.current = createPenConnectionController(createAndroidBlePenPort(native));
      } else throw new Error('Pen pairing is unavailable on this platform.');
      state.setState({ available: true, error: null });
    } catch (cause) {
      state.setState({ available: false, error: cause instanceof Error ? cause.message : 'Bluetooth connection could not open.' });
    }
  }, [state, visionOS]);
  const open = useCallback(() => {
    initialize();
    state.setState({ visible: true });
    // Opening the dialog alone never starts a scan or requests permission.
  }, [initialize, state]);
  const close = useCallback(() => state.setState({ visible: false }), [state]);
  const disconnect = useCallback(() => { void controller.current?.cancel(); }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') {
        const kind = controller.current?.state.getState().kind;
        if (kind === 'scanning' || kind === 'connecting') void controller.current?.cancel();
      }
    });
    return () => {
      subscription.remove();
      controller.current?.dispose();
      controller.current = null;
      nativeDiagnostics.current = null;
      openSettings.current = undefined;
    };
  }, []);
  const verifyMuse = useCallback((frame: MuseVerificationFrame) => {
    if (!visionOS) return;
    controller.current?.verifyNativeInput({ evidence: 'visionos-spatial-stream', tracked: canVerifyMuseFrame(frame) });
  }, [visionOS]);
  const dialog = available && controller.current ? (
    <PenConnectionDialog visible={visible} controller={controller.current} onClose={close} onOpenBluetoothSettings={() => openSettings.current?.()} />
  ) : (
    <Modal visible={visible} transparent onRequestClose={close}>
      <View className="flex-1 items-center justify-center p-inset" style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}>
        <View className="bg-surface rounded-xl p-inset gap-element" style={{ width: '100%', maxWidth: 480 }} accessibilityViewIsModal>
          <Text variant="heading">Connect your pen</Text>
          <Text>{error ?? 'Pen connection is unavailable.'}</Text>
          <Button title="Try again" onPress={initialize} />
          <Button title="Close" variant="outline" onPress={close} />
        </View>
      </View>
    </Modal>
  );
  const readDiagnostics = useCallback(() => nativeDiagnostics.current, []);
  return { open, disconnect, verifyMuse, dialog, readDiagnostics };
}
