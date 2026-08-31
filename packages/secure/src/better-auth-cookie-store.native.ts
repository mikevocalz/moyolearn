// PLATFORM FORK — the Better Auth Expo cookie jar backed by expo-secure-store.
//
// The expo plugin chunks and prefixes cookie values, so each `key` it passes
// becomes a sub-key under the one `better-auth.session` SecureKey namespace.
// The `better-auth.session` row in the §2.1 table owns the policy, and every
// write is asserted against the 2KB limit before it reaches the keychain.
// SOT: docs/pack/07-security-spec.md §2.1
// SOT-KEYWORDS: better-auth cookie storage native secure keychain session

import * as SecureStore from 'expo-secure-store';
import { assertWithinLimit, secureKeyName, type SecureKey } from './policy.ts';

const SESSION_KEY: SecureKey = 'better-auth.session';
const BASE_KEY = secureKeyName(SESSION_KEY);

/**
 * Better Auth normalizes away colons before they hit the storage adapter; the
 * same normalization lives here so a server cookie name cannot mismatch the
 * stored key just because of a colon.
 */
const normalizeCookieName = (name: string) => name.replace(/:/g, '_');

const storageKey = (name: string) => `${BASE_KEY}.${normalizeCookieName(name)}`;

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

async function getItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(storageKey(key), options);
  } catch {
    // A missing or invalidated keychain entry (for example, after a biometric
    // set change) is the same as "not found" for a session cookie.
    return null;
  }
}

async function setItem(key: string, value: string): Promise<void> {
  assertWithinLimit(SESSION_KEY, value);
  await SecureStore.setItemAsync(storageKey(key), value, options);
}

async function removeItem(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(storageKey(key), options);
}

export const betterAuthCookieStorage = {
  getItem,
  getItemAsync: getItem,
  setItem,
  setItemAsync: setItem,
  removeItem,
};
