import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { SchoolListScreen } from '@acme/app';
import { loadDistrictOverview, loadDistrictSchools } from '@acme/app/server';
import { auth } from '../../../lib/auth';
import { loadOrgBranding, loadSchools } from '../../../lib/org.repository';

export const metadata: Metadata = {
  title: 'Schools — Moyo',
  description: 'Schools in this district.',
};

export default async function DistrictSchoolsPage() {
  const h = await headers();
  const [org, schools] = await Promise.all([
    loadDistrictOverview(loadOrgBranding, auth, h),
    loadDistrictSchools(loadSchools, auth, h),
  ]);
  return <SchoolListScreen schools={schools} org={org} />;
}
