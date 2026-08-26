import type { Metadata } from 'next';
import { View } from '@acme/ui/tw';
import { SessionProvider } from '@acme/app';
import { Document } from '../Document';
import { SiteHeader } from '../../components/site/SiteHeader';
import { SiteFooter } from '../../components/site/SiteFooter';
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
      <Document>
        <SiteHeader />
        {/* `flex-1`, not `min-h-screen`. The body is already a `min-h-dvh` column, so
            forcing 100vh here stacked a full viewport on TOP of the header and footer
            — every short screen ended in a ~200px void above the footer. */}
        <View className="flex-1 pb-section">{children}</View>
        <SiteFooter />
      </Document>
    </SessionProvider>
  );
}
