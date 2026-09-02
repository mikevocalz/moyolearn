// /teachers/assign — the teacher Assign surface: the tracking list, with the
// create form and assignment detail one push away.
// SOT: design/screens/teacher/teacher.assign/contract.md
// SOT-KEYWORDS: assign page route teacher tracking list assignments
import type { Metadata } from 'next';
import { AssignScreen } from '@acme/app';

export const metadata: Metadata = {
  title: 'Assign — Moyo',
  description: 'What you have assigned, and where each piece stands.',
};

export default function TeacherAssignPage() {
  return <AssignScreen />;
}
