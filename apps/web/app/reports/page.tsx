import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { InstitutionPlaceholderScreen } from '@acme/app';
import { loadInstitutionOverview } from '@acme/app/server';
import { tenantSlugFromHost } from '@acme/auth/host-tenant';
import { auth } from '../../lib/auth';
import { loadOrgBranding, loadOrgKind } from '../../lib/org.repository';

export const metadata: Metadata = {
  title: 'Reports — Moyo',
  description: 'Reports for your organization.',
};

export default async function ReportsPage() {
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
    { scope: kind, resource: 'reports' },
    auth,
    h,
  );

  const description =
    kind === 'district'
      ? 'District reports will appear here.'
      : 'School reports will appear here.';

  return <InstitutionPlaceholderScreen title="Reports" description={description} org={org} />;
}
