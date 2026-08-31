import 'server-only';
// Enrollment repository — reads the learner-to-organization roster from Payload.
//
// The caller has already passed `protectedOperation`'s `institution/people/view`
// gate, so this uses `overrideAccess: true` and only touches `enrollments`.
// SOT: packages/payload/src/collections/Enrollments.ts · packages/app/features/enrollment/enrollment.service.ts
// SOT-KEYWORDS: enrollment repository payload roster learner orgId districtId

import { getPayload } from 'payload';
import config from '@payload-config';
import type { Enrollment as PayloadEnrollment } from '@acme/payload';
import type { Enrollment, LoadEnrollments } from '@acme/app/server';

type PayloadRow = Pick<
  PayloadEnrollment,
  'id' | 'learnerAuthId' | 'orgId' | 'districtId' | 'program' | 'status' | 'enrolledAt' | 'exitedAt'
>;

export const loadEnrollments: LoadEnrollments = async (orgId, kind) => {
  const payload = await getPayload({ config });

  const tenantKey = kind === 'district' ? 'districtId' : 'orgId';

  const { docs } = await payload.find({
    collection: 'enrollments',
    where: { and: [{ [tenantKey]: { equals: orgId } }] },
    limit: 500,
    depth: 0,
    overrideAccess: true,
    select: {
      id: true,
      learnerAuthId: true,
      orgId: true,
      districtId: true,
      program: true,
      status: true,
      enrolledAt: true,
      exitedAt: true,
    },
  });

  return (docs as PayloadRow[]).map<Enrollment>((row) => ({
    id: String(row.id),
    learnerAuthId: row.learnerAuthId,
    orgId: row.orgId,
    districtId: row.districtId ?? null,
    program: row.program ?? null,
    status: row.status === 'active' ? 'active' : 'inactive',
    enrolledAt: row.enrolledAt ?? '',
    exitedAt: row.exitedAt ?? null,
  }));
};
