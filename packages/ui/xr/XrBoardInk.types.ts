// The spatial ink layer's contract, in a file the Viro renderer does not own.
//
// Same reason as `tutor-xr-screen.types.ts`: a type-only re-export is erased at
// build but still RESOLVED by a bundler, so naming `XrBoardInk.native.tsx` from
// the web fork is naming `@reactvision/react-viro` on web. The props live here
// instead, and `web-condition.test.ts` holds that line mechanically.
// SOT: packages/ui/xr/XrBoardInk.native.tsx · packages/app/features/tutor/tutor-xr-screen.types.ts
// SOT-KEYWORDS: xr board ink props types platform neutral no viro quickdraw store

export interface XrBoardInkProps {
  /** The document's store, as `snapshot().document.store`. */
  store: Readonly<Record<string, unknown>>;
  /** The paper's size in metres. Page pixels are mapped onto this. */
  width: number;
  height: number;
}
