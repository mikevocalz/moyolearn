import 'server-only';
// Institution overview service — gated, read-only org summary for district and
// school home pages.
//
// This is the first institutional service that uses `protectedOperation`'s
// `requiresInstitution` option. It does not touch Payload directly; it takes a
// repository port so the same code is testable with a fixture and so the web
// app owns the Payload adapter.
// SOT: packages/app/core/protected-operation.ts · packages/app/features/org/org.service.ts
// SOT-KEYWORDS: institution service overview district school protected operation org branding

import type { Auth } from '@acme/auth/server';
import { protectedOperation } from '../../core/protected-operation.ts';
import type { InstitutionResource } from './institution.types.ts';
import type { OrgBranding, LoadOrgBranding } from '../org/org.service.ts';

export interface InstitutionOverviewOptions {
  /** The permission the caller must hold in the current tenant scope. */
  scope: 'district' | 'school' | 'own_org';
  /** The resource the overview represents. */
  resource: InstitutionResource;
}

/**
 * Loads the organization's public branding for an institutional surface.
 *
 * The read is protected by the institution permission policy: the caller must
 * hold the requested `scope`/`resource`/`view` permission in their current
 * tenant before the organization row is read. This keeps a branded name from
 * leaking to a caller who is not a member of the tenant.
 */
export async function loadInstitutionOverview(
  loadOrgBranding: LoadOrgBranding,
  options: InstitutionOverviewOptions,
  authInstance: Auth,
  headers: Headers,
): Promise<OrgBranding | null> {
  return protectedOperation(
    authInstance,
    headers,
    async (ctx): Promise<OrgBranding | null> => {
      if (!ctx.orgId) return null;
      return loadOrgBranding(ctx.orgId);
    },
    {
      requires: 'practise',
      requiresInstitution: { scope: options.scope, resource: options.resource, action: 'view' },
    },
  );
}

/**
 * Convenience loader for a district home page.
 */
export function loadDistrictOverview(
  loadOrgBranding: LoadOrgBranding,
  authInstance: Auth,
  headers: Headers,
): Promise<OrgBranding | null> {
  return loadInstitutionOverview(loadOrgBranding, { scope: 'district', resource: 'schools' }, authInstance, headers);
}

/**
 * Convenience loader for a school home page.
 */
export function loadSchoolOverview(
  loadOrgBranding: LoadOrgBranding,
  authInstance: Auth,
  headers: Headers,
): Promise<OrgBranding | null> {
  return loadInstitutionOverview(loadOrgBranding, { scope: 'school', resource: 'people' }, authInstance, headers);
}
