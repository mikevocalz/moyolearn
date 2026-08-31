import type { Metadata } from 'next';
import { AppQueryProvider, SessionProvider } from '@acme/app';
import { Document } from '../Document';
import { RoleShell } from '../../components/site/RoleShell';
import '../rn-globals';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Tutor — Moyo',
  description: 'Your tutor dashboard.',
};

export default function TutorLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <SessionProvider>
      <AppQueryProvider>
        <Document>
          <RoleShell allowedKinds={['tutor']}>{children}</RoleShell>
        </Document>
      </AppQueryProvider>
    </SessionProvider>
  );
}
