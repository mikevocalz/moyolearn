import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { InstitutionPlaceholderScreen } from '@acme/app';
import { loadInstitutionOverview } from '@acme/app/server';
import { auth } from '../../../lib/auth';
import { loadOrgBranding } from '../../../lib/org.repository';

export const metadata: Metadata = {
  title: 'Schools — Moyo',
  description: 'Schools in this district.',
};

export default async function DistrictSchoolsPage() {
  const h = await headers();
  const org = await loadInstitutionOverview(
    loadOrgBranding,
    { scope: 'district', resource: 'schools' },
    auth,
    h,
  );
  return (
    <InstitutionPlaceholderScreen
      title="Schools"
      description="Schools in this district will appear here."
      org={org}
    />
  );
}
