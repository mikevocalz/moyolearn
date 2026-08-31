import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { View } from '@acme/ui/tw';
import { AppQueryProvider, SessionProvider, ThemeProvider, resolveTenantTheme } from '@acme/app';
import { tenantSlugFromHost } from '@acme/auth/host-tenant';
import { Document } from '../Document';
import { SiteChrome } from '../../components/site/SiteChrome';
import { loadOrgBranding } from '../../lib/org.repository';
import '../rn-globals';
import '../globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Moyo — Learn it by heart.',
    template: '%s — Moyo',
  },
  description:
    'Moyo is AI tutoring that helps a child learn it by heart — and helps the parents, tutors, and teachers around them help better.',
};

export default async function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const slug = tenantSlugFromHost(host);
  const org = slug ? await loadOrgBranding(slug) : null;
  const brand = resolveTenantTheme(org?.brandTheme, null);

  return (
    <SessionProvider>
      <AppQueryProvider>
        <ThemeProvider value={brand}>
          <Document>
            <View className="flex-1">
              <SiteChrome orgBranding={org}>{children}</SiteChrome>
            </View>
          </Document>
        </ThemeProvider>
      </AppQueryProvider>
    </SessionProvider>
  );
}
