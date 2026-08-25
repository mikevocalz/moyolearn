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

/** Every key the wipe clears. Per-user entries need their ids from the caller. */
export const wipeableKeys = (): SecureKey[] =>
  (Object.keys(SECURE_KEYS) as SecureKey[]).filter((key) => !SECURE_KEYS[key].perUser);

export interface ReinstallDeps {
  marker: InstallMarkerStore;
  deleteSecure: (key: SecureKey, userId?: string) => Promise<void>;
  /** User ids whose per-user entries should go too, when any are known. */
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

  for (const key of wipeableKeys()) {
    await deps.deleteSecure(key);
  }
  for (const userId of deps.knownUserIds ?? []) {
    for (const key of Object.keys(SECURE_KEYS) as SecureKey[]) {
      if (SECURE_KEYS[key].perUser) await deps.deleteSecure(key, userId);
    }
  }

  // Written last. A crash mid-wipe leaves the marker absent, so the next launch
  // wipes again — repeating a delete is free, skipping one leaves a key behind.
  deps.marker.set(INSTALL_MARKER, INSTALL_GENERATION);
  return true;
}
