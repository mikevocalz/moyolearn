import 'server-only';
// Institution overview service — gated, read-only org summary for district and
// school home pages.
//
// This is the first institutional service that uses `protectedOperation`'s
// `requiresInstitution` option. It does not touch Payload directly; it takes a
// repository port so the same code is testable with a fixture and so the web
// app owns the Payload adapter.
// SOT: packages/app/core/protected-operation.ts · packages/app/features/org/org.service.ts · packages/app/features/org-settings/org-settings.service.ts
// SOT-KEYWORDS: institution service overview district school protected operation org branding read union denied unavailable

import type { Auth } from '@acme/auth/server';
import { protectedOperation } from '../../core/protected-operation.ts';
import { MembershipDenied } from '../../core/membership-gate.ts';
import { InstitutionPermissionDenied } from './institution.policy.ts';
import type { InstitutionRead, InstitutionResource } from './institution.types.ts';
import type { OrgBranding, LoadOrgBranding } from '../org/org.service.ts';

/**
 * Runs an institutional read and classifies its outcome instead of throwing.
 *
 * These reads run inside SERVER COMPONENTS, where a thrown refusal is caught by
 * the route group's `error.tsx` — so `/schools` and `/academics` answered a
 * correct "you may not read this" and an unconfirmable session with the same
 * red "Something broke on our end" page, reference id and all. That page is a
 * lie twice over: nothing broke, and it tells a stranger the route exists.
 *
 * Every refusal class collapses into ONE `denied`: a wrong org role
 * (`MembershipDenied`), no role at all in the addressed tenant
 * (`HostTenantDenied`, which extends it) and an education role without the
 * permission (`InstitutionPermissionDenied`) are the same answer to the person
 * asking, and telling them apart on screen would rebuild the 403 oracle the
 * contracts ban.
 *
 * Everything else — including a repository failure and an unconfirmable
 * session — is `unavailable`, so a genuine outage is never dressed as a
 * permission decision, and a permission decision is never dressed as an outage.
 */
export async function institutionRead<T>(
  run: () => Promise<T>,
): Promise<InstitutionRead<T>> {
  try {
    return { state: 'ok', data: await run() };
  } catch (error) {
    if (error instanceof InstitutionPermissionDenied || error instanceof MembershipDenied) {
      return { state: 'denied' };
    }
    return { state: 'unavailable' };
  }
}

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

/**
 * The classified form of `loadInstitutionOverview`, for pages that render the
 * refusal rather than throwing it.
 *
 * It wraps rather than replaces: the throwing loader is what `people/page.tsx`
 * and the tenant-slug detail pages call after they have already proved the host
 * is a district or a school, where a throw IS the right escalation. A rail
 * destination reached by a signed-in member has nothing to escalate to.
 */
export function readInstitutionOverview(
  loadOrgBranding: LoadOrgBranding,
  options: InstitutionOverviewOptions,
  authInstance: Auth,
  headers: Headers,
): Promise<InstitutionRead<OrgBranding | null>> {
  return institutionRead(() =>
    loadInstitutionOverview(loadOrgBranding, options, authInstance, headers),
  );
}
