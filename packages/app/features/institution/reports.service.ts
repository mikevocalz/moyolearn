import 'server-only';
// Institutional reports service — derives the first real report from canonical data.
//
// This service does NOT create report documents. It computes an enrollment summary
// from the `enrollments` roster and, for districts, the `organizations` school list.
// Other report metrics are not yet supported and are shown as unavailable by the
// screen, never as fabricated numbers.
// SOT: packages/app/features/institution/institution.policy.ts · packages/app/features/enrollment/enrollment.service.ts
// SOT-KEYWORDS: reports service enrollment summary institution protected operation

import type { Auth } from '@acme/auth/server';
import { protectedOperation } from '../../core/protected-operation.ts';
import type { Enrollment } from '../enrollment/enrollment.types.ts';
import type { OrgBranding } from '../org/org.service.ts';
import type { LoadSchools } from './schools.service.ts';
import type { EnrollmentReport } from './reports.types.ts';

export type { EnrollmentReport } from './reports.types.ts';

/**
 * Loads the enrollment report for the current district or school.
 *
 * Permission gate is `institution/reports/view`. The repository ports are passed
 * so `@acme/app` owns the policy and `apps/web` owns the Payload wiring.
 */
export async function loadEnrollmentReport(
  loadEnrollments: (orgId: string, kind: 'district' | 'school') => Promise<Enrollment[]>,
  loadSchools: LoadSchools,
  authInstance: Auth,
  headers: Headers,
  kind: 'district' | 'school',
): Promise<EnrollmentReport> {
  return protectedOperation(
    authInstance,
    headers,
    async (ctx) => {
      const orgId = ctx.orgId ?? '';
      const [enrollments, schools] = await Promise.all([
        loadEnrollments(orgId, kind),
        kind === 'district' ? loadSchools(orgId) : Promise.resolve([] as OrgBranding[]),
      ]);

      const active = enrollments.filter((e) => e.status === 'active').length;
      const inactive = enrollments.filter((e) => e.status === 'inactive').length;

      const bySchool =
        kind === 'district'
          ? schools.map((s) => {
              const schoolRows = enrollments.filter((e) => e.orgId === s.slug);
              const schoolActive = schoolRows.filter((e) => e.status === 'active').length;
              const schoolInactive = schoolRows.filter((e) => e.status === 'inactive').length;
              return {
                slug: s.slug,
                name: s.name,
                total: schoolRows.length,
                active: schoolActive,
                inactive: schoolInactive,
              };
            })
          : undefined;

      return { total: enrollments.length, active, inactive, bySchool };
    },
    {
      requires: 'practise',
      requiresInstitution: { scope: kind, resource: 'reports', action: 'view' },
    },
  );
}
