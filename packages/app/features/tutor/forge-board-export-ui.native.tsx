import { useCallback, useRef } from 'react';
import { Modal } from 'react-native';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { Button, Text, type WhiteboardHandle } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { saveForgeBoardPng } from './forge-board-export.native';

/** Presents the actual selected-folder write result for a board PNG export. */
export function useForgeBoardExport() {
  const stateRef = useRef<StoreApi<{ busy: boolean; message: string | null }> | null>(null);
  if (!stateRef.current) stateRef.current = createStore(() => ({ busy: false, message: null }));
  const state = stateRef.current;
  const busy = useStore(state, (s) => s.busy);
  const message = useStore(state, (s) => s.message);
  const save = useCallback(async (engine: Pick<WhiteboardHandle, 'exportPng'> | null) => {
    if (!engine || state.getState().busy) return;
    state.setState({ busy: true, message: 'Preparing PNG…' });
    try {
      const png = await engine.exportPng();
      if (!png) { state.setState({ message: 'The board is empty. Draw something before saving a PNG.' }); return; }
      // Hide feedback while the OS owns its destination picker.
      state.setState({ message: null });
      const result = await saveForgeBoardPng(png);
      state.setState({ message: result.kind === 'saved'
        ? `Saved ${result.fileName} to your selected folder.`
        : 'Save cancelled. No PNG was written.' });
    } catch {
      state.setState({ message: 'PNG could not be saved. Choose a writable folder and try again.' });
    } finally { state.setState({ busy: false }); }
  }, [state]);
  const feedback = (
    <Modal visible={message !== null} transparent onRequestClose={() => { if (!busy) state.setState({ message: null }); }}>
      <View className="flex-1 items-center justify-center p-inset" style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}>
        <View className="bg-surface rounded-xl p-inset gap-element" style={{ width: '100%', maxWidth: 480 }} accessibilityViewIsModal>
          <Text variant="heading">Save board PNG</Text>
          <Text accessibilityLiveRegion="polite">{message}</Text>
          <Button title="Close" disabled={busy} onPress={() => state.setState({ message: null })} />
        </View>
      </View>
    </Modal>
  );
  return { save, busy, feedback };
}
