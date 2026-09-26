// The bottom tray's contract, in a file the Viro renderer does not own.
//
// Same arrangement as `XrRail.types.ts`: a type-only import here lets the web
// fork name the tray's props without resolving `@reactvision/react-viro`,
// which is what `web-condition.test.ts` asserts mechanically.
// SOT: packages/ui/xr/XrBoardTray.native.tsx · packages/ui/xr/XrRail.types.ts
// SOT-KEYWORDS: xr board tray props types platform neutral no viro toolbar bottom row

import type { WhiteboardInk, WhiteboardTool } from '../whiteboard.types.ts';
import type { SpatialBand } from './spatial-tokens.ts';

export interface XrBoardTrayProps {
  /** The tray's span in metres — at most the paper's width it hangs under. */
  width: number;
  /** How far the tray is from the child, for hit sizing. */
  distanceM: number;
  handsPrimary: boolean;
  /**
   * The signed-in learner's age band, which sizes every key on the tray.
   *
   * Required for the same reason it is on the rail: a band that can be omitted
   * is a band that gets omitted, and the omission is invisible.
   */
  band: SpatialBand;
  tool: WhiteboardTool;
  ink: WhiteboardInk;
  canUndo: boolean;
  canRedo: boolean;
  /** True while a board is being sent to the tutor; the ask key says so. */
  asking: boolean;
  onTool: (tool: WhiteboardTool) => void;
  onInk: (ink: WhiteboardInk) => void;
  onUndo: () => void;
  onRedo: () => void;
  onAsk: () => void;
  onClear: () => void;
}
