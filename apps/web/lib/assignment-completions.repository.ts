import 'server-only';
// Assignment-completions repository — the learner's "I did it" rows from
// Payload.
//
// Same posture as assignments.repository.ts: every caller is behind
// `protectedOperation` — the learner reads/writes are keyed on `ctx.learnerId`
// and the teacher count read on rows the service already proved are the
// caller's — so this uses `overrideAccess: true`. What leaves here is either
// the learner's OWN rows or a bare count per assignment; a per-student list
// never crosses (the counts-only decision lives in assignments.service.ts).
// SOT: packages/payload/src/collections/AssignmentCompletions.ts · packages/app/features/assignments/learner-assignments.service.ts
// SOT-KEYWORDS: assignment completions repository payload mark done counts learner double-tap unique

import { getPayload } from 'payload';
import config from '@payload-config';
import type { AssignmentCompletion as PayloadCompletion } from '@acme/payload';
import type {
  AssignmentCompletionRecord,
  CountCompletionsByAssignment,
  CreateAssignmentCompletion,
  LoadCompletionsForAssignments,
} from '@acme/app/server';

type PayloadRow = Pick<
  PayloadCompletion,
  'id' | 'assignmentId' | 'learnerAuthId' | 'classId' | 'completedAt'
>;

const ROW_SELECT = {
  id: true,
  assignmentId: true,
  learnerAuthId: true,
  classId: true,
  completedAt: true,
} as const;

function toRecord(row: PayloadRow): AssignmentCompletionRecord {
  return {
    id: String(row.id),
    assignmentId: row.assignmentId,
    learnerAuthId: row.learnerAuthId,
    classId: row.classId,
    completedAt: row.completedAt,
  };
}

/*
  The learner's own completions among the given assignments. Empty ids
  short-circuit for the same reason assignments.repository.ts does: Payload's
  `in` on an empty array is a malformed query, not a no-match.
*/
export const loadCompletionsForLearnerAssignments: LoadCompletionsForAssignments = async (
  learnerAuthId,
  assignmentIds,
) => {
  if (assignmentIds.length === 0) return [];
  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: 'assignment-completions',
    where: {
      and: [
        { learnerAuthId: { equals: learnerAuthId } },
        { assignmentId: { in: assignmentIds } },
      ],
    },
    // One learner × one plan's worth of assignments — bounded by the
    // assignments read's own limit (200), so no pagination games needed.
    limit: 200,
    depth: 0,
    overrideAccess: true,
    select: ROW_SELECT,
  });
  return (docs as PayloadRow[]).map(toRecord);
};

export const createAssignmentCompletion: CreateAssignmentCompletion = async (row) => {
  const payload = await getPayload({ config });
  try {
    const created = await payload.create({
      collection: 'assignment-completions',
      data: {
        assignmentId: row.assignmentId,
        learnerAuthId: row.learnerAuthId,
        classId: row.classId,
        completedAt: row.completedAt,
      },
      depth: 0,
      overrideAccess: true,
    });
    return toRecord(created as PayloadRow);
  } catch (error) {
    /*
      The double-tap race the service's check-first idempotency cannot see:
      two concurrent taps both find nothing, both insert, and the unique
      (assignment, learner) constraint refuses the loser. The loser's row
      EXISTS — the other tap wrote it — so surfacing the refusal as a failure
      would tell the child their double-tap broke something that worked.
      Re-read and return it; anything else genuinely failed and rethrows.
    */
    const existing = await loadCompletionsForLearnerAssignments(row.learnerAuthId, [
      row.assignmentId,
    ]);
    const winner = existing.find((c) => c.assignmentId === row.assignmentId);
    if (winner !== undefined) return winner;
    throw error;
  }
};

/*
  The teacher's count read: bare numbers per assignment id, aggregated here so
  rows never reach the service. `payload.count` per id would be N queries for
  the tracking list; one select-projected find over the id set stays a single
  query, and `pagination: false` keeps it honest past the default page size
  (a whole class per assignment can exceed 10 rows, the Payload default).
*/
export const countCompletionsByAssignment: CountCompletionsByAssignment = async (
  assignmentIds,
) => {
  if (assignmentIds.length === 0) return {};
  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: 'assignment-completions',
    where: { assignmentId: { in: assignmentIds } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
    select: { assignmentId: true } as const,
  });
  const counts: Record<string, number> = {};
  for (const doc of docs as Pick<PayloadRow, 'assignmentId'>[]) {
    counts[doc.assignmentId] = (counts[doc.assignmentId] ?? 0) + 1;
  }
  return counts;
};
