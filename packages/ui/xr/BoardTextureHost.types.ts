// The live board host's contract, in a file the native module does not own.
//
// Platform-neutral for the reason every `*.types.ts` here is: a type-only
// re-export is erased at build but still resolved by a bundler, and the web
// fork has to be able to name this shape without resolving a native view.
// SOT: packages/ui/xr/BoardTextureHost.native.tsx · apps/mobile/modules/board-texture
// SOT-KEYWORDS: board texture host props types android view texture page webview

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/** The answer to one bind attempt, as the native module reports it. */
export interface BoardTextureBinding {
  /** True when the page is on the material and the scene can draw it. */
  bound: boolean;
  /**
   * Why it is not, for the log. Never shown to a child — a board that failed to
   * bind still draws, as a raster with live ink over it.
   */
  reason: string | null;
}

export interface BoardTextureHostProps {
  /**
   * The page. One child: the engine, at the page's own size.
   *
   * It stays a React Native view with React Native's layout throughout — the
   * module changes its PARENT, not its identity, so the WebView keeps its
   * editor, its camera and the stroke in progress across the hand-off.
   */
  children: ReactNode;
  /** The registered material whose diffuse channel becomes the board. */
  material: string;
  /** The page's CSS size in dp — `boardSurfacePixels`, and nothing else. */
  pageWidth: number;
  pageHeight: number;
  /**
   * Whether to ask for the binding now.
   *
   * The renderer exists only once the navigator is mounted and nothing in the
   * view hierarchy announces that, so the caller says when. False parks the
   * page in the React tree and does nothing else, which is exactly the state
   * the raster presentation needs.
   */
  live: boolean;
  /** Called once per attempt, bound or not. */
  onBound?: (binding: BoardTextureBinding) => void;
  style?: StyleProp<ViewStyle>;
}
