import type { Metadata } from 'next';
import { View } from '@acme/ui/tw';
import { Document } from '../Document';
import { SiteHeader } from '../../components/site/SiteHeader';
import { SiteFooter } from '../../components/site/SiteFooter';
import '../rn-globals';
import '../globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Solito NativeUI Starter',
    template: '%s — Solito NativeUI Starter',
  },
  description:
    'Universal app starter — Expo + Next.js + Payload sharing screens via Solito and a Uniwind UI kit.',
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
