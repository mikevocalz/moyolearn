// /teachers/assign/[assignmentId] — one assignment's status and lifecycle
// (teacher.assign detail). A thin param unwrapper: the screen owns everything
// else.
// SOT: design/screens/teacher/teacher.assign/contract.md
// SOT-KEYWORDS: assignment page route param teacher detail publish close extend
import { AssignmentDetailScreen } from '@acme/app';

export default async function AssignmentPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  return <AssignmentDetailScreen assignmentId={assignmentId} />;
}
