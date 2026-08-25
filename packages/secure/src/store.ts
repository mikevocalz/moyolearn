// TS resolution anchor — bundlers load the .native/.web forks.
// A bare .ts anchor beats .native.ts in Metro resolution, so it must re-export.
// SOT: docs/pack/07-security-spec.md §2.1
// SOT-KEYWORDS: securestore anchor fork resolution

export {
  setSecure,
  getSecure,
  deleteSecure,
  isSecureStoreAvailable,
} from './store.web.ts';
