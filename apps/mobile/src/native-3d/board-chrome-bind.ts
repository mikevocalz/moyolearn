/**
 * The BoardChrome binding — the seam between the Rive artboard's view model
 * and the application's own state. Same shape as `bindRiveSelection` in this
 * directory: the Rive runtime owns the presentation, the application store
 * owns the truth, and this file moves values across in both directions.
 *
 * JS → RIVE (presentation): `push` writes the view-model properties the
 * chrome reads. Written whole on every store change rather than diffed field
 * by field — the writes happen at button-tap cadence, not frame cadence, and
 * a diff mask is one more place for a property to silently go stale.
 *
 * RIVE → JS (intent): the artboard's control listeners write `command` and
 * bump `commandSeq`; the `observeNumber` on `commandSeq` is the edge detector.
 * The command is decoded (`board-chrome-commands.ts`) and handed to the
 * caller's dispatch — this file names no engine and no store, so the probe
 * route and the tutor screen each bind it to their own.
 *
 * SOT: packages/ui/xr/board-chrome-commands.ts · packages/ui/xr/board-chrome-layout.ts ·
 *      probes/rive-panel/rive/scene.rml (BoardChrome view model)
 * SOT-KEYWORDS: xr rive board chrome bind command observe dispatch view model zustand bridge
 */

import type { RivePanel } from 'nitro-canvas-in-Vision';
import { decodeBoardCommand, inkToRive, toolToRive } from '@acme/ui/xr';
import type { WhiteboardInk, WhiteboardTool } from '@acme/ui';

/** The application state the chrome shows — a snapshot, not a subscription. */
export interface BoardChromePresentation {
  tool: WhiteboardTool;
  ink: WhiteboardInk;
  canUndo: boolean;
  canRedo: boolean;
  /** An Ask Natalie turn is in flight — the button reads as busy. */
  asking: boolean;
  /** The document is not empty — Clear and Ask Natalie are meaningful. */
  hasMarks: boolean;
  /** The inks row is showing in place of the tools row. */
  paletteOpen: boolean;
  /** Clear was pressed once and is armed for a second press. */
  clearArmed: boolean;
  /** The carrier is being dragged — chrome de-dims its own affordances. */
  grabbed: boolean;
  reducedMotion: boolean;
  /** Engine/runtime status line — empty is healthy. */
  status: string;
  /** Panel face opacity 0..1 — the chrome's own art stays full-strength;
      only the translucent fill surfaces follow this. Optional because the
      panel-level `opacity` prop composes it for hosts of `RiveBoardPanel`. */
  uiOpacity?: number;
}

/** The verbs a decoded command can reach. */
export interface BoardChromeHandlers {
  onTool(tool: WhiteboardTool): void;
  onInk(ink: WhiteboardInk): void;
  onPalette(open: boolean): void;
  onUndo(): void;
  onRedo(): void;
  /** Pressed once arms `clearArmed`; pressed while armed clears. */
  onClear(): void;
  onAsk(): void;
}

export interface BoardChromeBinding {
  /** Push the current application state into the view model. */
  push(state: BoardChromePresentation): void;
  /** Stop observing. Called on unmount alongside the runtime's own teardown. */
  dispose(): void;
}

/**
 * Bind one runtime to the application. `handlers` are the verbs the commands
 * reach; `push` is how state flows in. The binding is the ONLY writer of
 * `command` back to 0 — a runtime that restarts mid-session must not replay
 * the last press.
 */
export function bindBoardChrome(runtime: RivePanel, handlers: BoardChromeHandlers): BoardChromeBinding {
  let lastSeq = runtime.getNumber('commandSeq');
  runtime.observeNumber('commandSeq', (seq) => {
    if (seq === lastSeq) return;
    lastSeq = seq;
    const intent = decodeBoardCommand(runtime.getNumber('command'));
    /* Acknowledge before dispatch: a handler that throws must not leave the
       press armed for a phantom replay on the next unrelated bump. */
    runtime.setNumber('command', 0);
    switch (intent.kind) {
      case 'tool': handlers.onTool(intent.tool); break;
      case 'ink': handlers.onInk(intent.ink); break;
      case 'togglePalette': handlers.onPalette(true); break;
      case 'closePalette': handlers.onPalette(false); break;
      case 'undo': handlers.onUndo(); break;
      case 'redo': handlers.onRedo(); break;
      case 'clear': handlers.onClear(); break;
      case 'askNatalie': handlers.onAsk(); break;
      case 'none': break;
    }
  });
  return {
    push(state) {
      runtime.setNumber('tool', toolToRive(state.tool));
      runtime.setNumber('ink', inkToRive(state.ink));
      runtime.setBoolean('canUndo', state.canUndo);
      runtime.setBoolean('canRedo', state.canRedo);
      runtime.setBoolean('asking', state.asking);
      runtime.setBoolean('hasMarks', state.hasMarks);
      runtime.setBoolean('paletteOpen', state.paletteOpen);
      runtime.setBoolean('clearArmed', state.clearArmed);
      runtime.setBoolean('grabbed', state.grabbed);
      runtime.setBoolean('reducedMotion', state.reducedMotion);
      runtime.setString('status', state.status);
      runtime.setNumber('uiOpacity', state.uiOpacity ?? 1);
      runtime.setNumber('revision', runtime.getNumber('revision') + 1);
    },
    dispose() {
      runtime.observeNumber('commandSeq', undefined);
    },
  };
}
