import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { OrgSettingsScreen } from '@acme/app';
import { loadOrgSettings } from '@acme/app/server';
import { auth } from '@/lib/auth';
import { loadOrgBranding } from '@/lib/org.repository';

/*
  `/settings/org`, not `/settings`: `(site)/settings/page.tsx` already serves
  the shared device-prefs page at /settings, and two route groups resolving one
  path fails the build (the 2026-08-31 consolidation's exact lesson). One page
  for PW-05's org spirit — the whole surface is read-only display, and identity
  + plan are one summary, not two half-screens (org.settings contract Status).
*/
export const metadata: Metadata = {
  title: 'Org settings — Moyo',
  description: 'Your organization’s identity and plan.',
};

export default async function OrgSettingsPage() {
  const h = await headers();
  // Owner/finance wall lives in the service (`requiresMembership`), where no
  // route can lower it; denied resolves to the screen's role wall.
  const read = await loadOrgSettings(loadOrgBranding, auth, h);
  return <OrgSettingsScreen read={read} />;
}
