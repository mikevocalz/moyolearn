import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { SchoolHomeScreen } from '@acme/app';
import { loadSchoolOverview } from '@acme/app/server';
import { auth } from '../../lib/auth';
import { loadOrgBranding } from '../../lib/org.repository';

export const metadata: Metadata = {
  title: 'School overview — Moyo',
  description: 'Your school overview.',
};

export default async function SchoolOverviewPage() {
  const h = await headers();
  const org = await loadSchoolOverview(loadOrgBranding, auth, h);
  return <SchoolHomeScreen org={org} />;
}
