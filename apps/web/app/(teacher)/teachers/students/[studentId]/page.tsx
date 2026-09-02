// /teachers/students/[studentId] — the folded teacher.students detail. A thin
// param unwrapper: `classId` rides as a query param because the enrollment row
// is read through its class roster (no per-student API — see
// student-detail-content.tsx); the screen owns everything else.
// SOT: design/screens/teacher/teacher.classes/contract.md
// SOT-KEYWORDS: student page route param teacher enrollment detail
import { StudentDetailScreen } from '@acme/app';

export default async function StudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ classId?: string }>;
}) {
  const { studentId } = await params;
  const { classId } = await searchParams;
  return <StudentDetailScreen studentId={studentId} classId={classId} />;
}
