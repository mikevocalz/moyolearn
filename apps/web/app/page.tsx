import { headers } from 'next/headers';
import { DistrictHomeScreen, HomeScreen, SchoolHomeScreen } from '@acme/app';
import { loadDistrictOverview, loadSchoolOverview } from '@acme/app/server';
import { tenantSlugFromHost } from '@acme/auth/host-tenant';
import { auth } from '../lib/auth';
import { loadOrgBranding, loadOrgKind } from '../lib/org.repository';

export default async function HomePage() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const slug = tenantSlugFromHost(host);
  if (!slug) {
    return <HomeScreen />;
  }

  const kind = await loadOrgKind({ orgId: slug, learnerId: '', isLearner: false });
  if (kind === 'district') {
    const org = await loadDistrictOverview(loadOrgBranding, auth, h);
    return <DistrictHomeScreen org={org} />;
  }

  if (kind === 'school') {
    const org = await loadSchoolOverview(loadOrgBranding, auth, h);
    return <SchoolHomeScreen org={org} />;
  }

  return <HomeScreen />;
}
