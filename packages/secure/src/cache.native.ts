// PLATFORM FORK — per-user encrypted MMKV (doc 07-security §2.2).
//
// One instance per user id, encrypted with a 256-bit key minted once and kept in
// SecureStore. Two properties matter on a shared family iPad and neither is
// available from a single shared cache: a sibling's instance is a different file
// with a different key, and signing out can destroy one user's local data
// without touching the other's.
//
// The learner rule is enforced here rather than trusted to call sites:
// `putLearnerProjection` rejects anything transcript-shaped. §2.2 says learner
// instances "exclude anything transcript-shaped — client caches hold
// schedule/mastery projections, never conversation bodies", and a rule that
// lives in prose gets broken by the first feature that finds it convenient to
// cache a reply for offline reading.
// SOT: docs/pack/07-security-spec.md §2.2
// SOT-KEYWORDS: mmkv encrypted per-user cache key signout wipe learner projection

import { createMMKV, type MMKV } from 'react-native-mmkv';
import { getSecure, setSecure, deleteSecure } from './store.native.ts';
import { assertNotTranscriptShaped } from './projection.ts';

/** 256 bits, hex — 64 characters, comfortably inside the 2KB SecureStore limit. */
function mintKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const instances = new Map<string, MMKV>();

/**
 * The user's encrypted instance, minting the key on first use. Cached in a Map
 * because `createMMKV` on an already-open id is wasteful, and because the
 * SecureStore read is async while every consumer of MMKV expects synchronous
 * reads — resolving the key once at sign-in is what keeps `getString` sync.
 */
export async function openUserCache(userId: string): Promise<MMKV> {
  const existing = instances.get(userId);
  if (existing !== undefined) return existing;

  let encryptionKey = await getSecure('mmkv.key', userId);
  if (encryptionKey === null) {
    encryptionKey = mintKey();
    await setSecure('mmkv.key', encryptionKey, userId);
  }

  const instance = createMMKV({ id: `user.${userId}`, encryptionKey });
  instances.set(userId, instance);
  return instance;
}

/**
 * Sign-out: the instance's contents AND its key. Clearing the data alone would
 * leave a key in the keychain for a file that no longer exists, and the next
 * sign-in would silently reuse it — §2.2 asks for both to go.
 */
export async function wipeUserCache(userId: string): Promise<void> {
  const instance = instances.get(userId) ?? (await openUserCache(userId));
  instance.clearAll();
  instances.delete(userId);
  await deleteSecure('mmkv.key', userId);
}

/** The only supported way to cache anything on a learner's device. */
export function putLearnerProjection(cache: MMKV, key: string, value: unknown): void {
  assertNotTranscriptShaped(key, value);
  cache.set(key, JSON.stringify(value));
}
