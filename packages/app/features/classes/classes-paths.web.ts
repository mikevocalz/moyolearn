// Teacher classes route paths — web fork. The teacher shell's web routes live
// under `/teachers/*` (nav.ts rail + `(teacher)/teachers` segment), while the
// mobile shell mounts the same screens at group-relative paths, so the ONE
// thing allowed to differ per platform — the pushed href — lives in this fork
// pair instead of a runtime `Platform.OS` branch (repo fork law).
// SOT: apps/web/components/site/nav.ts (RAIL_BY_ROLE.teacher) · design/screens/teacher/teacher.classes/contract.md
// SOT-KEYWORDS: classes paths routes web teachers detail student href fork

/** `/teachers/classes/[classId]` — the class detail page. */
export const classDetailPath = (classId: string) =>
  `/teachers/classes/${encodeURIComponent(classId)}`;

/**
 * `/teachers/students/[studentId]` — the folded teacher.students detail. The
 * class id rides along as a query param because the roster read is the only
 * door to an enrollment row (no per-student API exists yet).
 */
export const studentDetailPath = (enrollmentId: string, classId: string) =>
  `/teachers/students/${encodeURIComponent(enrollmentId)}?classId=${encodeURIComponent(classId)}`;
