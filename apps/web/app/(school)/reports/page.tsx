import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { InstitutionPlaceholderScreen } from '@acme/app';
import { loadInstitutionOverview } from '@acme/app/server';
import { auth } from '../../../lib/auth';
import { loadOrgBranding } from '../../../lib/org.repository';

export const metadata: Metadata = {
  title: 'Reports — Moyo',
  description: 'School reports.',
};

export default async function SchoolReportsPage() {
  const h = await headers();
  const org = await loadInstitutionOverview(
    loadOrgBranding,
    { scope: 'school', resource: 'reports' },
    auth,
    h,
  );
  return (
    <InstitutionPlaceholderScreen
      title="Reports"
      description="School reports will appear here."
      org={org}
    />
  );
}
