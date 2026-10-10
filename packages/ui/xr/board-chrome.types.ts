import type { WhiteboardInk, WhiteboardTool } from '../whiteboard.types.ts';

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
  /** The Ask button's up/exit edge — push-to-talk pairs down/up. */
  onAskEnd?(): void;
}

