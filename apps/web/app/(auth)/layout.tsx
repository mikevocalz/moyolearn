import type { Metadata } from 'next';
import { AppQueryProvider, SessionProvider } from '@acme/app';
import { Document } from '../Document';
import '../rn-globals';
import '../globals.css';

export const metadata: Metadata = {
  title: { default: 'Sign in — Moyo', template: '%s — Moyo' },
  description: 'Sign in to Moyo, or set up a new account.',
};

/**
 * The layout `/login` and `/onboarding` never had.
 *
 * Both routes sat outside every route group, and this app has no root
 * `app/layout.tsx` — only per-group ones. Next therefore rendered them with NO
 * root layout at all: the built `login.html` contained zero `<html>` elements
 * and zero stylesheets. Every `className` on those pages was inert, the fonts
 * never loaded, and neither `SessionProvider` nor `AppQueryProvider` was mounted
 * — so a hook reaching for the session on the onboarding flow found none.
 *
 * A GROUP rather than a layout file per route, because the two shared the bug
 * and would have shared the fix by copy. Route groups do not appear in the URL,
 * so `/login` and `/onboarding` are unchanged.
 *
 * No SiteHeader or SiteFooter: signing in is not a marketing surface, and a
 * public nav offering "Pricing" above a district's own login is the same
 * mistake `/ops` made when it inherited that chrome.
 */
export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <SessionProvider>
      <AppQueryProvider>
        <Document>{children}</Document>
      </AppQueryProvider>
    </SessionProvider>
  );
}
