// The Rive → application command vocabulary for the BoardChrome artboard —
// one channel, because a per-button flag per control is eight places a stale
// value can read as a new press.
//
// The wire format is two numbers on the view model: `command` carries WHAT,
// `commandSeq` carries WHEN. Listeners inside the artboard write `command` and
// bump `commandSeq`; the JS binding observes `commandSeq` (the edge detector —
// the same button pressed twice is two increments, not one repeated value),
// reads `command`, decodes it here, and dispatches. `command` is written back
// to 0 by JS after dispatch so a fresh runtime never replays a stale press.
//
// SOT: this file is the contract; `probes/rive-panel/rive/scene.rml`'s
// BoardChrome artboard authors the same numbers on the Rive side.
// SOT-KEYWORDS: xr rive board chrome command channel intent decode view model binding

import type { WhiteboardInk, WhiteboardTool } from '../whiteboard.types.ts';

/** `command` values — the whole vocabulary, one table. */
export const BOARD_COMMAND = {
  none: 0,
  pen: 1,
  highlighter: 2,
  eraser: 3,
  togglePalette: 4,
  undo: 5,
  redo: 6,
  clear: 7,
  askNatalie: 8,
  /** Selecting ink i writes `inkBase + i` — 10..16 for the seven inks. */
  inkBase: 10,
  closePalette: 17,
} as const;

/** What a decoded command asks the application to do. */
export type BoardChromeIntent =
  | { kind: 'none' }
  | { kind: 'tool'; tool: WhiteboardTool }
  | { kind: 'ink'; ink: WhiteboardInk }
  | { kind: 'togglePalette' }
  | { kind: 'closePalette' }
  | { kind: 'undo' }
  | { kind: 'redo' }
  | { kind: 'clear' }
  | { kind: 'askNatalie' };

/* The ink order is `BOARD_INKS`' — the swatch row and the palette row name the
   same colours in the same order or the child learns two names for red. */
const INK_IDS = ['black', 'blue', 'red', 'green', 'yellow', 'orange', 'violet'] as const;

/**
 * Decode one `command` value into an intent. Anything outside the vocabulary —
 * including a negative index and a missing 9 — decodes to `none` rather than
 * throwing: a malformed artboard degrades to a dead button, which a child can
 * see and report, and never to a wrong action taken in their document.
 */
export function decodeBoardCommand(command: number): BoardChromeIntent {
  switch (command) {
    case BOARD_COMMAND.pen: return { kind: 'tool', tool: 'draw' };
    case BOARD_COMMAND.highlighter: return { kind: 'tool', tool: 'highlight' };
    case BOARD_COMMAND.eraser: return { kind: 'tool', tool: 'eraser' };
    case BOARD_COMMAND.togglePalette: return { kind: 'togglePalette' };
    case BOARD_COMMAND.closePalette: return { kind: 'closePalette' };
    case BOARD_COMMAND.undo: return { kind: 'undo' };
    case BOARD_COMMAND.redo: return { kind: 'redo' };
    case BOARD_COMMAND.clear: return { kind: 'clear' };
    case BOARD_COMMAND.askNatalie: return { kind: 'askNatalie' };
    default: break;
  }
  const inkIndex = command - BOARD_COMMAND.inkBase;
  const ink = Number.isInteger(inkIndex) && inkIndex >= 0 && inkIndex < INK_IDS.length
    ? INK_IDS[inkIndex]
    : undefined;
  return ink ? { kind: 'ink', ink } : { kind: 'none' };
}

/** `tool` state → the `tool` view-model number. `eraser` is 2; nothing else exists. */
export function toolToRive(tool: WhiteboardTool): number {
  return tool === 'highlight' ? 1 : tool === 'eraser' ? 2 : 0;
}

/** `ink` state → the `ink` view-model index into the palette row. */
export function inkToRive(ink: WhiteboardInk): number {
  const i = (INK_IDS as readonly string[]).indexOf(ink);
  return i < 0 ? 0 : i;
}
