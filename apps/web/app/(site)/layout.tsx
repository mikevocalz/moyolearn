import type { Metadata } from 'next';
import { View } from '@acme/ui/tw';
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
    <Document>
      <SiteHeader />
      <View className="min-h-screen flex-1">{children}</View>
      <SiteFooter />
    </Document>
  );
}
