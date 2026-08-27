// The reinstall wipe.
//
// The bug this exists for is iOS-specific and silent: keychain entries SURVIVE
// an app uninstall. Delete the app, reinstall it, and the previous owner's
// session cookie and MMKV encryption key are still sitting there — on a family
// device that is the previous *child's* key, readable by whoever installs the
// app next. Android's Keystore is cleared with the app, so this is a wipe that
// only ever fires on iOS, which is precisely why it gets forgotten.
//
// The detector is the asymmetry itself: the marker lives in app-container
// storage, which IS deleted on uninstall, while the secrets live in the keychain,
// which is not. Marker absent + secrets present ⇒ this is a fresh install over an
// old keychain ⇒ wipe. Marker present ⇒ ordinary launch.
//
// The predicate is pure and separate from the wipe so the interesting half is
// testable without a device; `runReinstallWipe` is the thin binding.
// SOT: docs/pack/07-security-spec.md §2.1 §2.2
// SOT-KEYWORDS: reinstall wipe keychain survives uninstall first launch marker ios

import { SECURE_KEYS, type SecureKey } from './policy.ts';

/** Written to app-container storage on first launch; gone after an uninstall. */
export const INSTALL_MARKER = 'moyo.install.generation';

export interface InstallMarkerStore {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
}

/**
 * Bumped when a change makes previously-stored secure material unsafe or
 * unreadable — a key-format change, say. A bump wipes every device on next
 * launch, which is the cheap version of a migration nobody can test.
 */
export const INSTALL_GENERATION = '1';

export const shouldWipeSecureStore = (marker: string | undefined): boolean =>
  marker !== INSTALL_GENERATION;

/** Every key the wipe clears directly. Per-user entries are found via the index. */
export const wipeableKeys = (): SecureKey[] =>
  (Object.keys(SECURE_KEYS) as SecureKey[]).filter((key) => !SECURE_KEYS[key].perUser);

/**
 * A ceiling on the `mmkv.users` index, so it cannot grow past the 2KB
 * SecureStore limit and start throwing inside sign-in. A family device holds a
 * handful of accounts; a device that somehow passes this many has a stale index
 * rather than that many real users, and the OLDEST entries are the ones dropped
 * — the newest ids are the ones whose keys most likely still exist.
 */
export const MAX_INDEXED_USERS = 32;

/**
 * The `mmkv.users` value, parsed. Total: a corrupt or hand-edited entry reads
 * as an empty index rather than throwing, because a wipe that crashes on a bad
 * index is a wipe that does not run — and not running is the failure mode this
 * whole file exists to prevent.
 */
export function parseUserIndex(raw: string | null | undefined): string[] {
  if (raw === null || raw === undefined || raw === '') return [];
  try {
    const decoded: unknown = JSON.parse(raw);
    if (!Array.isArray(decoded)) return [];
    return decoded.filter((id): id is string => typeof id === 'string' && id !== '');
  } catch {
    return [];
  }
}

/** The index with `userId` present, newest last. Idempotent. */
export const withIndexedUser = (raw: string | null | undefined, userId: string): string =>
  JSON.stringify(
    [...parseUserIndex(raw).filter((id) => id !== userId), userId].slice(-MAX_INDEXED_USERS),
  );

/** The index with `userId` gone — sign-out, which deletes that user's key. */
export const withoutIndexedUser = (raw: string | null | undefined, userId: string): string =>
  JSON.stringify(parseUserIndex(raw).filter((id) => id !== userId));

export interface ReinstallDeps {
  marker: InstallMarkerStore;
  deleteSecure: (key: SecureKey, userId?: string) => Promise<void>;
  /**
   * Reads a keychain entry. Present so the wipe can consult the `mmkv.users`
   * index, which is the only way it can name the per-user keys it must delete.
   */
  readSecure?: (key: SecureKey, userId?: string) => Promise<string | null>;
  /**
   * User ids whose per-user entries should go too. Kept beside the index rather
   * than replaced by it: a caller that already knows who was signed in loses
   * nothing, and the two sources are unioned.
   */
  knownUserIds?: readonly string[];
}

/**
 * Runs once at launch, before anything reads a session. Returns whether it
 * wiped, so the caller can log it — a wipe that happens invisibly is a support
 * ticket ("it signed me out") with no explanation attached.
 */
export async function runReinstallWipe(deps: ReinstallDeps): Promise<boolean> {
  const marker = deps.marker.getString(INSTALL_MARKER);
  if (!shouldWipeSecureStore(marker)) return false;

  /*
    THE INDEX IS READ FIRST, before the loop below deletes it.

    `wipeableKeys()` filters per-user entries OUT, so for a long time the wipe
    could only clear `mmkv.key.<id>` for ids the caller handed it — and in the
    situation this wipe exists for, nobody can hand it any. The header says why:
    the marker is absent precisely because the app container was deleted, and
    every store that could have remembered who was signed in went with it. So
    the previous child's MMKV key survived, in the keychain, beside their MMKV
    file — the exact "previous child's key, readable by whoever installs the app
    next" this file opens by naming.
  */
  const indexed = parseUserIndex(await deps.readSecure?.('mmkv.users'));
  const userIds = new Set([...indexed, ...(deps.knownUserIds ?? [])]);

  const perUserKeys = (Object.keys(SECURE_KEYS) as SecureKey[]).filter(
    (key) => SECURE_KEYS[key].perUser,
  );
  for (const userId of userIds) {
    for (const key of perUserKeys) {
      await deps.deleteSecure(key, userId);
    }
  }

  // `mmkv.users` is not per-user, so this loop retires the index itself too.
  for (const key of wipeableKeys()) {
    await deps.deleteSecure(key);
  }

  // Written last. A crash mid-wipe leaves the marker absent, so the next launch
  // wipes again — repeating a delete is free, skipping one leaves a key behind.
  deps.marker.set(INSTALL_MARKER, INSTALL_GENERATION);
  return true;
}
