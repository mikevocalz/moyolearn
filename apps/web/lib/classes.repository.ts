import 'server-only';
// Classes repository — the teacher's classes from Payload.
//
// The caller has already passed `protectedOperation`'s membership wall, and
// the SERVICE supplies teacherAuthId/orgId off ctx — so this uses
// `overrideAccess: true` and every query carries both keys. A foreign or
// mistyped id simply matches nothing, which is the not-found the contract
// wants.
// SOT: packages/payload/src/collections/Classes.ts · packages/app/features/classes/classes.service.ts
// SOT-KEYWORDS: classes repository payload teacher own scope code mint create

import { getPayload } from 'payload';
import config from '@payload-config';
import type { Class as PayloadClass } from '@acme/payload';
import type {
  CreateClass,
  LoadTeacherClass,
  LoadTeacherClasses,
  TeacherClass,
} from '@acme/app/server';

type PayloadRow = Pick<
  PayloadClass,
  'id' | 'name' | 'gradeBand' | 'code' | 'teacherAuthId' | 'orgId' | 'subject' | 'status'
>;

const ROW_SELECT = {
  id: true,
  name: true,
  gradeBand: true,
  code: true,
  teacherAuthId: true,
  orgId: true,
  subject: true,
  status: true,
} as const;

function toTeacherClass(row: PayloadRow): TeacherClass {
  return {
    id: String(row.id),
    name: row.name,
    gradeBand: row.gradeBand,
    code: row.code,
    teacherAuthId: row.teacherAuthId,
    orgId: row.orgId,
    subject: row.subject ?? null,
    status: row.status === 'archived' ? 'archived' : 'active',
  };
}

export const loadTeacherClasses: LoadTeacherClasses = async (teacherAuthId, orgId) => {
  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: 'classes',
    where: {
      and: [{ teacherAuthId: { equals: teacherAuthId } }, { orgId: { equals: orgId } }],
    },
    sort: '-createdAt',
    limit: 200,
    depth: 0,
    overrideAccess: true,
    select: ROW_SELECT,
  });
  return (docs as PayloadRow[]).map(toTeacherClass);
};

export const loadTeacherClass: LoadTeacherClass = async (classId, teacherAuthId, orgId) => {
  // Payload ids are numeric; a non-numeric deep link is not-found, not a 500.
  const id = Number(classId);
  if (!Number.isInteger(id)) return null;

  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: 'classes',
    where: {
      and: [
        { id: { equals: id } },
        { teacherAuthId: { equals: teacherAuthId } },
        { orgId: { equals: orgId } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: ROW_SELECT,
  });
  const row = (docs as PayloadRow[])[0];
  return row ? toTeacherClass(row) : null;
};

export const createClass: CreateClass = async (row) => {
  const payload = await getPayload({ config });
  const created = await payload.create({
    collection: 'classes',
    data: {
      name: row.name,
      gradeBand: row.gradeBand,
      code: row.code,
      teacherAuthId: row.teacherAuthId,
      orgId: row.orgId,
      subject: row.subject ?? null,
      status: row.status,
    },
    depth: 0,
    overrideAccess: true,
  });
  return toTeacherClass(created as PayloadRow);
};
