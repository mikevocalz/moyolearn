import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { createMMKV } from 'react-native-mmkv';
import { Image } from 'expo-image';
import { Button, Text, Whiteboard, type WhiteboardDiff, type WhiteboardDiffSource, type WhiteboardHandle } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import type { ProblemStorage } from '@acme/app/features/capture/problem-storage.shared.ts';
import { BOARD_KEY } from '@acme/app/features/capture/problem-storage.shared.ts';
import { writeSavedForgeBoard } from '@acme/app/features/tutor/forge-board-storage.ts';
import { FORGE_PROBE_STORAGE_ID, injectProbeStroke, probeMarkCount, restoreProbeDocument } from './model';
import { useForgePenConnection } from '@acme/app/features/tutor/forge-pen-connection.native.tsx';
import { useForgeBoardExport } from '@acme/app/features/tutor/forge-board-export-ui.native.tsx';
import { useForgePenDiagnostics } from '@acme/app/features/tutor/forge-pen-diagnostics.native.tsx';
import { createMuseTelemetryController, type MuseTelemetryController } from './muse-telemetry';
import { MuseTelemetryView } from './muse-telemetry-view';

interface ProbeState {
  generation: number;
  resetVersion: number;
  surfaceVersion: number;
  ready: boolean;
  marks: number;
  canUndo: boolean;
  canRedo: boolean;
  persistence: string;
  png: string;
  exporting: boolean;
  error: string | null;
}
interface ProbeResources {
  generation: number;
  mmkv: ReturnType<typeof createMMKV>;
  storage: ProblemStorage;
  doc: ReturnType<typeof restoreProbeDocument>['doc'];
}

