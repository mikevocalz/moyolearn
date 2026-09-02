// TS resolution anchor — bundlers load the .native/.web forks.
// A bare .ts anchor beats .native.ts only cross-extension in Metro, so with a
// same-extension trio this re-export is types-and-web only (the List.tsx idiom).
// SOT-KEYWORDS: learner paths anchor fork resolution
export { stuffPath } from './learner-paths.web';
