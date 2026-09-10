// TS resolution anchor — bundlers load the .native/.web forks.
//
// `.tsx`, matching the forks. Metro tries every `.ts` variant before any `.tsx`
// one, so a `.ts` anchor beside `.tsx` forks wins on device and ships the web
// build to the phone. No `exports` subpath either: Metro resolves an exports
// target literally and platform extensions are never applied to it.
//
// Native: Quickdraw's engine inside a WebView. Web: the same engine in a div.
// SOT: packages/ui/whiteboard-board.native.tsx
// SOT-KEYWORDS: whiteboard board anchor platform fork quickdraw resolution
export { WhiteboardBoard } from './whiteboard-board.web';
