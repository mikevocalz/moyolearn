// Teacher assign route paths — web fork. The teacher shell's web routes live
// under `/teachers/*` (nav.ts rail), while the mobile shell mounts the same
// screens at group-relative paths, so the ONE thing allowed to differ per
// platform — the pushed href — lives in this fork pair instead of a runtime
// `Platform.OS` branch (repo fork law, the classes-paths precedent).
// SOT: apps/web/components/site/nav.ts (RAIL_BY_ROLE.teacher) · design/screens/teacher/teacher.assign/contract.md
// SOT-KEYWORDS: assign paths routes web teachers new detail tracking href fork

/** `/teachers/assign` — the tracking list every exit returns to. */
export const assignRootPath = () => '/teachers/assign';

/**
 * `/teachers/assign/new` — the create form. `classId` rides as a query param
 * when the entry is class detail's "Assign work to this class" (contract
 * entry_points) — the same arrangement as studentDetailPath's classId.
 */
export const newAssignmentPath = (classId?: string) =>
  classId === undefined
    ? '/teachers/assign/new'
    : `/teachers/assign/new?classId=${encodeURIComponent(classId)}`;

/** `/teachers/assign/[assignmentId]` — one assignment's status and lifecycle. */
export const assignmentDetailPath = (assignmentId: string) =>
  `/teachers/assign/${encodeURIComponent(assignmentId)}`;

/**
 * Edit a DRAFT's fields — the create form in edit mode. The same route as
 * `newAssignmentPath` with the target riding as a query param (the house
 * idiom for form context: classId above, studentDetailPath's classId), not a
 * second form route.
 */
export const editAssignmentPath = (assignmentId: string) =>
  `/teachers/assign/new?assignmentId=${encodeURIComponent(assignmentId)}`;
