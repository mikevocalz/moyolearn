import 'server-only';
// Learner assignments service — the arrival side of teacher.assign: what work
// has been PUBLISHED to the classes this learner is enrolled in (J1 arrival
// signal, learner.plan contract's "what's due, and when?"), plus the learner's
// one write back — `markAssignmentDone`, a self-reported "I did it" that is
// idempotent by design and scoped by the same enrollment chain as the read.
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
// SOT-KEYWORDS: learner assignments service arrival published due work enrollment class practise floor mark done completion idempotent
import type { Auth } from '@acme/auth/server';
import { protectedOperation } from '../../core/protected-operation.ts';
import type { Enrollment } from '../enrollment/enrollment.types.ts';
import type { Assignment, AssignmentWorkItem } from './assignments.types.ts';

/** A completion row as the server names it — never projected to a client whole. */
export interface AssignmentCompletionRecord {
  id: string;
  assignmentId: string;
  learnerAuthId: string;
  classId: string;
  /** ISO date string the learner marked it done. Written once. */
  completedAt: string;
}

/** Repository ports — the caller provides the Payload adapters. */
export type LoadLearnerEnrollments = (learnerAuthId: string) => Promise<Enrollment[]>;
/** Published rows only, soonest due first — the repository owns both facts. */
export type LoadPublishedAssignments = (classIds: string[]) => Promise<Assignment[]>;
/** This learner's completions among the given assignments — self-scoped by construction. */
export type LoadCompletionsForAssignments = (
  learnerAuthId: string,
  assignmentIds: string[],
) => Promise<AssignmentCompletionRecord[]>;
export type CreateAssignmentCompletion = (
  row: Omit<AssignmentCompletionRecord, 'id'>,
) => Promise<AssignmentCompletionRecord>;

export interface LearnerAssignmentPorts {
  loadEnrollmentsByLearner: LoadLearnerEnrollments;
  loadPublishedAssignments: LoadPublishedAssignments;
  loadCompletionsForAssignments: LoadCompletionsForAssignments;
}

export interface MarkAssignmentDonePorts extends LearnerAssignmentPorts {
  createCompletion: CreateAssignmentCompletion;
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
  /** ISO date string the LEARNER marked it done, or null while it is still open. */
  doneAt: string | null;
}

function toLearnerAssignment(row: Assignment, doneAt: string | null): LearnerAssignment {
  return {
    id: row.id,
    classId: row.classId,
    title: row.title,
    subject: row.subject ?? null,
    dueAt: row.dueAt,
    workItems: row.workItems,
    publishedAt: row.publishedAt ?? null,
    doneAt,
  };
}

/** The learner's published rows plus their own class ids — one resolution, two callers. */
async function resolveOwnPublished(
  ports: LearnerAssignmentPorts,
  learnerAuthId: string,
): Promise<Assignment[]> {
  const enrollments = await ports.loadEnrollmentsByLearner(learnerAuthId);
  const classIds = [
    ...new Set(
      enrollments
        .filter((e) => e.status === 'active')
        .map((e) => e.classId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  ];
  if (classIds.length === 0) return [];
  return ports.loadPublishedAssignments(classIds);
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
      const published = await resolveOwnPublished(ports, ctx.learnerId);
      if (published.length === 0) return [];
      // The learner's own completion state rides each row out as `doneAt` —
      // one flat read over the ids just resolved, never a per-row query.
      const completions = await ports.loadCompletionsForAssignments(
        ctx.learnerId,
        published.map((row) => row.id),
      );
      const doneAtByAssignment = new Map(completions.map((c) => [c.assignmentId, c.completedAt]));
      return published.map((row) =>
        toLearnerAssignment(row, doneAtByAssignment.get(row.id) ?? null),
      );
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

/**
 * The learner self-reports "I did it" on one assignment. Null when the id is
 * not one of THEIR OWN published rows — the same enrollment→classId chain as
 * the list resolves it, so a foreign, draft, or closed id is not-found before
 * anything is written (the teacher services' silent-drop posture).
 *
 * IDEMPOTENT ON PURPOSE — the publishAssignment double-tap posture: marking an
 * already-done assignment returns the existing completion as success, because
 * a double-tap on a slow network must not surface as a failure. The unique
 * (assignment, learner) constraint in the migration is the backstop for the
 * race this check cannot see.
 *
 * `classId` is DENORMALIZED from the resolved assignment row at write — the
 * row the service just proved is the learner's — so teacher counts can group
 * by class without a join, and the client never supplies it.
 */
export async function markAssignmentDone(
  ports: MarkAssignmentDonePorts,
  authInstance: Auth,
  headers: Headers,
  assignmentId: string,
): Promise<LearnerAssignment | null> {
  return protectedOperation(
    authInstance,
    headers,
    async (ctx) => {
      const published = await resolveOwnPublished(ports, ctx.learnerId);
      const owned = published.find((row) => row.id === assignmentId);
      if (owned === undefined) return null;

      const existing = await ports.loadCompletionsForAssignments(ctx.learnerId, [owned.id]);
      const already = existing.find((c) => c.assignmentId === owned.id);
      if (already !== undefined) return toLearnerAssignment(owned, already.completedAt);

      const created = await ports.createCompletion({
        assignmentId: owned.id,
        learnerAuthId: ctx.learnerId,
        classId: owned.classId,
        completedAt: new Date().toISOString(),
      });
      return toLearnerAssignment(owned, created.completedAt);
    },
    {
      // Still the free floor: a lapsed card must never stand between a child
      // and saying their homework is done. Same wall shape as the list —
      // identity is `ctx.learnerId`, and the only id in the request has to
      // resolve through the learner's own enrollments first.
      requires: 'practise',
      telemetry: { op: 'learner.assignments.markDone', resource: 'assignments', action: 'write' },
    },
  );
}
