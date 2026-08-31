import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { InstitutionPlaceholderScreen } from '@acme/app';
import { loadInstitutionOverview } from '@acme/app/server';
import { auth } from '../../../lib/auth';
import { loadOrgBranding } from '../../../lib/org.repository';

export const metadata: Metadata = {
  title: 'People — Moyo',
  description: 'People in this district.',
};

export default async function DistrictPeoplePage() {
  const h = await headers();
  const org = await loadInstitutionOverview(
    loadOrgBranding,
    { scope: 'district', resource: 'people' },
    auth,
    h,
  );
  return (
    <InstitutionPlaceholderScreen
      title="People"
      description="District staff and contacts will appear here."
      org={org}
    />
  );
}
