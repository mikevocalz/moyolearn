/**
 * Pure roster helpers: filtering and the date column.
 * Type-only imports so scripts/classrooms.test.mjs can load it under Node.
 * SOT: docs/desktop/handoff/D05.md
 * SOT-KEYWORDS: desktop classrooms roster filter date format
 */
import type { Enrollment, TeacherClass } from "./types";

/** Case-insensitive match on the row label and program. Empty query keeps everything. */
export function filterRoster(rows: readonly Enrollment[], query: string): readonly Enrollment[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter(
    (row) => row.learnerAuthId.toLowerCase().includes(needle) || (row.program ?? "").toLowerCase().includes(needle),
  );
}

export function activeClasses(classes: readonly TeacherClass[]): readonly TeacherClass[] {
  return classes.filter((item) => item.status === "active");
}

/**
 * Which class to show after the class list reloads. The selected class stays
 * selected (with its student selection and filter) while it is still listed;
 * otherwise the first class, or none.
 */
export function nextSelection(
  classes: readonly TeacherClass[],
  selectedClassId: string | null,
): { readonly classId: string | null; readonly unchanged: boolean } {
  if (selectedClassId !== null && classes.some((item) => item.id === selectedClassId)) {
    return { classId: selectedClassId, unchanged: true };
  }
  return { classId: classes[0]?.id ?? null, unchanged: false };
}

/** "Mar 4, 2026" in the user's locale; plain speech, no relative pressure. */
export function enrolledOn(iso: string, locale?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}

export function countLabel(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "student" : "students"}`;
}
