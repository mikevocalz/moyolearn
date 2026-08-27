// The client-hardening invariants, and the ones a device would have to prove.
//
// Everything here is the pure half: the policy table, the reinstall predicate,
// the learner-projection shape rule, and deep-link parsing. That is deliberate —
// they are the parts that encode a decision, and a decision is what regresses.
//
// What this suite does NOT prove, stated so a green run is not over-read: that
// `WHEN_UNLOCKED_THIS_DEVICE_ONLY` actually excludes an entry from an iCloud
// backup, that FLAG_SECURE actually blanks the recents thumbnail, and that
// keychain entries survive an uninstall on the iOS version we ship against.
// Those are device facts behind the platform forks; they need a build and a
// physical restore test, and §7's pre-launch pen test is where they get checked.
// SOT: docs/pack/07-security-spec.md §2
// SOT-KEYWORDS: secure tests policy reinstall deep link projection limits

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseDeepLink } from './deep-links.ts';
import {
  SECURE_KEYS,
  SECURE_VALUE_LIMIT_BYTES,
  assertWithinLimit,
  byteLength,
  isSecureKey,
  secureKeyName,
  type SecureKey,
} from './policy.ts';
import { assertNotTranscriptShaped, MAX_CACHED_STRING } from './projection.ts';
import {
  INSTALL_GENERATION,
  INSTALL_MARKER,
  runReinstallWipe,
  parseUserIndex,
  withIndexedUser,
  withoutIndexedUser,
  MAX_INDEXED_USERS,
  shouldWipeSecureStore,
  wipeableKeys,
  type InstallMarkerStore,
} from './reinstall.ts';

const markerStore = (initial?: string): InstallMarkerStore & { value?: string } => {
  const store = {
    value: initial,
    getString: (_key: string) => store.value,
    set: (_key: string, value: string) => {
      store.value = value;
    },
  };
  return store;
};

test('every key in the table is device-only and un-backupable', () => {
  for (const spec of Object.values(SECURE_KEYS)) {
    assert.equal(spec.keychainAccessible, 'WHEN_UNLOCKED_THIS_DEVICE_ONLY');
  }
});

test('exactly one key sits behind a biometric — the parent gate', () => {
  const gated = Object.entries(SECURE_KEYS).filter(([, spec]) => spec.requireAuthentication);
  assert.deepEqual(gated.map(([key]) => key), ['parentgate.secret']);
});

test('a key outside the table is not a key', () => {
  assert.equal(isSecureKey('mmkv.key'), true);
  assert.equal(isSecureKey('some.new.idea'), false);
});

test('a per-user key without a user id throws rather than writing a shared entry', () => {
  assert.throws(() => secureKeyName('mmkv.key'), /per-user/);
  assert.equal(secureKeyName('mmkv.key', 'u-42'), 'mmkv.key.u-42');
});

test('two users get two different key names on the same device', () => {
  assert.notEqual(secureKeyName('mmkv.key', 'u-1'), secureKeyName('mmkv.key', 'u-2'));
});

test('the 2048-byte limit counts UTF-8 bytes, not string length', () => {
  // 600 astral characters: 1200 UTF-16 code units (`.length`, under the limit)
  // and 2400 UTF-8 bytes (over it). Counting the wrong one is how an oversized
  // value gets written and rejected on device.
  const emoji = '🔐'.repeat(600);
  assert.ok(emoji.length < SECURE_VALUE_LIMIT_BYTES);
  assert.ok(byteLength(emoji) > SECURE_VALUE_LIMIT_BYTES);
  assert.throws(() => assertWithinLimit('mmkv.key', emoji), /over the documented/);
});

test('a 256-bit hex key fits comfortably inside the limit', () => {
  assert.doesNotThrow(() => assertWithinLimit('mmkv.key', 'a'.repeat(64)));
});

test('a fresh install over a surviving keychain wipes; an ordinary launch does not', () => {
  assert.equal(shouldWipeSecureStore(undefined), true);
  assert.equal(shouldWipeSecureStore(INSTALL_GENERATION), false);
  // A generation bump is a wipe on every device, which is the point of it.
  assert.equal(shouldWipeSecureStore('0'), true);
});

test('the wipe clears every shared key and the known per-user ones, then marks', async () => {
  const marker = markerStore();
  const deleted: string[] = [];
  const wiped = await runReinstallWipe({
    marker,
    deleteSecure: async (key: SecureKey, userId?: string) => {
      deleted.push(userId === undefined ? key : `${key}.${userId}`);
    },
    knownUserIds: ['u-1'],
  });

  assert.equal(wiped, true);
  for (const key of wipeableKeys()) assert.ok(deleted.includes(key));
  assert.ok(deleted.includes('mmkv.key.u-1'));
  assert.equal(marker.getString(INSTALL_MARKER), INSTALL_GENERATION);
});

