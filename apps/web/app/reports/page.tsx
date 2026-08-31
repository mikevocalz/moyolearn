import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { InstitutionReportsScreen } from '@acme/app';
import { loadEnrollmentReport } from '@acme/app/server';
import { tenantSlugFromHost } from '@acme/auth/host-tenant';
import { auth } from '../../lib/auth';
import { loadEnrollments } from '../../lib/enrollment.repository';
import { loadOrgBranding, loadOrgKind, loadSchools } from '../../lib/org.repository';

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

  const [org, report] = await Promise.all([
    loadOrgBranding(slug),
    loadEnrollmentReport(loadEnrollments, loadSchools, auth, h, kind),
  ]);

  return <InstitutionReportsScreen title="Reports" org={org} report={report} />;
}
