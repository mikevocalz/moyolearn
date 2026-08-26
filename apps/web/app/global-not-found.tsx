'use client';
// The 404 users ACTUALLY hit.
//
// `(site)/not-found.tsx` only fires for a notFound() thrown inside that route
// group. A URL matching no route at all has no group to fall into, and with a
// root layout per group there is no shared root for `app/not-found.tsx` to
// render in — so Next served its own black default page instead of ours.
// `global-not-found` is the one file that owns unmatched URLs; it renders the
// whole document itself, which is why it imports Document and the stylesheet
// rather than inheriting them.
// Requires `experimental.globalNotFound` in next.config.ts (still flagged in
// Next 16.3.1) — without the flag this file is silently ignored.
// SOT: docs/pack/08-visual-hierarchy-spacing-spec.md §3.2
// SOT-KEYWORDS: 404 not-found global unmatched route error page next
import { ErrorScreen } from '@acme/app';
import { Document } from './Document';
import './rn-globals';
import './globals.css';

export default function GlobalNotFound() {
  return (
    <Document>
      <ErrorScreen kind="not-found" />
    </Document>
  );
}
