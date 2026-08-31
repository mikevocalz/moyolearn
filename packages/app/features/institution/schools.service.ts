import 'server-only';
// District schools service — loads the list of schools a district admin may view.
//
// The service itself does not touch Payload; it takes a `LoadSchools` port so the
// repository lives in apps/web and the policy lives here in @acme/app. The
// permission gate is `district/schools/view`.
// SOT: packages/app/features/institution/institution.policy.ts · packages/app/features/org/org.service.ts
// SOT-KEYWORDS: institution schools service district load protected operation

import type { Auth } from '@acme/auth/server';
import { protectedOperation } from '../../core/protected-operation.ts';
import type { OrgBranding } from '../org/org.service.ts';

/** Repository port — the caller provides the Payload adapter. */
export type LoadSchools = () => Promise<OrgBranding[]>;

/**
 * Loads all school organizations for a district admin.
 *
 * The list is not yet scoped to the calling district because the Organizations
 * collection does not currently carry a `districtId` (doc 01 §auth mapping
 * deliberately uses a single tenant key). This returns the global school list;
 * a tenant-scoped filter should be added once that relationship exists.
 */
export async function loadDistrictSchools(
  loadSchools: LoadSchools,
  authInstance: Auth,
  headers: Headers,
): Promise<OrgBranding[]> {
  return protectedOperation(
    authInstance,
    headers,
    async () => loadSchools(),
    {
      requires: 'practise',
      requiresInstitution: { scope: 'district', resource: 'schools', action: 'view' },
    },
  );
}
