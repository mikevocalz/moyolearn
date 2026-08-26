import type { Metadata } from 'next';
import { AppQueryProvider, SessionProvider } from '@acme/app';
import { Document } from '../Document';
import '../rn-globals';
import '../globals.css';

export const metadata: Metadata = {
  title: { default: 'Operations — Moyo', template: '%s — Moyo Operations' },
  description: 'Run the tutoring business: pipeline, scheduling, attendance and billing.',
};

/**
 * Its OWN root layout, deliberately without SiteHeader/SiteFooter.
 *
 * `/ops` first shipped inside the `(site)` group and inherited the marketing
 * chrome, so the dashboard rendered underneath a public nav bar and above a
 * footer — two competing headers and a page that could never own the viewport.
 * DashboardShell is `h-dvh` and IS the chrome for this surface.
 */
export default function OpsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <SessionProvider>
      <AppQueryProvider>
        <Document>
          {/*
            A plain <div>, not the shell's own root, is what pins the app to the
            viewport. `h-dvh` on the shell did nothing: that root is an RNW View
            whose classes are compiled by react-native-css, which drops `dvh`, so
            the shell sized to its content (1890px in a 773px window) and the
            whole page scrolled — taking the sidebar with it. This element is
            real DOM, so Tailwind's stylesheet reaches it, and the shell then
            resolves `h-full` against a parent that actually has a height.
          */}
          <div className="h-dvh overflow-hidden">{children}</div>
        </Document>
      </AppQueryProvider>
    </SessionProvider>
  );
}
