import type { Metadata } from 'next';
import { InstitutionPlaceholderScreen } from '@acme/app';

export const metadata: Metadata = {
  title: 'Reports — Moyo',
  description: 'School reports.',
};

export default function SchoolReportsPage() {
  return (
    <InstitutionPlaceholderScreen
      title="Reports"
      description="School reports will appear here."
    />
  );
}
