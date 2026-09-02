// Assignments domain types — teacher.assign's object as the app names it.
//
// Work items carry FD-23's `AssignmentTemplate` shape (title, description,
// minutes) plus the template id they were seeded from. Status is the one-way
// ladder the contract requires: a row is a draft until `publishedAt` exists,
// and "never half-published" is a fact of the row.
// SOT: packages/payload/src/collections/Assignments.ts · design/screens/teacher/teacher.assign/contract.md
// SOT-KEYWORDS: assignments types teacher work items status draft published closed due date

export type AssignmentStatus = 'draft' | 'published' | 'closed';

/** One row of assigned work — FD-23's template shape, editable after seeding. */
export interface AssignmentWorkItem {
  /** ASSIGNMENT_TEMPLATES id this item was seeded from, if any. */
  templateId?: string | null;
  title: string;
  description: string;
  minutes: number;
}

export interface Assignment {
  id: string;
  /** The target class — a `classes` document id. */
  classId: string;
  /** Better Auth user id of the authoring teacher. */
  teacherAuthId: string;
  /** School slug, denormalized from the class for tenant scoping. */
  orgId: string;
  title: string;
  subject?: string | null;
  /** ISO date string the work is due. */
  dueAt: string;
  workItems: AssignmentWorkItem[];
  status: AssignmentStatus;
  /** ISO date string, set exactly once at publish. A draft has none. */
  publishedAt?: string | null;
}

/**
 * What a teacher supplies to create a draft. Identity is NOT here — the
 * service verifies `classId` against the teacher's own classes and takes
 * teacher/org from ctx.
 */
export interface CreateAssignmentInput {
  classId: string;
  title: string;
  subject?: string | null;
  dueAt: string;
  workItems: AssignmentWorkItem[];
}