/** Production Whiteboard and Yjs history on an isolated persistent fixture. */
export function ForgeBoardProbe() {
  const museTelemetry = useRef<MuseTelemetryController | null>(null);
  if (museTelemetry.current === null) museTelemetry.current = createMuseTelemetryController();
  const penConnection = useForgePenConnection(false);
  const penDiagnostics = useForgePenDiagnostics(penConnection.readDiagnostics);
  const boardExport = useForgeBoardExport();
  const stateRef = useRef<StoreApi<ProbeState> | null>(null);
  if (stateRef.current === null) stateRef.current = createStore<ProbeState>(() => ({
    generation: 0, resetVersion: 0, surfaceVersion: 0, ready: false,
    marks: 0, canUndo: false, canRedo: false, persistence: 'Opening test board',
    png: 'No PNG exported', exporting: false, error: null,
  }));
  const state = stateRef.current;
  const generation = useStore(state, (s) => s.generation);
  const resetVersion = useStore(state, (s) => s.resetVersion);
  const surfaceVersion = useStore(state, (s) => s.surfaceVersion);
  const ready = useStore(state, (s) => s.ready);
  const marks = useStore(state, (s) => s.marks);
  const canUndo = useStore(state, (s) => s.canUndo);
  const canRedo = useStore(state, (s) => s.canRedo);
  const persistence = useStore(state, (s) => s.persistence);
  const png = useStore(state, (s) => s.png);
  const exporting = useStore(state, (s) => s.exporting);
  const error = useStore(state, (s) => s.error);
  const resources = useRef<ProbeResources | null>(null);
  const board = useRef<WhiteboardHandle>(null);
  const stopRemote = useRef<(() => void) | null>(null);
  const pngUri = useRef<string | null>(null);

  useEffect(() => {
    // Effects recreate owned resources safely during React's development replay.
    // No instance is created when the release route redirects.
    let cleanup: (() => void) | undefined;
    try {
      const mmkv = createMMKV({ id: FORGE_PROBE_STORAGE_ID });
      const storage: ProblemStorage = {
        getString: (key) => mmkv.getString(key),
        set: (key, value) => mmkv.set(key, value),
        remove: (key) => { mmkv.remove(key); },
      };
      const { doc, restored } = restoreProbeDocument(storage);
      const nextGeneration = state.getState().generation + 1;
      resources.current = { generation: nextGeneration, mmkv, storage, doc };
      const stopRecords = doc.onRecords(() => state.setState({
        marks: probeMarkCount(doc.snapshot()), persistence: 'Unsaved test board',
      }));
      const stopHistory = doc.onHistory((history) => state.setState(history));
      state.setState({
        generation: nextGeneration, ready: false, marks: probeMarkCount(doc.snapshot()),
        canUndo: doc.canUndo(), canRedo: doc.canRedo(), exporting: false,
        persistence: restored ? 'Restored test board' : 'Test board ready', error: null,
      });
      cleanup = () => {
        stopRemote.current?.();
        stopRemote.current = null;
        stopRecords();
        stopHistory();
        resources.current = null;
        doc.destroy();
      };
    } catch {
      state.setState({ ready: false, error: 'Test storage could not open. Reload this engineering route to retry.' });
    }
    return () => cleanup?.();
  }, [resetVersion, state]);

  const onReady = async () => {
    const current = resources.current;
    const engine = board.current;
    if (!current || !engine || current.generation !== generation) return;
    stopRemote.current?.();
    engine.loadSnapshot(current.doc.snapshot());
    stopRemote.current = current.doc.onRemote((diff) => engine.applyDiff(diff));
    // The response follows restoration on the bridge, so readiness means the
    // mounted editor has processed the fixture snapshot, not merely loaded HTML.
    try {
      await engine.getSnapshot();
      if (resources.current !== current || board.current !== engine ||
          state.getState().surfaceVersion !== surfaceVersion) return;
      state.setState({ ready: true });
    } catch {
      if (resources.current === current && board.current === engine &&
          state.getState().surfaceVersion === surfaceVersion) {
        state.setState({ ready: false, error: 'Test surface could not become ready. Reopen this engineering route to retry.' });
      }
    }
  };
  const onChange = (diff: WhiteboardDiff, source: WhiteboardDiffSource) => {
    const current = resources.current;
    if (current?.generation === generation && source === 'user') current.doc.applyDiff(diff, 'local');
  };
  const save = async () => {
    const current = resources.current;
    if (!current) return;
    try {
      // A bridge round trip drains preceding user diffs; the Yjs document stays authoritative.
      await board.current?.getSnapshot();
      if (resources.current !== current) return;
      writeSavedForgeBoard(current.storage, current.doc);
      state.setState({ persistence: 'Saved test board', error: null });
    } catch {
      state.setState({ error: 'Test board could not save. The current drawing remains open.' });
    }
  };
  const reset = () => {
    try {
      // BOARD_KEY is removed only from this fixture's MMKV file.
      resources.current?.storage.remove(BOARD_KEY);
      pngUri.current = null;
      state.setState((s) => ({ resetVersion: s.resetVersion + 1, ready: false, png: 'No PNG exported', error: null }));
    } catch {
      state.setState({ error: 'Test board could not reset. No learner storage was opened.' });
    }
  };
  const exportPng = async () => {
    const engine = board.current;
    if (!engine) return;
    state.setState({ exporting: true, png: 'Exporting test PNG', error: null });
    try {
      const result = await engine.exportPng();
      if (resources.current?.generation !== generation) return;
      pngUri.current = result;
      state.setState({ png: result?.startsWith('data:image/png;base64,') ? 'PNG preview ready' : 'Board is empty' });
    } catch {
      if (resources.current?.generation === generation) state.setState({ png: 'PNG export failed', error: 'Test PNG could not export. Try again.' });
    } finally {
      if (resources.current?.generation === generation) state.setState({ exporting: false });
    }
  };
  const reloadSurface = () => {
    stopRemote.current?.();
    stopRemote.current = null;
    state.setState((s) => ({ surfaceVersion: s.surfaceVersion + 1, ready: false }));
  };
  const current = resources.current;
  return (
    <View className="flex-1 bg-surface p-inset gap-element" testID="forge-board-probe">
      <Stack.Screen options={{ title: 'Forge board validation', headerShown: false }} />
      <Text variant="heading" testID="forge-probe-title">Forge board validation</Text>
      <Text variant="caption">Isolated development fixture. Synthetic samples do not validate pen hardware. Reload the surface after synthetic input to resume touch drawing.</Text>
      <MuseTelemetryView controller={museTelemetry.current} />
      <View className="flex-row flex-wrap gap-element">
        <Button title="Pen Bluetooth diagnostics" size="sm" variant="outline" onPress={penDiagnostics.open} />
        <Button title="Connect pen" size="sm" onPress={penConnection.open} />
        <Button title="Disconnect pen" size="sm" variant="outline" onPress={penConnection.disconnect} />
        <Button title="Add test stroke" aria-label="Add test stroke, synthetic pressure" size="sm" disabled={!ready} onPress={() => { if (state.getState().ready && board.current) injectProbeStroke(board.current); }} />
        <Button title="Redo test edit" size="sm" variant="outline" disabled={!ready || !canRedo} onPress={() => resources.current?.doc.redo()} />
        <Button title="Save test board" size="sm" disabled={!ready} onPress={() => { void save(); }} />
        <Button title="Save PNG to device" size="sm" variant="outline" disabled={!ready || boardExport.busy} onPress={() => { void boardExport.save(board.current); }} />
        <Button title="Preview test PNG" size="sm" variant="outline" disabled={!ready || exporting} onPress={() => { void exportPng(); }} />
        <Button title="Reload test surface" size="sm" variant="outline" disabled={!ready} onPress={reloadSurface} />
        <Button title="Reset test board" size="sm" variant="danger" disabled={!ready} onPress={reset} />
      </View>
      <View className="flex-row flex-wrap gap-element">
        <Text variant="caption" testID="forge-probe-ready">Surface: {ready ? 'ready' : 'opening'}</Text>
        <Text variant="caption" testID="forge-probe-marks">Marks: {marks}</Text>
        <Text variant="caption" testID="forge-probe-undo">Can undo: {canUndo ? 'yes' : 'no'}</Text>
        <Text variant="caption" testID="forge-probe-redo">Can redo: {canRedo ? 'yes' : 'no'}</Text>
        <Text variant="caption" testID="forge-probe-save">{persistence}</Text>
        <Text variant="caption" testID="forge-probe-png">{png}</Text>
      </View>
      {error ? <Text tone="danger" testID="forge-probe-error">{error}</Text> : null}
      <View className="flex-1" testID="forge-probe-board">
        {current ? <Whiteboard key={`${generation}:${surfaceVersion}`} ref={board} history={current.doc} size="sm" onChange={onChange} onReady={onReady} /> : null}
      </View>
      {penConnection.dialog}
      {penDiagnostics.dialog}
      {boardExport.feedback}
      {png === 'PNG preview ready' && pngUri.current ? <Image source={{ uri: pngUri.current }} style={{ width: 96, height: 54 }} contentFit="contain" accessibilityLabel="Exported test board PNG" /> : null}
    </View>
  );
}
