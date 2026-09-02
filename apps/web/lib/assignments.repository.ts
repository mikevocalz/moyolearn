import 'server-only';
// Assignments repository — the teacher's assignments from Payload.
//
// Same posture as classes.repository.ts: the service has already passed the
// membership wall and supplies teacherAuthId/orgId off ctx, so this uses
// `overrideAccess: true` and every read carries both keys. `updateAssignment`
// deliberately takes only an id — the service resolves ownership FIRST via
// `loadTeacherAssignment`, so the id that reaches here is already proven to be
// the caller's.
// SOT: packages/payload/src/collections/Assignments.ts · packages/app/features/assignments/assignments.service.ts
// SOT-KEYWORDS: assignments repository payload teacher own scope work items lifecycle update

import { getPayload } from 'payload';
import config from '@payload-config';
import type { Assignment as PayloadAssignment } from '@acme/payload';
import type {
  Assignment,
  AssignmentWorkItem,
  CreateAssignment,
  LoadTeacherAssignment,
  LoadTeacherAssignments,
  UpdateAssignment,
} from '@acme/app/server';

type PayloadRow = Pick<
  PayloadAssignment,
  | 'id'
  | 'classId'
  | 'teacherAuthId'
  | 'orgId'
  | 'title'
  | 'subject'
  | 'dueAt'
  | 'workItems'
  | 'status'
  | 'publishedAt'
>;

const ROW_SELECT = {
  id: true,
  classId: true,
  teacherAuthId: true,
  orgId: true,
  title: true,
  subject: true,
  dueAt: true,
  workItems: true,
  status: true,
  publishedAt: true,
} as const;

function toAssignment(row: PayloadRow): Assignment {
  return {
    id: String(row.id),
    classId: row.classId,
    teacherAuthId: row.teacherAuthId,
    orgId: row.orgId,
    title: row.title,
    subject: row.subject ?? null,
    dueAt: row.dueAt ?? '',
    workItems: (row.workItems ?? []).map<AssignmentWorkItem>((item) => ({
      templateId: item.templateId ?? null,
      title: item.title,
      description: item.description,
      minutes: item.minutes,
    })),
    status: row.status,
    publishedAt: row.publishedAt ?? null,
  };
}

export const loadTeacherAssignments: LoadTeacherAssignments = async (
  teacherAuthId,
  orgId,
  classId,
) => {
  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: 'assignments',
    where: {
      and: [
        { teacherAuthId: { equals: teacherAuthId } },
        { orgId: { equals: orgId } },
        ...(classId !== undefined ? [{ classId: { equals: classId } }] : []),
      ],
    },
    // Newest due first — the tracking list's "what is due this week" order.
    sort: '-dueAt',
    limit: 200,
    depth: 0,
    overrideAccess: true,
    select: ROW_SELECT,
  });
  return (docs as PayloadRow[]).map(toAssignment);
};

export const loadTeacherAssignment: LoadTeacherAssignment = async (
  assignmentId,
  teacherAuthId,
  orgId,
) => {
  // Payload ids are numeric; a non-numeric deep link is not-found, not a 500.
  const id = Number(assignmentId);
  if (!Number.isInteger(id)) return null;

  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: 'assignments',
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
  return row ? toAssignment(row) : null;
};

export const createAssignment: CreateAssignment = async (row) => {
  const payload = await getPayload({ config });
  const created = await payload.create({
    collection: 'assignments',
    data: {
      classId: row.classId,
      teacherAuthId: row.teacherAuthId,
      orgId: row.orgId,
      title: row.title,
      subject: row.subject ?? null,
      dueAt: row.dueAt,
      workItems: row.workItems.map((item) => ({
        templateId: item.templateId ?? null,
        title: item.title,
        description: item.description,
        minutes: item.minutes,
      })),
      status: row.status,
      publishedAt: row.publishedAt ?? null,
    },
    depth: 0,
    overrideAccess: true,
  });
  return toAssignment(created as PayloadRow);
};

export const updateAssignment: UpdateAssignment = async (assignmentId, patch) => {
  const payload = await getPayload({ config });
  const updated = await payload.update({
    collection: 'assignments',
    id: Number(assignmentId),
    data: {
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.publishedAt !== undefined ? { publishedAt: patch.publishedAt } : {}),
      ...(patch.dueAt !== undefined ? { dueAt: patch.dueAt } : {}),
    },
    depth: 0,
    overrideAccess: true,
  });
  return toAssignment(updated as PayloadRow);
};
