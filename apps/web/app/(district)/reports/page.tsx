import type { Metadata } from 'next';
import { InstitutionPlaceholderScreen } from '@acme/app';

export const metadata: Metadata = {
  title: 'Reports — Moyo',
  description: 'District reports.',
};

export default function DistrictReportsPage() {
  return (
    <InstitutionPlaceholderScreen
      title="Reports"
      description="District reports will appear here."
    />
  );
}
