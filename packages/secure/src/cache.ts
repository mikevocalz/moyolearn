// TS resolution anchor — bundlers load the .native/.web forks.
// SOT: docs/pack/07-security-spec.md §2.2
// SOT-KEYWORDS: cache anchor fork resolution mmkv

export { openUserCache, wipeUserCache, putLearnerProjection } from './cache.web.ts';
