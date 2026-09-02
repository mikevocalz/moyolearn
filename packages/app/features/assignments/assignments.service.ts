import 'server-only';
// Assignments service — create, publish, close, extend; scoped to the
// authoring teacher.
//
// Same walls as classes.service.ts: `requiresMembership` makes it a staff
// surface, `ctx.learnerId` is the ownership key, and identity is never a
// parameter. Every id the client CAN send (`classId`, `assignmentId`) is
// resolved against the teacher's own rows first, and a foreign id resolves to
// null → 404 — the contract's "a deep link to another teacher's assignment
// resolves to not-found (silent drop, doc 36 §4.4)".
//
// Publish is a single update that writes `status` and `publishedAt` together,
// so "never half-published" holds at the row level; a failed publish leaves a
// draft (contract's publish_failed path) because nothing was written at all.
// SOT: design/screens/teacher/teacher.assign/contract.md · packages/payload/src/collections/Assignments.ts
// SOT-KEYWORDS: assignments service teacher publish close extend draft own scope not-found

import { MEMBERSHIP_ROLES } from '@acme/auth/membership';
import type { Auth } from '@acme/auth/server';
import { protectedOperation } from '../../core/protected-operation.ts';
import type { LoadTeacherClass } from '../classes/classes.service.ts';
import type {
  Assignment,
  AssignmentStatus,
  CreateAssignmentInput,
} from './assignments.types.ts';

/** Repository ports — the caller provides the Payload adapters. */
export type LoadTeacherAssignments = (
  teacherAuthId: string,
  orgId: string,
  classId?: string,
) => Promise<Assignment[]>;
export type LoadTeacherAssignment = (
  assignmentId: string,
  teacherAuthId: string,
  orgId: string,
) => Promise<Assignment | null>;
export type CreateAssignment = (row: Omit<Assignment, 'id'>) => Promise<Assignment>;
/** Applies a lifecycle patch to a row the service has already proven is the caller's. */
export type UpdateAssignment = (
  assignmentId: string,
  patch: { status?: AssignmentStatus; publishedAt?: string; dueAt?: string },
) => Promise<Assignment>;

export interface CreateAssignmentPorts {
  loadTeacherClass: LoadTeacherClass;
  createAssignment: CreateAssignment;
}

export interface AssignmentLifecyclePorts {
  loadTeacherAssignment: LoadTeacherAssignment;
  updateAssignment: UpdateAssignment;
}

// Same floors as classes.service.ts: reads are never hostage to a lapsed
// card; writes name `write` explicitly.
const READ_GATE = { requires: 'practise', requiresMembership: MEMBERSHIP_ROLES } as const;
const WRITE_GATE = { requires: 'write', requiresMembership: MEMBERSHIP_ROLES } as const;

/** The tracking list — all of the teacher's assignments, optionally one class's. */
export async function teacherAssignments(
  loadTeacherAssignments: LoadTeacherAssignments,
  authInstance: Auth,
  headers: Headers,
  filter?: { classId?: string },
): Promise<Assignment[]> {
  return protectedOperation(
    authInstance,
    headers,
    async (ctx) => loadTeacherAssignments(ctx.learnerId, ctx.orgId ?? '', filter?.classId),
    {
      ...READ_GATE,
      telemetry: { op: 'teacher.assignments.list', resource: 'assignments', action: 'read' },
    },
  );
}

/** One assignment, or null when it is not the caller's to see. */
export async function teacherAssignmentDetail(
  loadTeacherAssignment: LoadTeacherAssignment,
  authInstance: Auth,
  headers: Headers,
  assignmentId: string,
): Promise<Assignment | null> {
  return protectedOperation(
    authInstance,
    headers,
    async (ctx) => loadTeacherAssignment(assignmentId, ctx.learnerId, ctx.orgId ?? ''),
    {
      ...READ_GATE,
      telemetry: { op: 'teacher.assignments.detail', resource: 'assignments', action: 'read' },
    },
  );
}

/**
 * Creates a draft. The target class is resolved against the teacher's OWN
 * classes first — a foreign `classId` returns null (→ 404) before anything is
 * written, which is the create-side of the contract's permission path.
 */
