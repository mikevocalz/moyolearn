// Role dimension tests — the session's education/application role is distinct from
// the Better Auth organisation role.
// SOT: docs/pack/06-auth-onboarding-spec.md §1
// SOT-KEYWORDS: session role education organization mapping test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isRoleKind, roleForOrganizationRole } from './role-mapping.ts';

describe('session role mapping', () => {
  it('identifies valid education roles', () => {
    assert.equal(isRoleKind('teacher'), true);
    assert.equal(isRoleKind('guardian'), true);
    assert.equal(isRoleKind('owner'), true);
    assert.equal(isRoleKind('admin'), false);
    assert.equal(isRoleKind(undefined), false);
  });

  it('resolves a default education role for each organisation role', () => {
    assert.equal(roleForOrganizationRole('owner'), 'owner');
    assert.equal(roleForOrganizationRole('manager'), 'staff');
    assert.equal(roleForOrganizationRole('scheduler'), 'staff');
    assert.equal(roleForOrganizationRole('finance'), 'staff');
  });

  it('returns undefined for unknown or missing organisation roles', () => {
    assert.equal(roleForOrganizationRole(null), undefined);
    assert.equal(roleForOrganizationRole(undefined), undefined);
    assert.equal(roleForOrganizationRole('admin' as never), undefined);
  });
});
