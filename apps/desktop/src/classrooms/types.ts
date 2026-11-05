/**
 * Wire shapes of the teacher classes API on main, restated for a client that
 * cannot import `@acme/app` (its entry reaches Nitro v1, Viro and expo-router).
 *
 * GET /api/teacher/classes            → { ok: true, classes: TeacherClass[] }
 * GET /api/teacher/classes/:id/roster → { ok: true, class: TeacherClass, roster: Enrollment[] }
 * Sources: packages/app/features/classes/classes.types.ts and
 * packages/app/features/enrollment/enrollment.types.ts (type-only files on main;
 * they import GradeBand from onboarding/teacher/steps.ts, which is not type-only,
 * so a string stands in for it here). Fields the desktop does not read are omitted.
 * SOT: apps/web/app/api/teacher/classes/route.ts · apps/web/app/api/teacher/classes/[classId]/roster/route.ts
 * SOT-KEYWORDS: desktop classrooms types teacher class roster enrollment api
 */

export interface TeacherClass {
  readonly id: string;
  readonly name: string;
  readonly gradeBand: string;
  readonly code: string;
  readonly subject?: string | null;
  readonly status: "active" | "archived";
}

export interface Enrollment {
  readonly id: string;
  /** The roster's row label on main as well (class-detail-content.tsx renders it). */
  readonly learnerAuthId: string;
  readonly program?: string | null;
  readonly status: "active" | "inactive";
  /** ISO timestamp. */
  readonly enrolledAt: string;
  readonly exitedAt?: string | null;
}
