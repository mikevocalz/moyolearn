import type { Metadata } from 'next';
import { InstitutionPlaceholderScreen } from '@acme/app';

export const metadata: Metadata = {
  title: 'Academics — Moyo',
  description: 'School academics.',
};

export default function SchoolAcademicsPage() {
  return (
    <InstitutionPlaceholderScreen
      title="Academics"
      description="School academics, subjects and programs will appear here."
    />
  );
}
