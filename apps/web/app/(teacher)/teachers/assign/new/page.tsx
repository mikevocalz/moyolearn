// /teachers/assign/new — the create-assignment form. A thin param unwrapper:
// `classId` rides as an optional query param (class detail's "Assign work to
// this class" pre-fills the picker with it); the screen owns everything else.
// SOT: design/screens/teacher/teacher.assign/contract.md
// SOT-KEYWORDS: assignment new page route teacher create form draft classId
import type { Metadata } from 'next';
import { AssignmentFormScreen } from '@acme/app';

export const metadata: Metadata = {
  title: 'New assignment — Moyo',
  description: 'Create and publish an assignment for one of your classes.',
};

export default async function NewAssignmentPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>;
}) {
  const { classId } = await searchParams;
  return <AssignmentFormScreen classId={classId} />;
}
