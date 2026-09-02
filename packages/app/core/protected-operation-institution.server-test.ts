// The institution permission gate, proved end to end through `protectedOperation`.
//
// The host step has already narrowed `ctx.orgId` to the district named by the
// request; this test is that `requiresInstitution` then maps the member's
// organisation role and the org's `kind` to a `RoleKind` and enforces the
// fine-grained institution policy.
//
// `.server-test.ts` because the Block imports `@acme/auth/server`, which is
// server-only.
// SOT: docs/pack/11-architectural-guardrails.md §3 · docs/pack/36-role-navigation-flows.md §3.4
// SOT-KEYWORDS: protected operation institution permission gate role kind district school test

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { Auth } from '@acme/auth/server';
import type { MembershipRole } from '@acme/auth/membership';
import type { OrganizationKind } from '../providers/session/role-mapping.ts';
import type { LoadSubscriptions } from './capability-gate.ts';
import { InstitutionPermissionDenied } from '../features/institution/institution.policy.ts';
import { protectedOperation, type ProtectedCtx } from './protected-operation.ts';
import { setOperationSink } from './telemetry.ts';

const ROOT = 'moyolearn.com';

interface SessionUser {
  id: string;
  guardianManaged?: boolean;
  orgId?: string;
}

const authFor = (user: SessionUser): Auth =>
  Object.assign({} as Auth, {
    api: { getSession: async (): Promise<{ user: SessionUser }> => ({ user }) },
  });

const headersFor = (host: string): Headers => new Headers({ 'x-forwarded-host': host });

const MEMBERSHIP_ROLES: Readonly<Record<string, MembershipRole>> = {
  'user-district-owner': 'owner',
  'user-district-staff': 'manager',
  'user-guardian': 'owner', // sentinel: not actually a member because no org match
};

const TENANT_ORGS: Readonly<Record<string, string>> = {
  nycdoe: 'nycdoe',
};

const ORG_KINDS: Readonly<Record<string, OrganizationKind>> = {
  nycdoe: 'district',
};

/** The role is keyed off the user in this fixture, not the org. */
const loadMembershipRole = async (c: ProtectedCtx): Promise<MembershipRole | null> =>
  c.orgId && TENANT_ORGS[Object.keys(TENANT_ORGS).find((k) => TENANT_ORGS[k] === c.orgId) ?? '']
    ? (MEMBERSHIP_ROLES[c.learnerId] ?? null)
    : null;

const loadSubscriptions: LoadSubscriptions = async () => [
  { plan: 'ops-studio', status: 'active', referenceId: null, periodEnd: null, seats: null },
];

const loadTenantOrgId = async (slug: string): Promise<string | null> =>
  TENANT_ORGS[slug] ?? null;

const loadOrgKind = async (c: ProtectedCtx): Promise<OrganizationKind | null> =>
  c.orgId ? (ORG_KINDS[c.orgId] ?? null) : null;

const spy = () => {
  const state = { ran: false };
  const operation = async () => {
    state.ran = true;
    return 'result';
  };
  return { state, operation };
};

before(() => {
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = ROOT;
  setOperationSink(() => {});
});
after(() => {
  delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  setOperationSink(null);
});

describe('institution permission gate through protectedOperation', () => {
  it('allows a district owner to view schools', async () => {
    const { state, operation } = spy();
    const result = await protectedOperation(
      authFor({ id: 'user-district-owner', orgId: 'nycdoe' }),
      headersFor(`nycdoe.${ROOT}`),
      operation,
      {
        requires: 'export',
        requiresInstitution: { scope: 'district', resource: 'schools', action: 'view' },
        loadMembershipRole,
        loadSubscriptions,
        loadTenantOrgId,
        loadOrgKind,
      },
    );
    assert.equal(result, 'result');
    assert.equal(state.ran, true);
  });

  it('refuses a district staff member to manage people', async () => {
    const { state, operation } = spy();
    const denied = await protectedOperation(
      authFor({ id: 'user-district-staff', orgId: 'nycdoe' }),
      headersFor(`nycdoe.${ROOT}`),
      operation,
      {
        requires: 'export',
        requiresInstitution: { scope: 'district', resource: 'people', action: 'manage' },
        loadMembershipRole,
        loadSubscriptions,
        loadTenantOrgId,
        loadOrgKind,
      },
    ).catch((error: Error) => error);
    assert.ok(denied instanceof InstitutionPermissionDenied);
    assert.equal(denied.status, 403);
    assert.equal(state.ran, false);
  });

  it('refuses when the organization kind cannot be resolved', async () => {
    const { state, operation } = spy();
    const denied = await protectedOperation(
      authFor({ id: 'user-district-owner', orgId: 'nycdoe' }),
      headersFor(`nycdoe.${ROOT}`),
      operation,
      {
        requires: 'export',
        requiresInstitution: { scope: 'district', resource: 'schools', action: 'view' },
        loadMembershipRole,
        loadSubscriptions,
        loadTenantOrgId,
        // no loadOrgKind: the role falls back to `owner`, which has no district scope
      },
    ).catch((error: Error) => error);
    assert.ok(denied instanceof InstitutionPermissionDenied);
    assert.equal(state.ran, false);
  });
});
