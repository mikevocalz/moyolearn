/**
 * The BoardChrome binding — the seam between the Rive artboard's view model
 * and the application's own state. Same shape as `bindRiveSelection` in this
 * directory: the Rive runtime owns the presentation, the application store
 * owns the truth, and this file moves values across in both directions.
 *
 * JS → RIVE (presentation): `push` writes the view-model properties the
 * chrome reads. Written whole on every store change rather than diffed field
 * by field — the native writer sends only changed properties and bumps revision once.
 * Document changes with identical chrome state cause no native writes.
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

import { chromePresentation } from './chrome-presentation.ts';
import type { ChromeRuntime } from './chrome-runtime.types.ts';
import { boardCommandEnabled, decodeBoardCommand, inkToRive, toolToRive } from './board-chrome-commands.ts';

import type { BoardChromeHandlers, BoardChromePresentation } from './board-chrome.types.ts';
export type { BoardChromeHandlers, BoardChromePresentation } from './board-chrome.types.ts';

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
export function bindBoardChrome(runtime: ChromeRuntime, handlers: BoardChromeHandlers): BoardChromeBinding {
  const presentation = chromePresentation(runtime);
  let lastSeq = runtime.getNumber('commandSeq');
  let current: BoardChromePresentation | null = null;
  let disposed = false;
  runtime.observeNumber('commandSeq', (seq) => {
    if (seq === lastSeq) return;
    lastSeq = seq;
    const intent = decodeBoardCommand(runtime.getNumber('command'));
    /* Acknowledge before dispatch: a handler that throws must not leave the
       press armed for a phantom replay on the next unrelated bump. */
    runtime.setNumber('command', 0);
    if (disposed || !current) return;
    /* A release edge must ALWAYS reach the handler — the `asking` gate
       below flips on press-down and would swallow the up, leaving the mic
       hot until the recorder's own timeout. */
    if (intent.kind === 'releaseAsk') { handlers.onAskEnd?.(); return; }
    const enabled = boardCommandEnabled(intent, current);
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[chrome] board cmd', intent.kind, 'enabled:', enabled, 'hasMarks:', current.hasMarks, 'clearArmed:', current.clearArmed);
    if (!enabled) return;
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
      if (disposed) return;
      current = state;
      presentation.setNumber('tool', toolToRive(state.tool));
      presentation.setNumber('ink', inkToRive(state.ink));
      presentation.setBoolean('canUndo', state.canUndo);
      presentation.setBoolean('canRedo', state.canRedo);
      presentation.setBoolean('asking', state.asking);
      presentation.setBoolean('hasMarks', state.hasMarks);
      presentation.setBoolean('paletteOpen', state.paletteOpen);
      presentation.setBoolean('clearArmed', state.clearArmed);
      presentation.setBoolean('grabbed', state.grabbed);
      presentation.setBoolean('reducedMotion', state.reducedMotion);
      presentation.setString('status', state.status);
      presentation.setNumber('uiOpacity', state.uiOpacity ?? 1);
      presentation.commit();
    },
    dispose() {
      disposed = true;
      runtime.observeNumber('commandSeq', undefined);
    },
  };
}
