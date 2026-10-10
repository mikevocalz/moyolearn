// The Studio scene host's contract, in a file the Viro renderer does not own.
//
// Same rule as every `*.types.ts` in this folder: the web fork must not name
// the native file even for a type, because a type-only import is erased at
// build but still RESOLVED by the bundler.
// SOT: packages/ui/xr/XrStudioSceneHost.native.tsx
// SOT-KEYWORDS: xr studio scene host props types platform neutral no viro

export interface XrStudioSceneHostProps {
  /**
   * A Studio scene UUID, or nothing for the project's opening scene. Omit it
   * and the navigator asks the native project configuration what to open —
   * `VRTStudioModule.rvGetProject` under the manifest's RVProjectId.
   */
  sceneId?: string;
  /** Called when the viewer leaves the immersive session. */
  onExitViro?: () => void;
  /** Called with the load or render failure; the host renders its own error UI either way. */
  onError?: (error: Error) => void;
  /** Called once the scene is fetched, parsed and mounted. */
  onSceneReady?: () => void;
}
