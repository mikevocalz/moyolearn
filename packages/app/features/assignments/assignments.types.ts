// Assignments domain types — teacher.assign's object as the app names it.
//
// Work items carry FD-23's `AssignmentTemplate` shape (title, description,
// minutes) plus the template id they were seeded from. Status is the one-way
// ladder the contract requires: a row is a draft until `publishedAt` exists,
// and "never half-published" is a fact of the row.
// SOT: packages/payload/src/collections/Assignments.ts · design/screens/teacher/teacher.assign/contract.md
// SOT-KEYWORDS: assignments types teacher work items status draft published closed due date completion counts roster

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
 * An assignment as the teacher's READ surfaces receive it: the row plus its
 * completion counts. Counts-only is deliberate — "X of Y done" is the whole
 * completion story a teacher gets; a per-student done/not-done list waits for
 * a contract row that says so (assignments.service.ts owns the decision).
 * `rosterCount` is the class's ACTIVE enrollments — who owes the work now.
 */
export interface AssignmentWithCounts extends Assignment {
  doneCount: number;
  rosterCount: number;
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

/**
 * A field patch for a DRAFT the teacher already owns. Every member is
 * optional — only what changed travels — and the same floors as create apply
 * to whatever is present (non-empty title, valid dueAt, ≥1 work item). Status
 * and publishedAt are deliberately absent: lifecycle moves stay their own
 * actions, and editing a published row is refused at the service.
 */
export interface EditAssignmentInput {
  classId?: string;
  title?: string;
  subject?: string | null;
  dueAt?: string;
  workItems?: AssignmentWorkItem[];
}
