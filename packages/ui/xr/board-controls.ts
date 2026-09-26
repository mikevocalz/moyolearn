// The board's control vocabulary, once — shared by the rail and the tray.
//
// These tables lived private inside `XrRail.native.tsx`, which was safe while
// the rail was the only spatial toolbar. The tray is the same toolbar stood
// horizontal, and two copies of "the same seven inks, in the same order, with
// the same words" is two places for a colour's name to drift — the exact
// inconsistency the labels exist to prevent (a child hears one name for a
// colour in this product, not two).
//
// Pure data with no renderer attached, so the web fork can name it too.
// SOT: packages/ui/Whiteboard.tsx (the 2D tray these mirror)
// SOT-KEYWORDS: xr board controls tools inks labels shared rail tray spatial

import type { WhiteboardInk, WhiteboardTool } from '../whiteboard.types.ts';

/** The three tools `WhiteboardTool` permits — no shapes, text, lasso or notes. */
export const BOARD_TOOLS = [
  { id: 'draw', glyph: 'Pen' },
  { id: 'highlight', glyph: 'Mark' },
  { id: 'eraser', glyph: 'Erase' },
] as const satisfies readonly { id: WhiteboardTool; glyph: string }[];

/**
 * `Whiteboard.tsx`'s `INKS` — same order, same seven, and THE SAME WORDS.
 *
 * The labels are the ones the 2D tray already puts in `aria-label`, copied
 * rather than imported because `INKS` is private to that component. "Purple"
 * for `violet` is the 2D copy's own choice and is kept.
 *
 * A control with no drawn name does not exist in this scene: `ViroText`
 * exposes no accessibility label, so the word on the key is the only
 * accessible name it can have — SC 1.4.1 Use of Colour at Level A
 * (`06-a11y.md` F3) is not repairable any other way.
 */
export const BOARD_INKS = [
  { id: 'black', label: 'Black' },
  { id: 'blue', label: 'Blue' },
  { id: 'red', label: 'Red' },
  { id: 'green', label: 'Green' },
  { id: 'yellow', label: 'Yellow' },
  { id: 'orange', label: 'Orange' },
  { id: 'violet', label: 'Purple' },
] as const satisfies readonly { id: WhiteboardInk; label: string }[];

/** The current ink's word, for the well that opens the palette. */
export const inkLabel = (id: WhiteboardInk): string =>
  BOARD_INKS.find((entry) => entry.id === id)?.label ?? BOARD_INKS[0].label;
