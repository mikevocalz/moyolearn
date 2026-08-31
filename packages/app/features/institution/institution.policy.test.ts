// Institution permission policy tests — the role/scope matrix from the brief.
// SOT: packages/app/features/institution/institution.policy.ts
// SOT-KEYWORDS: institution permission policy test role scope resource action

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { can, allowedActions, requirePermission, InstitutionPermissionDenied } from './institution.policy.ts';
import type { RoleKind } from '../../providers/session/types.ts';

describe('institution permission policy', () => {
  describe('district_admin in district scope', () => {
    it('can manage schools, programs, people and tenant', () => {
      assert.equal(can('district_admin', 'district', 'schools', 'manage'), true);
      assert.equal(can('district_admin', 'district', 'programs', 'manage'), true);
      assert.equal(can('district_admin', 'district', 'people', 'manage'), true);
      assert.equal(can('district_admin', 'district', 'tenant', 'manage'), true);
      assert.equal(can('district_admin', 'district', 'settings', 'manage'), true);
    });

    it('can view reports', () => {
      assert.equal(can('district_admin', 'district', 'reports', 'view'), true);
    });

    it('cannot delete people', () => {
      assert.equal(can('district_admin', 'district', 'people', 'delete'), false);
    });

    it('cannot touch billing', () => {
      assert.equal(can('district_admin', 'district', 'billing', 'view'), false);
    });

    it('manage implies view', () => {
      assert.equal(can('district_admin', 'district', 'schools', 'view'), true);
    });
  });

  describe('school_admin in school scope', () => {
    it('can manage people and programs', () => {
      assert.equal(can('school_admin', 'school', 'people', 'manage'), true);
      assert.equal(can('school_admin', 'school', 'programs', 'manage'), true);
      assert.equal(can('school_admin', 'school', 'settings', 'manage'), true);
    });

    it('can view schools but not manage them', () => {
      assert.equal(can('school_admin', 'school', 'schools', 'view'), true);
      assert.equal(can('school_admin', 'school', 'schools', 'manage'), false);
    });

    it('can delete people in its own school', () => {
      assert.equal(can('school_admin', 'school', 'people', 'delete'), true);
    });

    it('cannot act outside the school scope', () => {
      assert.equal(can('school_admin', 'district', 'schools', 'manage'), false);
      assert.equal(can('school_admin', 'own_org', 'people', 'manage'), false);
    });
  });

  describe('owner in own_org scope', () => {
    it('has full control of the business', () => {
      assert.equal(can('owner', 'own_org', 'people', 'manage'), true);
      assert.equal(can('owner', 'own_org', 'billing', 'manage'), true);
      assert.equal(can('owner', 'own_org', 'tenant', 'manage'), true);
    });

    it('cannot act in school or district scopes', () => {
      assert.equal(can('owner', 'school', 'people', 'manage'), false);
      assert.equal(can('owner', 'district', 'schools', 'manage'), false);
    });
  });

  describe('staff in own_org scope', () => {
    it('can view people and reports', () => {
      assert.equal(can('staff', 'own_org', 'people', 'view'), true);
      assert.equal(can('staff', 'own_org', 'reports', 'view'), true);
    });

    it('cannot manage people or billing', () => {
      assert.equal(can('staff', 'own_org', 'people', 'manage'), false);
      assert.equal(can('staff', 'own_org', 'billing', 'view'), false);
    });

    it('can manage programs', () => {
      assert.equal(can('staff', 'own_org', 'programs', 'manage'), true);
    });
  });

  describe('consumer roles', () => {
    it('denies all institutional actions for learner, guardian, tutor, teacher', () => {
      const roles: RoleKind[] = ['learner', 'guardian', 'tutor', 'teacher'];
      for (const role of roles) {
        assert.equal(can(role, 'school', 'people', 'view'), false);
        assert.equal(can(role, 'district', 'schools', 'view'), false);
        assert.equal(can(role, 'own_org', 'reports', 'view'), false);
      }
    });
  });

  describe('requirePermission', () => {
    it('runs the operation when allowed', () => {
      const value = requirePermission('district_admin', 'district', 'schools', 'manage', () => 42);
      assert.equal(value, 42);
    });

    it('throws InstitutionPermissionDenied when denied', () => {
      assert.throws(
        () => requirePermission('staff', 'own_org', 'billing', 'manage', () => 'secret'),
        (err) => err instanceof InstitutionPermissionDenied,
      );
    });
  });

  describe('allowedActions', () => {
    it('includes view when manage is granted', () => {
      assert.deepEqual(allowedActions('district_admin', 'district', 'schools'), ['view', 'manage', 'invite']);
    });

    it('returns empty for an unknown scope/role pair', () => {
      assert.deepEqual(allowedActions('teacher', 'district', 'schools'), []);
    });
  });
});
