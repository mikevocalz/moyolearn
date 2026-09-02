import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { InstitutionReportsScreen, ReportsPaneScreen } from '@acme/app';
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
  /*
    Apex hosts serve the GUARDIAN reports list here rather than 404ing.
    Decision: one URL, two hosts — a `(guardian)/reports/page.tsx` cannot
    exist because this top-level page already owns `/reports` (two pages on
    one path is a build error), and `/reports` is the href both the guardian
    top-nav (nav.ts) and FamilyScreen's tool row push — the same path the
    mobile guardian Reports tab answers. ReportsPaneScreen is exactly what
    that tab renders; the root layout's SiteChrome puts the guardian RoleShell
    around it for authed guardians.
  */
  if (!slug) {
    return <ReportsPaneScreen />;
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
