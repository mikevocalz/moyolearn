// /teachers/classes/[classId] — one class with its roster (teacher.classes
// detail). A thin param unwrapper: the screen owns everything else.
// SOT: design/screens/teacher/teacher.classes/contract.md
// SOT-KEYWORDS: class page route param teacher roster detail
import { ClassDetailScreen } from '@acme/app';

export default async function ClassPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  return <ClassDetailScreen classId={classId} />;
}
