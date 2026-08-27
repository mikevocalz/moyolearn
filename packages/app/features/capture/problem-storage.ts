// TS resolution anchor — bundlers load the .native/.web forks.
//
// Only the STORAGE is forked. The pure helpers live in `.shared.ts` and must be
// imported from there: a bundler picks the fork over this file, so re-exporting
// them here would typecheck and then fail at build with "export doesn't exist
// in target module".
export { problemStorage } from './problem-storage.web';
export type { ProblemStorage } from './problem-storage.shared.ts';
