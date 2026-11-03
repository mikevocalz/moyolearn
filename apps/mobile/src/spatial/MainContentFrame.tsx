import { useRef, type ReactNode } from 'react';
import { usePathname } from 'expo-router';
import { useColorScheme } from 'react-native';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { semantic } from '@acme/theme';
import { View } from '@acme/ui/primitives';
import { metaWindows } from './metaWindows';
import { fitMainContent } from './main-content-geometry';

/** Keeps the Quest middle surface framed independently of its hosted rail and OS window. */
export function MainContentFrame({ children, overlay = false }: { children: ReactNode; overlay?: boolean }) {
  const pathname = usePathname();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const stateRef = useRef<StoreApi<{ width: number; height: number }> | null>(null);
  if (!stateRef.current) stateRef.current = createStore(() => ({ width: 0, height: 0 }));
  const state = stateRef.current;
  const bounds = useStore(state, (s) => s);
  // The immersive renderer owns its full native surface; this is the flat app's middle panel.
  const immersive = pathname.endsWith('/tutor-xr') || [
    '/xr-layout-probe', '/xr-question-probe', '/rive-panel-probe', '/device-validation-probe', '/xr-muse-input-probe',
  ].includes(pathname);
  const framed = metaWindows.linked && !immersive;
  const frame = framed ? fitMainContent(bounds.width, bounds.height) : null;
  return (
    <View
      testID={framed ? (overlay ? 'quest-overlay-frame-host' : 'quest-content-frame-host') : undefined}
      pointerEvents={overlay ? 'box-none' : 'auto'}
      onLayout={({ nativeEvent: { layout } }) => {
        if (layout.width !== state.getState().width || layout.height !== state.getState().height) state.setState({ width: layout.width, height: layout.height });
      }}
      style={overlay
        ? { position: 'absolute', inset: 0, overflow: framed ? 'hidden' : 'visible' }
        : { flex: 1, overflow: framed ? 'hidden' : 'visible', backgroundColor: framed ? semantic.surface[scheme] : undefined }}
    >
      <View
        testID={framed ? (overlay ? 'quest-overlay-frame-surface' : 'quest-content-frame-surface') : undefined}
        pointerEvents={overlay ? 'box-none' : 'auto'} style={frame
        ? { position: 'absolute', ...frame, overflow: 'hidden', backgroundColor: overlay ? 'transparent' : semantic.surface[scheme] }
        : { flex: 1, opacity: framed ? 0 : 1 }}>
        {children}
      </View>
    </View>
  );
}
