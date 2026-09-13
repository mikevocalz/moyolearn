// The control rail's contract, in a file the Viro renderer does not own.
//
// Same reason as `tutor-xr-screen.types.ts`: the web fork must not name the
// native rail even for a type. A type-only re-export is erased at build, but it
// is still a specifier a bundler RESOLVES, and resolving `XrRail.native.tsx`
// means resolving `@reactvision/react-viro` on web. So the props live here and
// both forks read them from the same place — which is also what lets
// `web-condition.test.ts` assert the property mechanically instead of trusting
// that every transpiler in the chain erases the same things.
// SOT: packages/ui/xr/XrRail.native.tsx · packages/app/features/tutor/tutor-xr-screen.types.ts
// SOT-KEYWORDS: xr rail props types platform neutral no viro ornament toolbar

import type { WhiteboardInk, WhiteboardTool } from '../whiteboard.types.ts';

export interface XrRailProps {
  width: number;
  /** The paper's height — the rail is never taller than what it belongs to. */
  height: number;
  /** How far the rail is from the child, for hit sizing. */
  distanceM: number;
  handsPrimary: boolean;
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
