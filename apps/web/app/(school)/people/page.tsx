import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { InstitutionPlaceholderScreen } from '@acme/app';
import { loadInstitutionOverview } from '@acme/app/server';
import { auth } from '../../../lib/auth';
import { loadOrgBranding } from '../../../lib/org.repository';

export const metadata: Metadata = {
  title: 'People — Moyo',
  description: 'People in this school.',
};

export default async function SchoolPeoplePage() {
  const h = await headers();
  const org = await loadInstitutionOverview(
    loadOrgBranding,
    { scope: 'school', resource: 'people' },
    auth,
    h,
  );
  return (
    <InstitutionPlaceholderScreen
      title="People"
      description="School staff, learners and guardians will appear here."
      org={org}
    />
  );
}
