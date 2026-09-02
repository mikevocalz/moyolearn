import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Session report — Moyo',
  description: 'A tutoring session report, shared by a guardian.',
  // A tokened page is a private page; the token in the URL must never end up
  // in an index because a crawler followed a pasted link.
  robots: { index: false, follow: false },
};

/**
 * The document comes from the root layout. The reader is a teacher with no
 * Moyo session and the page is server-rendered from a verified token, so
 * SiteChrome's CHROMELESS_PREFIXES covers `/share` — the content renders
 * immediately, never waiting on an auth handshake it cannot pass.
 */
export default function ShareLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
