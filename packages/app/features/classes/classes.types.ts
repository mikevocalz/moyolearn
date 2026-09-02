// Classes domain types — the teacher's roster container as the app names it.
//
// `GradeBand` is imported from FD-23's step machine rather than restated: the
// band decides which join routes are lawful (steps.ts `joinOptions`), and two
// files each declaring what a band can be is how 'mixed' ends up meaning two
// different things. The roster itself is the Enrollment type — a class roster
// is enrollments filtered by `classId`, never a second row shape.
// SOT: packages/payload/src/collections/Classes.ts · packages/app/features/onboarding/teacher/steps.ts (FD-23)
// SOT-KEYWORDS: classes types teacher roster grade band class code detail create input

import type { GradeBand } from '../onboarding/teacher/steps.ts';
import type { Enrollment } from '../enrollment/enrollment.types.ts';

export interface TeacherClass {
  id: string;
  name: string;
  gradeBand: GradeBand;
  /** FD-23 join code — minted with `classCode()`, unique across the platform. */
  code: string;
  /** Better Auth user id of the owning teacher. */
  teacherAuthId: string;
  /** School slug the class belongs to. */
  orgId: string;
  subject?: string | null;
  status: 'active' | 'archived';
}

/** A class with its roster — the teacher.classes detail pane in one read. */
export interface TeacherClassDetail {
  class: TeacherClass;
  roster: Enrollment[];
}

/**
 * What a teacher supplies to create a class. Identity (teacher, org) and the
 * code are NOT here — they come from ctx and the FD-23 mint at the service
 * boundary, never from client input.
 */
export interface CreateClassInput {
  name: string;
  gradeBand: GradeBand;
  subject?: string | null;
}
