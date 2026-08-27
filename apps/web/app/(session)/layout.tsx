import type { Metadata } from 'next';
import { AppQueryProvider, SessionProvider, AudioRecorderSheet } from '@acme/app';
import { Document } from '../Document';
import '../rn-globals';
import '../globals.css';

export const metadata: Metadata = {
  title: { default: 'Session — Moyo', template: '%s — Moyo' },
  description: 'A live tutoring session.',
};

/**
 * Immersive surfaces: a live session owns the whole screen.
 *
 * `/tutor` sat in `(site)` and inherited the marketing chrome. Measured on a
 * 757px viewport that came to header 69 + conversation 388 + footer 352 — the
 * footer took 46% of the screen and the conversation got barely half. No amount
 * of `flex-1` fixes that; the space was spoken for.
 *
 * It is not only a sizing problem. A child stuck on a maths problem had
 * "Storybook", "Payload admin" and "README" sitting under their conversation —
 * links out of a session, on a children's surface, pointing at developer tools.
 * Doc 07's premise is that a learner surface is a bounded place.
 *
 * The same argument `(auth)` already makes for itself: signing in is not a
 * marketing surface, and neither is a lesson. These screens carry their own
 * `SessionToolbar` with a back button, so the site nav is redundant as well as
 * harmful.
 *
 * Providers match `(site)` exactly — a session needs the query client and the
 * auth session as much as any other screen; it is only the chrome that goes.
 */
export default function SessionLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <SessionProvider>
      <AppQueryProvider>
        <Document>
          {children}
          {/* Mounted at the root, not in the composer. It opens a browser
              permission prompt and holds a MediaStream — both outlive any single
              render of the input, and a recorder that unmounts mid-take loses
              the take. Same reason its native twin sits in _layout. */}
          <AudioRecorderSheet />
        </Document>
      </AppQueryProvider>
    </SessionProvider>
  );
}
