// The spatial paper's picture-of-the-board contract, in a file the Viro
// renderer does not own.
//
// Same reason as `XrBoardInk.types.ts`: a type-only re-export is erased at build
// but still RESOLVED by a bundler, so naming `XrBoardRaster.native.tsx` from the
// web fork is naming `@reactvision/react-viro` on web.
// SOT: packages/ui/xr/XrBoardRaster.native.tsx · packages/ui/xr/XrBoardInk.types.ts
// SOT-KEYWORDS: xr board raster props types platform neutral no viro png data url

export interface XrBoardRasterProps {
  /**
   * The engine's own PNG of the whole document, as a data URL — or `null` when
   * no raster has been taken yet, or the board is empty.
   *
   * `null` renders nothing and is not an error: an empty board is the paper,
   * and the paper is already drawn by `XrPanel`.
   */
  uri: string | null;
  /** The paper's size in metres. The picture is 6:4 and fills it exactly. */
  width: number;
  height: number;
}
