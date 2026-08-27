import type { Metadata } from 'next';
import { Document } from '../Document';
import '../rn-globals';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Session report — Moyo',
  description: 'A tutoring session report, shared by a guardian.',
  // A tokened page is a private page; the token in the URL must never end up
  // in an index because a crawler followed a pasted link.
  robots: { index: false, follow: false },
};

/**
 * The share group's own root layout, with NO providers on purpose: the reader
 * is a teacher with no Moyo session, the page is server-rendered from a
 * verified token, and mounting SessionProvider here would put an auth
 * handshake in front of a person who cannot pass one.
 */
export default function ShareLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <Document>{children}</Document>;
}
