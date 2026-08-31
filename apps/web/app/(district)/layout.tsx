import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { AppQueryProvider, SessionProvider } from '@acme/app';
import { tenantSlugFromHost } from '@acme/auth/host-tenant';
import { Document } from '../Document';
import { RoleShell } from '../../components/site/RoleShell';
import { loadOrgBranding } from '../../lib/org.repository';
import '../rn-globals';
import '../globals.css';

export const metadata: Metadata = {
  title: 'District — Moyo',
  description: 'Your district outcomes dashboard.',
};

export default async function DistrictLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const slug = tenantSlugFromHost(host);
  const org = slug ? await loadOrgBranding(slug) : null;

  return (
    <SessionProvider>
      <AppQueryProvider>
        <Document>
          <RoleShell allowedKinds={['district_admin']} orgBranding={org}>
            {children}
          </RoleShell>
        </Document>
      </AppQueryProvider>
    </SessionProvider>
  );
}
