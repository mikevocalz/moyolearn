import type { Metadata } from 'next';
import { AppQueryProvider, SessionProvider } from '@acme/app';
import { Document } from '../Document';
import { RoleShell } from '../../components/site/RoleShell';
import '../rn-globals';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Business — Moyo',
  description: 'Your tutoring business overview.',
};

export default function BusinessLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <SessionProvider>
      <AppQueryProvider>
        <Document>
          <RoleShell allowedKinds={['owner', 'staff']}>{children}</RoleShell>
        </Document>
      </AppQueryProvider>
    </SessionProvider>
  );
}
