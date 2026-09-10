// A side-effect stylesheet import is not a module TypeScript knows how to type.
//
// `whiteboard-board.web.tsx` imports Quickdraw's stylesheet because it is
// structural — `.qd-root` is `position: relative` and `.qd-canvas` is
// `position: absolute; inset: 0`, so without it the board renders as a
// zero-height strip. Same one-line declaration `apps/storybook` already carries.
declare module '*.css';
