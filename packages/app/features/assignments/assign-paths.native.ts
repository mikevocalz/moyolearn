// Teacher assign route paths — native fork. Expo Router mounts the teacher
// shell's stack routes group-relative (`(teacher)/assign/new` resolves to
// `/assign/new`), unlike web's `/teachers/*` pages — the classes-paths fork
// pair established why this is a fork and not a `Platform.OS` branch.
// SOT: apps/mobile/app/(teacher)/_layout.tsx · design/screens/teacher/teacher.assign/contract.md
// SOT-KEYWORDS: assign paths routes native mobile new detail tracking href fork

/** The Assign tab root — the tracking list every exit returns to. */
export const assignRootPath = () => '/assign';

/**
 * The create form. `classId` rides as a query param when the entry is class
 * detail's "Assign work to this class" (contract entry_points) — the same
 * arrangement as studentDetailPath's classId.
 */
export const newAssignmentPath = (classId?: string) =>
  classId === undefined ? '/assign/new' : `/assign/new?classId=${encodeURIComponent(classId)}`;

export const assignmentDetailPath = (assignmentId: string) =>
  `/assign/${encodeURIComponent(assignmentId)}`;
