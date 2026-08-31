import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { DistrictHomeScreen } from '@acme/app';
import { loadDistrictOverview } from '@acme/app/server';
import { auth } from '../../lib/auth';
import { loadOrgBranding } from '../../lib/org.repository';

export const metadata: Metadata = {
  title: 'District outcomes — Moyo',
  description: 'Your district outcomes.',
};

export default async function DistrictOutcomesPage() {
  const h = await headers();
  const org = await loadDistrictOverview(loadOrgBranding, auth, h);
  return <DistrictHomeScreen org={org} />;
}
