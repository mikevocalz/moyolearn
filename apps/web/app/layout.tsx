import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { AppQueryProvider, SessionProvider, resolveTenantTheme, tenantCssVariables } from '@acme/app';
import { tenantSlugFromHost } from '@acme/auth/host-tenant';
import { Document } from './Document';
import { RoleShell } from '../components/site/RoleShell';
import { SiteChrome } from '../components/site/SiteChrome';
import { loadOrgBranding, loadOrgKind } from '../lib/org.repository';
import './rn-globals';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Moyo — Learn it by heart.',
    template: '%s — Moyo',
  },
  description:
    'Moyo is AI tutoring that helps a child learn it by heart — and helps the parents, tutors, and teachers around them help better.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const slug = tenantSlugFromHost(host);
  const [org, kind] = await Promise.all([
    slug ? loadOrgBranding(slug) : null,
    slug ? loadOrgKind({ orgId: slug, learnerId: '', isLearner: false }) : null,
  ]);
  const moyoDefault = { name: 'Moyo' };
  const tenantBrand = org ?? moyoDefault;
  const tenantTheme = resolveTenantTheme(tenantBrand, null);
  const tenantStyle = tenantCssVariables(tenantTheme);

  const allowedKinds =
    kind === 'district' ? (['district_admin'] as const)
    : kind === 'school' ? (['school_admin'] as const)
    : undefined;

  return (
    <Document style={tenantStyle}>
      <SessionProvider>
        <AppQueryProvider>
          {allowedKinds ? (
            <RoleShell allowedKinds={allowedKinds} orgBranding={org}>
              {children}
            </RoleShell>
          ) : (
            <SiteChrome orgBranding={org}>{children}</SiteChrome>
          )}
        </AppQueryProvider>
      </SessionProvider>
    </Document>
  );
}
