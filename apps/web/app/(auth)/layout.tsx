import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'Sign in — Moyo', template: '%s — Moyo' },
  description: 'Sign in to Moyo, or set up a new account.',
};

/**
 * Metadata only. The root `app/layout.tsx` owns the document, providers, and
 * chrome for every group — when this layout also rendered `Document`, the
 * page shipped a nested `<html>` and the login form rendered as a blank body.
 * Anon chrome is bare (SiteChrome), so /login gets its TwoPaneShell unwrapped.
 */
export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
