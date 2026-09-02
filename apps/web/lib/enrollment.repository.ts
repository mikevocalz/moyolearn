import 'server-only';
// Enrollment repository — reads the learner-to-organization roster from Payload.
//
// Every caller is behind `protectedOperation` — the org readers behind the
// `institution/people/view` gate, the learner reader keyed on `ctx.learnerId`
// only — so this uses `overrideAccess: true` and only touches `enrollments`.
// SOT: packages/payload/src/collections/Enrollments.ts · packages/app/features/enrollment/enrollment.service.ts
// SOT-KEYWORDS: enrollment repository payload roster learner orgId districtId

import { getPayload } from 'payload';
import config from '@payload-config';
import type { Enrollment as PayloadEnrollment } from '@acme/payload';
import type {
  Enrollment,
  LoadClassRoster,
  LoadEnrollments,
  LoadLearnerEnrollments,
} from '@acme/app/server';

type PayloadRow = Pick<
  PayloadEnrollment,
  | 'id'
  | 'learnerAuthId'
  | 'orgId'
  | 'districtId'
  | 'program'
  | 'classId'
  | 'status'
  | 'enrolledAt'
  | 'exitedAt'
>;

const ROW_SELECT = {
  id: true,
  learnerAuthId: true,
  orgId: true,
  districtId: true,
  program: true,
  classId: true,
  status: true,
  enrolledAt: true,
  exitedAt: true,
} as const;

function toEnrollment(row: PayloadRow): Enrollment {
  return {
    id: String(row.id),
    learnerAuthId: row.learnerAuthId,
    orgId: row.orgId,
    districtId: row.districtId ?? null,
    program: row.program ?? null,
    classId: row.classId ?? null,
    status: row.status === 'active' ? 'active' : 'inactive',
    enrolledAt: row.enrolledAt ?? '',
    exitedAt: row.exitedAt ?? null,
  };
}

export const loadEnrollments: LoadEnrollments = async (orgId, kind) => {
  const payload = await getPayload({ config });

  const tenantKey = kind === 'district' ? 'districtId' : 'orgId';

  const { docs } = await payload.find({
    collection: 'enrollments',
    where: { and: [{ [tenantKey]: { equals: orgId } }] },
    limit: 500,
    depth: 0,
    overrideAccess: true,
    select: ROW_SELECT,
  });

  return (docs as PayloadRow[]).map(toEnrollment);
};

/*
  The class roster — enrollments by the `classId` dimension. The caller
  (classes.service.ts) has already proven the class belongs to the acting
  teacher, and `orgId` rides along anyway so a stale or cross-tenant class id
  can never widen the read.
*/
/*
  The learner's own enrollments — the `learnerAuthId` dimension (indexed on the
  collection). The caller (learner-assignments.service.ts) supplies the id off
  `ctx`, never from client input, so this read can only ever be self-scoped.
*/
export const loadEnrollmentsByLearner: LoadLearnerEnrollments = async (learnerAuthId) => {
  const payload = await getPayload({ config });

  const { docs } = await payload.find({
    collection: 'enrollments',
    where: { and: [{ learnerAuthId: { equals: learnerAuthId } }] },
    limit: 100,
    depth: 0,
    overrideAccess: true,
    select: ROW_SELECT,
  });

  return (docs as PayloadRow[]).map(toEnrollment);
};

export const loadEnrollmentsByClass: LoadClassRoster = async (classId, orgId) => {
  const payload = await getPayload({ config });

  const { docs } = await payload.find({
    collection: 'enrollments',
    where: { and: [{ classId: { equals: classId } }, { orgId: { equals: orgId } }] },
    limit: 500,
    depth: 0,
    overrideAccess: true,
    select: ROW_SELECT,
  });

  return (docs as PayloadRow[]).map(toEnrollment);
};
