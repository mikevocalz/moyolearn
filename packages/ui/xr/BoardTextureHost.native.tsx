'use client';
// Where the engine is mounted so the renderer can draw it.
//
// The page is a React Native view and stays one. This host is the seam the
// native module reaches it through: React Native builds the child here, lays it
// out here and keeps it attached to a window here, and `MoyoBoardTexture` then
// re-parents that same `View` into the sink `AndroidViewTexture` draws from.
// Nothing about the WebView is recreated by the move, which is the whole reason
// the board survives it with its editor, its camera and the stroke in progress.
//
// IT RENDERS ITS CHILD EITHER WAY. On iOS, on web, in a build made before the
// module existed, and on any device where the binding fails, this is a plain
// `View` at the same size in the same place — the parked engine the raster
// presentation has always needed. There is no path here where the board stops
// running because a texture did not.
//
// `requireNativeView` IS CALLED IN A TRY, and that is not defensiveness for its
// own sake: the module is Android-only and local to `apps/mobile`, so a native
// binary that predates it is a normal state during development, and a throw at
// module scope would take the whole spatial route down with it rather than
// falling back to the presentation that does not need it.
// SOT: apps/mobile/modules/board-texture/README.md · packages/ui/xr/XrBoardLive.native.tsx
// SOT-KEYWORDS: board texture host native view expo requireNativeView webview parent hand-off

import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';
import { Platform, View, type NativeSyntheticEvent } from 'react-native';
import type { BoardTextureBinding, BoardTextureHostProps } from './BoardTextureHost.types.ts';

interface NativeProps {
  material: string;
  pageWidth: number;
  pageHeight: number;
  live: boolean;
  onBound?: (event: NativeSyntheticEvent<BoardTextureBinding>) => void;
  style?: BoardTextureHostProps['style'];
  pointerEvents?: 'none';
  children?: BoardTextureHostProps['children'];
}

const NativeBoardTexture: ComponentType<NativeProps> | null = (() => {
  if (Platform.OS !== 'android') return null;
  try {
    return requireNativeView<NativeProps>('MoyoBoardTexture');
  } catch {
    return null;
  }
})();

export function BoardTextureHost({
  children,
  material,
  pageWidth,
  pageHeight,
  live,
  onBound,
  style,
}: BoardTextureHostProps) {
  if (NativeBoardTexture === null) {
    /*
      Nothing to report. A caller that never hears `onBound` keeps the raster,
      which is the same thing a failed bind means — so silence and `bound:
      false` are deliberately the same state rather than two.
    */
    return (
      <View style={style} pointerEvents="none">
        {children}
      </View>
    );
  }

  return (
    <NativeBoardTexture
      style={style}
      /*
        The child never takes touch. On the spatial route the engine is parked
        off-screen and driven by injected pointer events; on the way into the
        sink it is not on screen at all.
      */
      pointerEvents="none"
      material={material}
      pageWidth={pageWidth}
      pageHeight={pageHeight}
      live={live}
      onBound={(event) => onBound?.(event.nativeEvent)}
    >
      {children}
    </NativeBoardTexture>
  );
}
