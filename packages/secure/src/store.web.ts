// PLATFORM FORK — there is no SecureStore on web, and there is no substitute.
//
// §2.1: "web sessions ride Better Auth's httpOnly cookies instead; no token ever
// touches localStorage". So these throw rather than degrading to `localStorage`,
// because a silent fallback is exactly how a session token ends up somewhere any
// script on the page can read. A caller that reaches here on web has a bug in
// its platform assumptions, and the stack trace is the useful outcome.
// SOT: docs/pack/07-security-spec.md §2.1
// SOT-KEYWORDS: securestore web unavailable httponly cookie no-fallback

import type { SecureKey } from './policy.ts';

const unavailable = (key: SecureKey): never => {
  throw new Error(
    `SecureStore is not available on web (attempted "${key}"). Web sessions ride Better Auth httpOnly cookies; nothing secret goes in localStorage.`,
  );
};

export const setSecure = async (key: SecureKey, _value: string, _userId?: string): Promise<void> =>
  unavailable(key);

export const getSecure = async (key: SecureKey, _userId?: string): Promise<string | null> =>
  unavailable(key);

export const deleteSecure = async (key: SecureKey, _userId?: string): Promise<void> =>
  unavailable(key);

export const isSecureStoreAvailable = async (): Promise<boolean> => false;
