import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { InstitutionPlaceholderScreen } from '@acme/app';
import { loadInstitutionOverview } from '@acme/app/server';
import { auth } from '../../../lib/auth';
import { loadOrgBranding } from '../../../lib/org.repository';

export const metadata: Metadata = {
  title: 'Reports — Moyo',
  description: 'District reports.',
};

export default async function DistrictReportsPage() {
  const h = await headers();
  const org = await loadInstitutionOverview(
    loadOrgBranding,
    { scope: 'district', resource: 'reports' },
    auth,
    h,
  );
  return (
    <InstitutionPlaceholderScreen
      title="Reports"
      description="District reports will appear here."
      org={org}
    />
  );
}
