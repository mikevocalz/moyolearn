import type { Metadata } from 'next';
import { View } from '@acme/ui/tw';
import { AppQueryProvider, SessionProvider } from '@acme/app';
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
  /*
    The mobile app has mounted AppQueryProvider since it shipped; web never did,
    so every @acme/app hook that reaches for the server cache had no client to
    reach for. Server state belongs to Query on both platforms or the shared
    screens quietly diverge.
  */
  return (
    <SessionProvider>
      <AppQueryProvider>
        <Document>
          <SiteHeader />
          {/* `flex-1`, not `min-h-screen`. The body is already a `min-h-dvh` column, so
              forcing 100vh here stacked a full viewport on TOP of the header and footer
              — every short screen ended in a ~200px void above the footer. */}
          <View className="flex-1 pb-section">{children}</View>
          <SiteFooter />
        </Document>
      </AppQueryProvider>
    </SessionProvider>
  );
}
