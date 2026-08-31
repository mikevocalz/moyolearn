import type { Metadata } from 'next';
import { View } from '@acme/ui/tw';
import { AppQueryProvider, SessionProvider } from '@acme/app';
import { Document } from '../Document';
import { SiteChrome } from '../../components/site/SiteChrome';
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

export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <SessionProvider>
      <AppQueryProvider>
        <Document>
          <View className="flex-1">
            <SiteChrome>{children}</SiteChrome>
          </View>
        </Document>
      </AppQueryProvider>
    </SessionProvider>
  );
}
