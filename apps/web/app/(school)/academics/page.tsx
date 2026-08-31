import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { InstitutionPlaceholderScreen } from '@acme/app';
import { loadInstitutionOverview } from '@acme/app/server';
import { auth } from '../../../lib/auth';
import { loadOrgBranding } from '../../../lib/org.repository';

export const metadata: Metadata = {
  title: 'Academics — Moyo',
  description: 'School academics.',
};

export default async function SchoolAcademicsPage() {
  const h = await headers();
  const org = await loadInstitutionOverview(
    loadOrgBranding,
    { scope: 'school', resource: 'programs' },
    auth,
    h,
  );
  return (
    <InstitutionPlaceholderScreen
      title="Academics"
      description="School academics, subjects and programs will appear here."
      org={org}
    />
  );
}
