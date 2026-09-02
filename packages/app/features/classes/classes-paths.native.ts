// Teacher classes route paths — native fork. Expo Router mounts the teacher
// shell's stack routes group-relative (`(teacher)/classes/[classId]` resolves
// to `/classes/...`), unlike web's `/teachers/*` pages — see the web fork's
// header for why this is a fork pair and not a `Platform.OS` branch.
// SOT: apps/mobile/app/(teacher)/_layout.tsx · design/screens/teacher/teacher.classes/contract.md
// SOT-KEYWORDS: classes paths routes native mobile detail student href fork

/** The Classes tab root — teacher.assign's "Set up a class first" exit lands here. */
export const classesRootPath = () => '/classes';

export const classDetailPath = (classId: string) => `/classes/${encodeURIComponent(classId)}`;

export const studentDetailPath = (enrollmentId: string, classId: string) =>
  `/students/${encodeURIComponent(enrollmentId)}?classId=${encodeURIComponent(classId)}`;
