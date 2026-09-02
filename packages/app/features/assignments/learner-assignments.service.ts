import 'server-only';
// Learner assignments service — the arrival side of teacher.assign: what work
// has been PUBLISHED to the classes this learner is enrolled in (J1 arrival
// signal, learner.plan contract's "what's due, and when?").
//
// A separate file from assignments.service.ts on purpose: that service is a
// staff surface (`requiresMembership`) keyed on the AUTHORING teacher, and
// this one is a child's read keyed on the ENROLLED learner. Sharing a file
// would invite sharing a gate, and the gates must differ — this one sits at
// the free `practise` floor with no membership wall, because a lapsed card or
// a roster hiccup must never stand between a child and seeing their homework.
//
// Identity is never a parameter: `ctx.learnerId` is the only key, and the
// chain is learnerId → own enrollments → classId[] → published rows. There is
// no id in the request to forge, so a learner can only ever see work addressed
// to a class they are actually in. Draft and closed rows never cross the wall
// — a draft is the teacher's private desk, and status is filtered at the
// repository so an unpublished row is not even read.
//
// The rows are projected before they leave: the authoring teacher's auth id
// and the org slug are tenancy facts the teacher surfaces need and a child's
// client does not, so they stay on the server side of the wall.
// SOT: design/screens/learner/learner.plan/contract.md · packages/app/features/assignments/assignments.service.ts
// SOT-KEYWORDS: learner assignments service arrival published due work enrollment class practise floor
import type { Auth } from '@acme/auth/server';
import { protectedOperation } from '../../core/protected-operation.ts';
import type { Enrollment } from '../enrollment/enrollment.types.ts';
import type { Assignment, AssignmentWorkItem } from './assignments.types.ts';

/** Repository ports — the caller provides the Payload adapters. */
export type LoadLearnerEnrollments = (learnerAuthId: string) => Promise<Enrollment[]>;
/** Published rows only, soonest due first — the repository owns both facts. */
export type LoadPublishedAssignments = (classIds: string[]) => Promise<Assignment[]>;

export interface LearnerAssignmentPorts {
  loadEnrollmentsByLearner: LoadLearnerEnrollments;
  loadPublishedAssignments: LoadPublishedAssignments;
}

/** An assignment as the learner's client is allowed to see it. */
export interface LearnerAssignment {
  id: string;
  classId: string;
  title: string;
  subject?: string | null;
  /** ISO date string the work is due. Clients render plain speech, never this raw. */
  dueAt: string;
  workItems: AssignmentWorkItem[];
  /** ISO date string the teacher published — the arrival moment. */
  publishedAt: string | null;
}

function toLearnerAssignment(row: Assignment): LearnerAssignment {
  return {
    id: row.id,
    classId: row.classId,
    title: row.title,
    subject: row.subject ?? null,
    dueAt: row.dueAt,
    workItems: row.workItems,
    publishedAt: row.publishedAt ?? null,
  };
}

/**
 * Everything published to this learner's classes, soonest due first.
 *
 * Only ACTIVE enrollments feed the class list: an exited learner's old class
 * keeps assigning work to its current roster, and showing that work to a child
 * who left would be due-pressure about nothing they owe.
 */
export async function learnerAssignments(
  ports: LearnerAssignmentPorts,
  authInstance: Auth,
  headers: Headers,
): Promise<LearnerAssignment[]> {
  return protectedOperation(
    authInstance,
    headers,
    async (ctx) => {
      const enrollments = await ports.loadEnrollmentsByLearner(ctx.learnerId);
      const classIds = [
        ...new Set(
          enrollments
            .filter((e) => e.status === 'active')
            .map((e) => e.classId)
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
        ),
      ];
      if (classIds.length === 0) return [];
      const published = await ports.loadPublishedAssignments(classIds);
      return published.map(toLearnerAssignment);
    },
    {
      // Explicit even though it is the default: this is the free floor, and the
      // learner.plan contract's permission path is "own plan only" — no
      // membership wall, no capability above practise.
      requires: 'practise',
      telemetry: { op: 'learner.assignments.list', resource: 'assignments', action: 'read' },
    },
  );
}
