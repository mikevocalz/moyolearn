// This package typechecks `@acme/ui`'s sources, and one of them
// (`whiteboard-board.web.tsx`) imports Quickdraw's stylesheet — the board's
// canvas has no box without it. Same one-line declaration `apps/mobile` and
// `apps/storybook` already carry for the same reason.
declare module '*.css';
