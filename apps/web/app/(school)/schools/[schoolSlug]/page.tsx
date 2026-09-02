import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { SchoolHomeScreen } from '@acme/app';
import { tenantSlugFromHost } from '@acme/auth/host-tenant';
import { loadOrgKind } from '@/lib/org.repository';

export const metadata: Metadata = {
  title: 'School overview — Moyo',
  description: 'Your school overview.',
};

export default async function SchoolOverviewPage() {
  /*
    The people/page.tsx host-kind guard, mirrored: this deep link was ungated.
    A school host reads its own overview; a district host drills in from its
    /schools directory — the same pair people/page.tsx admits. Everything else
    fails closed to 404.
  */
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

  return <SchoolHomeScreen />;
}
