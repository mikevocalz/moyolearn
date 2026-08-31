import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { InstitutionPlaceholderScreen } from '@acme/app';
import { loadInstitutionOverview } from '@acme/app/server';
import { tenantSlugFromHost } from '@acme/auth/host-tenant';
import { auth } from '../../lib/auth';
import { loadOrgBranding, loadOrgKind } from '../../lib/org.repository';

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

  const org = await loadInstitutionOverview(
    loadOrgBranding,
    { scope: kind, resource: 'people' },
    auth,
    h,
  );

  const description =
    kind === 'district'
      ? 'District staff and contacts will appear here.'
      : 'School staff, learners and guardians will appear here.';

  return <InstitutionPlaceholderScreen title="People" description={description} org={org} />;
}
