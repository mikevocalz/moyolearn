import type { Metadata } from 'next';
import { AppQueryProvider, SessionProvider } from '@acme/app';
import { Document } from '../Document';
import { RoleShell } from '../../components/site/RoleShell';
import '../rn-globals';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Teacher — Moyo',
  description: 'Your classroom dashboard.',
};

export default function TeacherLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <SessionProvider>
      <AppQueryProvider>
        <Document>
          <RoleShell allowedKinds={['teacher']}>{children}</RoleShell>
        </Document>
      </AppQueryProvider>
    </SessionProvider>
  );
}