export async function createAssignmentDraft(
  ports: CreateAssignmentPorts,
  authInstance: Auth,
  headers: Headers,
  input: CreateAssignmentInput,
): Promise<Assignment | null> {
  return protectedOperation(
    authInstance,
    headers,
    async (ctx) => {
      const target = await ports.loadTeacherClass(input.classId, ctx.learnerId, ctx.orgId ?? '');
      if (target === null) return null;

      const title = input.title.trim();
      if (title.length === 0) throw new Error('An assignment needs a title');
      if (Number.isNaN(Date.parse(input.dueAt))) throw new Error('An assignment needs a due date');
      // A draft with no work is a blank page, and FD-23's whole last step
      // exists because a blank page is how "first assignment sent" goes unmet.
      if (input.workItems.length === 0) throw new Error('An assignment needs at least one work item');

      return ports.createAssignment({
        classId: target.id,
        teacherAuthId: ctx.learnerId,
        // Denormalized from the RESOLVED class, not the session: the class row
        // is the tenancy fact of record for its assignments.
        orgId: target.orgId,
        title,
        subject: input.subject ?? null,
        dueAt: input.dueAt,
        workItems: input.workItems.map((item) => ({
          templateId: item.templateId ?? null,
          title: item.title,
          description: item.description,
          minutes: item.minutes,
        })),
        status: 'draft',
        publishedAt: null,
      });
    },
    {
      ...WRITE_GATE,
      telemetry: { op: 'teacher.assignments.create', resource: 'assignments', action: 'write' },
    },
  );
}

/**
 * Publishes a draft: one update carrying `status` and `publishedAt` together.
 * Re-publishing a published assignment is a no-op success rather than an
 * error — a double-tap on a slow network must not surface as a failure.
 */
export async function publishAssignment(
  ports: AssignmentLifecyclePorts,
  authInstance: Auth,
  headers: Headers,
  assignmentId: string,
): Promise<Assignment | null> {
  return protectedOperation(
    authInstance,
    headers,
    async (ctx) => {
      const owned = await ports.loadTeacherAssignment(assignmentId, ctx.learnerId, ctx.orgId ?? '');
      if (owned === null) return null;
      if (owned.status === 'published') return owned;
      if (owned.status === 'closed') throw new Error('A closed assignment cannot be republished');
      return ports.updateAssignment(owned.id, {
        status: 'published',
        publishedAt: new Date().toISOString(),
      });
    },
    {
      ...WRITE_GATE,
      telemetry: { op: 'teacher.assignments.publish', resource: 'assignments', action: 'write' },
    },
  );
}

/** Closes a published assignment. Closing a draft is meaningless and refused. */
export async function closeAssignment(
  ports: AssignmentLifecyclePorts,
  authInstance: Auth,
  headers: Headers,
  assignmentId: string,
): Promise<Assignment | null> {
  return protectedOperation(
    authInstance,
    headers,
    async (ctx) => {
      const owned = await ports.loadTeacherAssignment(assignmentId, ctx.learnerId, ctx.orgId ?? '');
      if (owned === null) return null;
      if (owned.status === 'closed') return owned;
      if (owned.status === 'draft') throw new Error('A draft has nothing to close');
      return ports.updateAssignment(owned.id, { status: 'closed' });
    },
    {
      ...WRITE_GATE,
      telemetry: { op: 'teacher.assignments.close', resource: 'assignments', action: 'write' },
    },
  );
}

/**
 * Extends the due date. Extending a CLOSED assignment reopens it to
 * `published` — that is what "extend" means to a teacher who closed it a day
 * early — while `publishedAt` keeps its original mint (set exactly once).
 */
export async function extendAssignment(
  ports: AssignmentLifecyclePorts,
  authInstance: Auth,
  headers: Headers,
  assignmentId: string,
  dueAt: string,
): Promise<Assignment | null> {
  return protectedOperation(
    authInstance,
    headers,
    async (ctx) => {
      const owned = await ports.loadTeacherAssignment(assignmentId, ctx.learnerId, ctx.orgId ?? '');
      if (owned === null) return null;
      if (Number.isNaN(Date.parse(dueAt))) throw new Error('An extension needs a due date');
      return ports.updateAssignment(owned.id, {
        dueAt,
        ...(owned.status === 'closed' ? { status: 'published' as const } : {}),
      });
    },
    {
      ...WRITE_GATE,
      telemetry: { op: 'teacher.assignments.extend', resource: 'assignments', action: 'write' },
    },
  );
}
