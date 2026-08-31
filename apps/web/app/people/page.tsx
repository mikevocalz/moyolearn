import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { PeopleListScreen } from '@acme/app';
import { loadOrgPeople } from '@acme/app/server';
import { tenantSlugFromHost } from '@acme/auth/host-tenant';
import { auth } from '../../lib/auth';
import { loadOrgBranding, loadOrgKind } from '../../lib/org.repository';
import { loadOrgMembers } from '../../lib/people.repository';

export const metadata: Metadata = {
  title: 'People — Moyo',
  description: 'People in your organization.',
};

export default async function PeoplePage() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const slug = tenantSlugFromHost(host);
  if (!slug) {
    notFound();
  }

  const kind = await loadOrgKind({ orgId: slug, learnerId: '', isLearner: false });
  if (kind !== 'district' && kind !== 'school') {
    notFound();
  }

  const { org, members } = await loadOrgPeople(
    loadOrgBranding,
    loadOrgMembers,
    auth,
    h,
    kind,
  );

  return <PeopleListScreen org={org} members={members} kind={kind} />;
}
