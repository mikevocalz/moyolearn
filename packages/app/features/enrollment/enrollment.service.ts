import 'server-only';
// Enrollment service — reads the learner-to-organization roster.
//
// This is the foundation for all institutional learning reports. The permission
// gate is the institution `people/view` because the roster is a people view.
// SOT: packages/app/features/institution/institution.policy.ts · packages/payload/src/collections/Enrollments.ts
// SOT-KEYWORDS: enrollment service roster people view institution

import type { Auth } from '@acme/auth/server';
import { protectedOperation } from '../../core/protected-operation.ts';
import type { Enrollment } from './enrollment.types.ts';

/** Repository port — the caller provides the Payload adapter. */
export type LoadEnrollments = (orgId: string, kind: 'district' | 'school') => Promise<Enrollment[]>;

/**
 * Loads the roster for the current school or district.
 *
 * For a district, the repository should query by `districtId`. For a school, by
 * `orgId`. The service only resolves the permission and the tenant.
 */
export async function loadEnrollmentsByOrg(
  loadEnrollments: LoadEnrollments,
  authInstance: Auth,
  headers: Headers,
  kind: 'district' | 'school',
): Promise<Enrollment[]> {
  return protectedOperation(
    authInstance,
    headers,
    async (ctx) => loadEnrollments(ctx.orgId ?? '', kind),
    {
      requires: 'practise',
      requiresInstitution: { scope: kind, resource: 'people', action: 'view' },
    },
  );
}
