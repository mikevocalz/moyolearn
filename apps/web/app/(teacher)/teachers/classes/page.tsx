// /teachers/classes — the teacher Classes surface: list beside detail on
// expanded widths (AdaptivePanes), list alone when collapsed.
// SOT: design/screens/teacher/teacher.classes/contract.md
// SOT-KEYWORDS: classes page route teacher list pane roster
import type { Metadata } from 'next';
import { ClassesPaneScreen } from '@acme/app';

export const metadata: Metadata = {
  title: 'Classes — Moyo',
  description: 'Your classes and the students in each.',
};

export default function TeacherClassesPage() {
  return <ClassesPaneScreen />;
}
