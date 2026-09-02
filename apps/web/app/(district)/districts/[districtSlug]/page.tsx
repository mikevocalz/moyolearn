import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { DistrictHomeScreen } from '@acme/app';
import { tenantSlugFromHost } from '@acme/auth/host-tenant';
import { loadOrgKind } from '@/lib/org.repository';

export const metadata: Metadata = {
  title: 'District outcomes — Moyo',
  description: 'Your district outcomes.',
};

export default async function DistrictOutcomesPage() {
  /*
    The people/page.tsx host-kind guard, mirrored: this deep link was ungated,
    so any host — or no tenant host at all — could render the district surface.
    Fail closed to 404 (never 403 — the route's existence is not an answer this
    page owes a stranger).
  */
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const slug = tenantSlugFromHost(host);
  if (!slug) {
    notFound();
  }

  const kind = await loadOrgKind({ orgId: slug, learnerId: '', isLearner: false });
  if (kind !== 'district') {
    notFound();
  }

  return <DistrictHomeScreen />;
}
