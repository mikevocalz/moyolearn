import 'server-only';
// District schools service — loads the list of schools a district admin may view.
//
// The service itself does not touch Payload; it takes a `LoadSchools` port so the
// repository lives in apps/web and the policy lives here in @acme/app. The
// permission gate is `district/schools/view`.
// SOT: packages/app/features/institution/institution.policy.ts · packages/app/features/org/org.service.ts
// SOT-KEYWORDS: institution schools service district load protected operation read union denied unavailable

import type { Auth } from '@acme/auth/server';
import { protectedOperation } from '../../core/protected-operation.ts';
import { institutionRead } from './institution.service.ts';
import type { InstitutionRead } from './institution.types.ts';
import type { OrgBranding } from '../org/org.service.ts';

/** Repository port — the caller provides the Payload adapter. */
export type LoadSchools = (districtSlug: string) => Promise<OrgBranding[]>;

/**
 * Loads the school organizations that belong to the current district.
 *
 * The service receives the resolved district slug from `ctx.orgId` and passes it
 * to the repository so the list is tenant-scoped. The permission gate is
 * `district/schools/view`.
 */
export async function loadDistrictSchools(
  loadSchools: LoadSchools,
  authInstance: Auth,
  headers: Headers,
): Promise<OrgBranding[]> {
  return protectedOperation(
    authInstance,
    headers,
    async (ctx) => loadSchools(ctx.orgId ?? ''),
    {
      requires: 'practise',
      requiresInstitution: { scope: 'district', resource: 'schools', action: 'view' },
    },
  );
}

/**
 * The classified form, for the `/schools` rail destination.
 *
 * The roster and the branding are read TOGETHER and classified as one outcome:
 * two independent unions would let the page render a district's name over an
 * unavailable roster, which is the branded-empty-directory failure the
 * contract's `offline` path ("no cached-stale aggregates presented as fresh")
 * is written against.
 */
export function readDistrictSchools(
  loadSchools: LoadSchools,
  authInstance: Auth,
  headers: Headers,
): Promise<InstitutionRead<OrgBranding[]>> {
  return institutionRead(() => loadDistrictSchools(loadSchools, authInstance, headers));
}
