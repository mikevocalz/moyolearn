// Enrollment domain types.
//
// This is the canonical learner-to-organization roster. It is the bridge from
// learner-only tables (tutor sessions, learning data, safety) to school and
// district reporting.
// SOT: packages/payload/src/collections/Enrollments.ts
// SOT-KEYWORDS: enrollment roster learner orgId school district status

export interface Enrollment {
  id: string;
  /** Better Auth user id of the learner. */
  learnerAuthId: string;
  /** School or district slug the learner is enrolled in. */
  orgId: string;
  /** District slug, denormalized for district rollups. */
  districtId?: string | null;
  /** Optional program or cohort name. */
  program?: string | null;
  status: 'active' | 'inactive';
  /** ISO date string when the learner began enrollment. */
  enrolledAt: string;
  /** ISO date string when the learner left, if applicable. */
  exitedAt?: string | null;
}
