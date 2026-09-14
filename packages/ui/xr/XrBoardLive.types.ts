// The live board's contract, in a file the Viro renderer does not own.
//
// Same reason as `XrBoardRaster.types.ts`: a type-only re-export is erased at
// build but still RESOLVED by a bundler, so naming `XrBoardLive.native.tsx`
// from the web fork is naming `@reactvision/react-viro` on web.
// SOT: packages/ui/xr/XrBoardLive.native.tsx · apps/mobile/modules/board-texture
// SOT-KEYWORDS: xr board live texture props types platform neutral no viro quad

export interface XrBoardLiveProps {
  /** The paper's size in metres. The page is 5:7 and fills it exactly. */
  width: number;
  height: number;
}