test('the wipe finds the previous child’s key with no caller who knows their id', async () => {
  /*
    The scenario the file's header opens with, exactly: child A used the family
    iPad, the app was deleted, child B reinstalls it. `knownUserIds` is empty
    and unknowable — the marker is absent precisely because the app container,
    and every record of who signed in, went with the uninstall. `wipeableKeys()`
    filters per-user entries out, so `mmkv.key.<A>` used to survive in the
    keychain beside child A's MMKV file. The keychain-resident index is what
    names it.
  */
  const marker = markerStore();
  const deleted: string[] = [];
  const wiped = await runReinstallWipe({
    marker,
    readSecure: async (key: SecureKey) =>
      key === 'mmkv.users' ? JSON.stringify(['child-a', 'child-b']) : null,
    deleteSecure: async (key: SecureKey, userId?: string) => {
      deleted.push(userId === undefined ? key : `${key}.${userId}`);
    },
  });

  assert.equal(wiped, true);
  assert.ok(deleted.includes('mmkv.key.child-a'), 'the previous child’s key survived the wipe');
  assert.ok(deleted.includes('mmkv.key.child-b'));
  assert.ok(deleted.includes('mmkv.users'), 'the index outlived the keys it named');
});

test('the index is a set, bounded, and survives a corrupt entry', () => {
  assert.deepEqual(parseUserIndex(JSON.stringify(['u-1', 'u-2'])), ['u-1', 'u-2']);
  // Re-adding moves an id to newest rather than duplicating it.
  assert.equal(withIndexedUser(JSON.stringify(['u-1', 'u-2']), 'u-1'), JSON.stringify(['u-2', 'u-1']));
  assert.equal(withoutIndexedUser(JSON.stringify(['u-1', 'u-2']), 'u-1'), JSON.stringify(['u-2']));

  // Total on garbage: a wipe that throws on a bad index is a wipe that does not
  // run, and not running is the failure this whole file exists to prevent.
  assert.deepEqual(parseUserIndex('not json'), []);
  assert.deepEqual(parseUserIndex(JSON.stringify({ u: 1 })), []);
  assert.deepEqual(parseUserIndex(JSON.stringify(['u-1', 7, null])), ['u-1']);
  assert.deepEqual(parseUserIndex(null), []);

  let index = JSON.stringify([]);
  for (let i = 0; i < MAX_INDEXED_USERS + 5; i += 1) index = withIndexedUser(index, `u-${String(i)}`);
  const bounded = parseUserIndex(index);
  assert.equal(bounded.length, MAX_INDEXED_USERS);
  assert.equal(bounded[bounded.length - 1], `u-${String(MAX_INDEXED_USERS + 4)}`);
});

test('a crash mid-wipe leaves the marker unset, so the next launch wipes again', async () => {
  const marker = markerStore();
  await assert.rejects(
    runReinstallWipe({
      marker,
      deleteSecure: async () => {
        throw new Error('keychain unavailable');
      },
    }),
  );
  assert.equal(marker.getString(INSTALL_MARKER), undefined);
  assert.equal(shouldWipeSecureStore(marker.getString(INSTALL_MARKER)), true);
});

test('the second launch does nothing', async () => {
  const marker = markerStore(INSTALL_GENERATION);
  let calls = 0;
  const wiped = await runReinstallWipe({
    marker,
    deleteSecure: async () => {
      calls += 1;
    },
  });
  assert.equal(wiped, false);
  assert.equal(calls, 0);
});

test('a transcript-shaped key is refused however innocent the value', () => {
  assert.throws(() => assertNotTranscriptShaped('lastReply', { ok: 1 }), /never leave the server/);
  assert.throws(() => assertNotTranscriptShaped('session.transcript', {}), /never leave the server/);
});

test('a conversation body hidden under an innocent key is still refused', () => {
  const projection = { skill: 'fractions', note: 'x'.repeat(MAX_CACHED_STRING + 1) };
  assert.throws(() => assertNotTranscriptShaped('todaysPath', projection), /conversation body/);
});

test('a real projection caches', () => {
  assert.doesNotThrow(() =>
    assertNotTranscriptShaped('todaysPath', {
      stops: [{ skillId: 'fraction-addition', done: true }],
      masteryP: 0.62,
      dueAt: '2026-03-04T00:00:00.000Z',
    }),
  );
});

test('a child identifier in a link is refused before the schema even runs', () => {
  const result = parseDeepLink('/memory', { learner: 'maya' });
  assert.equal(result.ok, false);
  assert.match(result.ok ? '' : result.reason, /may never appear in a link/);
});

test('a session token in a link is refused whatever its casing', () => {
  assert.equal(parseDeepLink('/', { Token: 'abc' }).ok, false);
  assert.equal(parseDeepLink('/', { SESSION: 'abc' }).ok, false);
});

test('a route not in the map is not deep-linkable', () => {
  assert.equal(parseDeepLink('/settings', {}).ok, false);
});

test('a known route with valid params parses', () => {
  const result = parseDeepLink('/onboarding/[flow]', { flow: 'guardian' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.ok ? result.params : null, { flow: 'guardian' });
});

test('an unknown flow is rejected rather than rendered', () => {
  assert.equal(parseDeepLink('/onboarding/[flow]', { flow: 'admin' }).ok, false);
});

test('an extra param is rejected, not ignored', () => {
  // Strict schemas: a param nobody declared is a param nobody validated.
  assert.equal(parseDeepLink('/memory', { ref: 'email' }).ok, false);
});

test('ids in links stay opaque — a name-shaped id does not parse', () => {
  assert.equal(parseDeepLink('/split', { event: 'evt_9fA-2' }).ok, true);
  assert.equal(parseDeepLink('/split', { event: 'maya smith 4pm' }).ok, false);
});
