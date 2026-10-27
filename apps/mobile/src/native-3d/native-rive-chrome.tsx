/**
 * The Round 2 `nativeRive` switch for the board chrome: `ViroNativeRivePanel`
 * from viro-external native-panels, which draws the same `.riv` through
 * ViroCore's VRORivePanel instead of `ViroRivePanel`'s nitro-canvas runtime.
 *
 * WHAT THE NATIVE ROUTE DOES AND DOES NOT DO HERE. It draws the chrome and
 * takes the application state as view-model `bindings`, the same twelve values
 * `bindBoardChrome.push` writes (`chromeBindings` below). It does not take
 * input: the package's native route ignores `input` and reports no runtime to
 * `onRuntimeReady`, so the toolbar's own buttons do nothing on this route.
 * Drawing is unaffected, because the paper's rays go to `XrBoardSurface`, not
 * to the chrome. That is enough to compare chrome image quality and frame cost
 * between the two Rive producers on a headset.
 *
 * The package is `require`d, not imported: its sources target viro
 * 3.0.3-moyo.1, so importing them would put 5 type errors from a dependency
 * (`ViroRivePanel` props this app's viro lacks) into this app's typecheck. See
 * `native-board.native.tsx` in packages/app/features/tutor for the same
 * boundary.
 *
 * SOT: ./rive-board-panel.tsx · @acme/app/features/tutor/device-validation-flags.ts
 * SOT-KEYWORDS: native rive chrome viro native rive panel round 2 bindings
 */
import { Suspense, lazy, type ComponentType } from 'react';
import { useStore } from 'zustand';
import type { RiveCanvasOptions } from 'nitro-canvas-in-Vision';
import { deviceValidationFlags } from '@acme/app/features/tutor/device-validation-flags.ts';
import { nativePanelsLinked } from '@acme/app/features/tutor/native-panels-linked.native.ts';
import { inkToRive, toolToRive } from '@acme/ui/xr';
import type { BoardChromePresentation } from './board-chrome-bind';

/** One view-model value, as native-panels' `RiveBindingValue` accepts it (the subset used here). */
type ChromeBindingValue = string | number | boolean;

/** The props this file passes; a subset of native-panels' `ViroNativeRivePanelProps`. */
interface NativeRiveChromeProps {
  nativeRive: true;
  source: RiveCanvasOptions;
  width: number;
  height: number;
  position: [number, number, number];
  resolution: { width: number; height: number };
  bindings: Record<string, ChromeBindingValue>;
  onError?: (error: Error) => void;
}

let linked: boolean | null = null;
let panel: ComponentType<NativeRiveChromeProps> | null = null;

function riveLinked(): boolean {
  if (linked === null) linked = nativePanelsLinked('nativepanels.RivePanel');
  return linked;
}

function nativeRivePanel(): ComponentType<NativeRiveChromeProps> {
  if (panel === null) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- kept out of the typecheck; see the header
    const nativePanels = require('@viro-external/native-panels') as {
      ViroNativeRivePanel: ComponentType<NativeRiveChromeProps>;
    };
    panel = nativePanels.ViroNativeRivePanel;
  }
  return panel;
}

/** True when the switch is on AND this build registers the native Rive panel. */
export function useNativeRiveEnabled(): boolean {
  const requested = useStore(deviceValidationFlags, (s) => s.nativeRive);
  return requested && riveLinked();
}

/** The chrome's view-model values for one presentation, mirroring `bindBoardChrome.push`. */
export function chromeBindings(state: BoardChromePresentation): Record<string, ChromeBindingValue> {
  return {
    tool: toolToRive(state.tool),
    ink: inkToRive(state.ink),
    canUndo: state.canUndo,
    canRedo: state.canRedo,
    asking: state.asking,
    hasMarks: state.hasMarks,
    paletteOpen: state.paletteOpen,
    clearArmed: state.clearArmed,
    grabbed: state.grabbed,
    reducedMotion: state.reducedMotion,
    status: state.status,
    uiOpacity: state.uiOpacity ?? 1,
  };
}

/** `ViroNativeRivePanel` with `nativeRive` on. Render only when `useNativeRiveEnabled()` is true. */
/* Module-level, so the component identity is stable across renders. The
   `require` runs on first render, never at import. */
const LazyNativeRivePanel = lazy(async () => ({ default: nativeRivePanel() }));

export function NativeRiveChrome(props: Omit<NativeRiveChromeProps, 'nativeRive'>) {
  return (
    <Suspense fallback={null}>
      <LazyNativeRivePanel nativeRive {...props} />
    </Suspense>
  );
}
