// PLATFORM FORK — the only code in the app that talks to expo-secure-store.
//
// Every write goes through the §2.1 policy: the key must be in the table, the
// value must be under the documented 2048-byte limit, and the keychain options
// come from the table rather than from the call site. A call site that could
// pass its own `keychainAccessible` is a call site that will one day pass the
// default, and the default is backed up and restorable onto another device.
// SOT: docs/pack/07-security-spec.md §2.1
// SOT-KEYWORDS: securestore native keychain read write delete policy binding

import * as SecureStore from 'expo-secure-store';
import {
  assertWithinLimit,
  secureKeyName,
  SECURE_KEYS,
  type SecureKey,
} from './policy.ts';

const optionsFor = (key: SecureKey): SecureStore.SecureStoreOptions => {
  const spec = SECURE_KEYS[key];
  return {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    ...(spec.requireAuthentication ? { requireAuthentication: true } : {}),
  };
};

export async function setSecure(key: SecureKey, value: string, userId?: string): Promise<void> {
  assertWithinLimit(key, value);
  await SecureStore.setItemAsync(secureKeyName(key, userId), value, optionsFor(key));
}

/**
 * Returns null rather than throwing when the entry is gone. For
 * `requireAuthentication` keys "gone" also covers the documented case where the
 * device's biometric set changed and the OS invalidated the entry — the caller
 * cannot tell those apart, and must not need to (see `parent-gate.ts`).
 */
export async function getSecure(key: SecureKey, userId?: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(secureKeyName(key, userId), optionsFor(key));
  } catch {
    return null;
  }
}

export async function deleteSecure(key: SecureKey, userId?: string): Promise<void> {
  await SecureStore.deleteItemAsync(secureKeyName(key, userId), optionsFor(key));
}

/** Whether the platform can hold secure entries at all. False on web. */
export const isSecureStoreAvailable = async (): Promise<boolean> =>
  SecureStore.isAvailableAsync();
