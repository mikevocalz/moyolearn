// The SecureStore key table (doc 07-security §2.1), as code rather than as a
// row in a markdown file.
//
// §6's PR checklist says "no new SecureStore key without a §2.1 table row". A
// checklist item is a thing a reviewer remembers; this map is a thing the
// compiler enforces — `SecureKey` is derived from it, so a key that is not in
// the table is not a value the store will accept. `tooling/check-secure-keys.mjs`
// closes the other half by failing the build on any `expo-secure-store` call
// made outside this package.
//
// Every rule below is a documented expo-secure-store constraint, not a
// preference, and each carries the constraint it encodes because the reason is
// what survives a refactor.
// SOT: docs/pack/07-security-spec.md §2.1
// SOT-KEYWORDS: securestore policy keys keychain accessible table limit biometric parent gate

/**
 * The documented value limit. It is a warning today and the docs say a future
 * SDK may throw; some iOS releases have rejected larger values outright. So it
 * is enforced here as a hard error rather than left to a platform that may or
 * may not complain — SecureStore holds keys and tokens, and anything that
 * approaches 2KB is a payload that belongs in encrypted MMKV instead.
 */
export const SECURE_VALUE_LIMIT_BYTES = 2048;

/**
 * `WHEN_UNLOCKED_THIS_DEVICE_ONLY` for everything. Two properties, both load
 * bearing: not readable while the device is locked, and the `THIS_DEVICE_ONLY`
 * family is excluded from backup and device migration — session material must
 * never restore onto a different device, which on a family iPad is not a
 * hypothetical.
 */
export type KeychainAccessible = 'WHEN_UNLOCKED_THIS_DEVICE_ONLY';

export interface SecureKeySpec {
  /** What lives here. Reviewed against §2.1 when a key is added. */
  content: string;
  keychainAccessible: KeychainAccessible;
  /**
   * Biometric/passcode challenge on READ. Reserved for the parent-gate secret:
   * the option is documented to invalidate the entry when the device's
   * biometric set changes, so every `requireAuthentication` key must have a
   * recovery path that does not involve the biometric (see `parent-gate.ts`).
   */
  requireAuthentication: boolean;
  /** Per-user keys are namespaced by the auth user id at call time. */
  perUser: boolean;
}

export const SECURE_KEYS = {
  /**
   * The Better Auth session cookie is written by `expoClient`, which manages its
   * own entry; it is listed so the table is the whole truth about what this app
   * puts in the keychain, and so a reader does not conclude sessions live
   * somewhere else.
   */
  'better-auth.session': {
    content: 'Better Auth session cookie, written by the expoClient plugin',
    keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    requireAuthentication: false,
    perUser: false,
  },
  /** 256-bit key for the per-user encrypted MMKV instance (§2.2). */
  'mmkv.key': {
    content: '256-bit encryption key for that user’s MMKV instance',
    keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    requireAuthentication: false,
    perUser: true,
  },
  /** The parent gate's secret (§2.3) — the one entry behind a biometric. */
  'parentgate.secret': {
    content: 'Parent-gate secret, read behind a biometric/passcode challenge',
    keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    requireAuthentication: true,
    perUser: false,
  },
} as const satisfies Record<string, SecureKeySpec>;

export type SecureKey = keyof typeof SECURE_KEYS;

export const isSecureKey = (key: string): key is SecureKey => Object.hasOwn(SECURE_KEYS, key);

/**
 * The stored name. Per-user keys carry the user id so two accounts on one family
 * device cannot read each other's material — the shared-hardware case §2.3 is
 * built around. A per-user key without a user id is a programming error rather
 * than a fallback: silently writing a shared entry is how one child's cache
 * ends up decryptable by their sibling.
 */
export function secureKeyName(key: SecureKey, userId?: string): string {
  const spec = SECURE_KEYS[key];
  if (!spec.perUser) return key;
  if (userId === undefined || userId === '') {
    throw new Error(`SecureStore key "${key}" is per-user and requires a user id`);
  }
  return `${key}.${userId}`;
}

/** Byte length, not string length — a 2KB budget counts UTF-8, not code units. */
export const byteLength = (value: string): number => new TextEncoder().encode(value).length;

export function assertWithinLimit(key: SecureKey, value: string): void {
  const size = byteLength(value);
  if (size > SECURE_VALUE_LIMIT_BYTES) {
    throw new Error(
      `SecureStore value for "${key}" is ${size} bytes, over the documented ${SECURE_VALUE_LIMIT_BYTES}-byte limit. ` +
        'SecureStore holds keys and tokens; put the payload in encrypted MMKV and keep its key here.',
    );
  }
}
