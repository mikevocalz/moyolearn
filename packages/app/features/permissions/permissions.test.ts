// The two rules a checklist row is drawn from, pinned.
//
// Both fail silently. `canAsk` wrong in one direction offers a button the OS
// ignores — the child presses it, nothing happens, and there is no error to
// read; wrong in the other it hides the only button that would have worked and
// sends a guardian to a Settings page for a permission nobody has been asked
// about. `allGranted` wrong lets a feature open a capture the OS will refuse.
// SOT: packages/app/features/permissions/permissions.types.ts
// SOT-KEYWORDS: permissions test canAsk allGranted blocked undetermined checklist

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  allGranted,
  canAsk,
  PERMISSION_COPY,
  PERMISSION_KEYS,
  type PermissionKey,
  type PermissionState,
} from './permissions.types.ts';

test('a dialog is offered exactly when the OS would show one', () => {
  assert.equal(canAsk('undetermined'), true);
  assert.equal(canAsk('denied'), true);
  /* The whole reason `blocked` is a separate state: asking again is a no-op. */
  assert.equal(canAsk('blocked'), false);
  /* And re-asking for something already granted is a dialog for nothing. */
  assert.equal(canAsk('granted'), false);
});

test('only a real grant counts as granted', () => {
  const statuses = {
    microphone: 'granted',
    camera: 'undetermined',
    photos: 'blocked',
  } satisfies Record<PermissionKey, PermissionState>;
  assert.equal(allGranted(statuses, ['microphone']), true);
  /* `undetermined` is not a grant. Treating it as one is how a feature opens a
     capture session the OS then refuses, with no dialog to explain why. */
  assert.equal(allGranted(statuses, ['microphone', 'camera']), false);
  assert.equal(allGranted(statuses, ['photos']), false);
});

test('asking for nothing is satisfied', () => {
  const statuses = Object.fromEntries(
    PERMISSION_KEYS.map((k) => [k, 'denied' as PermissionState]),
  ) as Record<PermissionKey, PermissionState>;
  assert.equal(allGranted(statuses, []), true);
});

test('every key a guardian can be shown says what it is for', () => {
  /* A row with no reason is a system dialog with no explanation in front of it,
     which is the thing a primer exists to prevent. */
  for (const key of PERMISSION_KEYS) {
    const copy = PERMISSION_COPY[key];
    assert.ok(copy.title.length > 0, `${key} has no title`);
    assert.ok(copy.reason.length > 12, `${key} has no usable reason`);
  }
});
