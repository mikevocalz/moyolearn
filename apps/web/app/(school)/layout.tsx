import type { Metadata } from 'next';
import { AppQueryProvider, SessionProvider } from '@acme/app';
import { Document } from '../Document';
import { RoleShell } from '../../components/site/RoleShell';
import '../rn-globals';
import '../globals.css';

export const metadata: Metadata = {
  title: 'School — Moyo',
  description: 'Your school dashboard.',
};

export default function SchoolLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <SessionProvider>
      <AppQueryProvider>
        <Document>
          <RoleShell allowedKinds={['school_admin']}>{children}</RoleShell>
        </Document>
      </AppQueryProvider>
    </SessionProvider>
  );
}
