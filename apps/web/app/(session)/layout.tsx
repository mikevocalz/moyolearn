import type { Metadata } from 'next';
import { AudioRecorderSheet, UploadQueueProvider } from '@acme/app';

export const metadata: Metadata = {
  title: { default: 'Session — Moyo', template: '%s — Moyo' },
  description: 'A live tutoring session.',
};

/**
 * Immersive surfaces: a live session owns the whole screen.
 *
 * The document and providers come from the root layout; the chrome stays off
 * because SiteChrome's CHROMELESS_PREFIXES covers `/tutor` — a lesson is a
 * bounded place (doc 07) and these screens carry their own SessionToolbar.
 */
export default function SessionLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      {/* Mounted at the root, not in the composer. It opens a browser
          permission prompt and holds a MediaStream — both outlive any single
          render of the input, and a recorder that unmounts mid-take loses
          the take. Same reason its native twin sits in _layout. */}
      <AudioRecorderSheet />
      {/* Drains queued uploads on load and when the network returns. */}
      <UploadQueueProvider />
    </>
  );
}
