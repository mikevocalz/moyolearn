// @acme/secure — client hardening (doc 07-security §2, doc 07-child-ai PR-19).
//
// The device gets its own package because a children's-education app lives on
// shared family hardware: the strongest server posture in the world does not
// help if a sibling opens the parent's billing tab on the kitchen iPad. Every
// export here is a control with a documented platform constraint behind it, and
// the platform forks exist so no shared code branches on `Platform.OS`.
//
// Two build gates keep this honest rather than aspirational:
// `tooling/check-secure-keys.mjs` fails on any expo-secure-store call outside
// this package, and `tooling/check-public-env.mjs` fails on an `EXPO_PUBLIC_`
// variable that is not on the publishable allowlist.
// SOT: docs/pack/07-security-spec.md §2 · docs/pack/07-security-child-ai-safety-spec.md PR-19
// SOT-KEYWORDS: secure barrel securestore mmkv deep link capture reinstall hardening client

export {
  SECURE_KEYS,
  SECURE_VALUE_LIMIT_BYTES,
  isSecureKey,
  secureKeyName,
  byteLength,
  assertWithinLimit,
} from './src/policy';
export type { KeychainAccessible, SecureKey, SecureKeySpec } from './src/policy';

export { setSecure, getSecure, deleteSecure, isSecureStoreAvailable } from './src/store';

export {
  runReinstallWipe,
  shouldWipeSecureStore,
  wipeableKeys,
  INSTALL_MARKER,
  INSTALL_GENERATION,
} from './src/reinstall';
export type { InstallMarkerStore, ReinstallDeps } from './src/reinstall';

export { openUserCache, wipeUserCache, putLearnerProjection } from './src/cache';
export { assertNotTranscriptShaped, MAX_CACHED_STRING } from './src/projection';

export { parseDeepLink, isDeepLinkRoute, DEEP_LINK_ROUTES } from './src/deep-links';
export type { DeepLinkResult, DeepLinkRoute } from './src/deep-links';

export { useScreenCaptureGuard } from './src/capture';
export type { CaptureGuard } from './src/capture';
