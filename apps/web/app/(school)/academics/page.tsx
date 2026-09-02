import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { InstitutionPlaceholderScreen } from '@acme/app';
import { readInstitutionOverview } from '@acme/app/server';
import { auth } from '../../../lib/auth';
import { loadOrgBranding } from '../../../lib/org.repository';

/*
  `/academics` is NOT a rail destination — nav.ts pulled it (ADR-103), so every
  arrival here is a typed URL or an old link. That is exactly the case the
  school.academics contract writes its two rules for, and this page held
  neither.

  1. PERMISSION → SILENT NOT-FOUND. `loadInstitutionOverview` threw on every
     refusal, so the (school) group's error.tsx answered with "Something broke
     on our end" and a reference id — a 500 body for a working gate, and a
     confirmation to a stranger that the route exists. `readInstitutionOverview`
     classifies instead, and `denied` becomes `notFound()`: the contract's
     "role-mismatched deep link → sys.not-found silent redirect", verbatim.

  2. UNAVAILABLE IS NOT DENIED. A read that could not complete resolves to the
     placeholder without the school's name, never to a 403-shaped answer and
     never to the error boundary. The screen still renders, still carries its
     exit, and does not claim to know whose school this is.
*/
export const metadata: Metadata = {
  title: 'Academics — Moyo',
  description: 'School academics.',
};

export default async function SchoolAcademicsPage() {
  const h = await headers();
  const org = await readInstitutionOverview(
    loadOrgBranding,
    { scope: 'school', resource: 'programs' },
    auth,
    h,
  );

  if (org.state === 'denied') {
    notFound();
  }

  return (
    <InstitutionPlaceholderScreen
      title="Academics"
      description="Subjects and programs for your school will live here."
      org={org}
      // school.home — the school_admin rail puts Overview on '/' (nav.ts).
      homeHref="/"
      homeLabel="Back to your school"
    />
  );
}
