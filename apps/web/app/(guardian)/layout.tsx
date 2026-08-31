import type { Metadata } from 'next';
import { AppQueryProvider, SessionProvider } from '@acme/app';
import { Document } from '../Document';
import { RoleShell } from '../../components/site/RoleShell';
import '../rn-globals';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Family — Moyo',
  description: 'Your family learning dashboard.',
};

export default function GuardianLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <SessionProvider>
      <AppQueryProvider>
        <Document>
          <RoleShell allowedKinds={['guardian']}>{children}</RoleShell>
        </Document>
      </AppQueryProvider>
    </SessionProvider>
  );
}
