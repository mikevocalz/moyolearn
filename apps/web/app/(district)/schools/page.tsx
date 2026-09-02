import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { readDistrictSchools, readInstitutionOverview } from '@acme/app/server';
import { auth } from '../../../lib/auth';
import { loadOrgBranding, loadSchools } from '../../../lib/org.repository';
import { SchoolsView } from './schools-view';

/*
  The district rail's Schools destination, which is REACHED — unlike
  /academics, this item is live in `NAV_BY_ROLE.district_admin`, so the page a
  district admin lands on when the read refuses is a page they got to by
  clicking. It answered with the (district) group's "Something broke on our
  end" error card, reference id and all, because both loaders threw.

  Both reads are classified now, and the two outcomes are answered
  differently on purpose:

  · denied  → notFound(). The contract's permission path is "role-mismatched
              deep link → sys.not-found silent redirect". A 403 body would tell
              a stranger the district exists, which is the oracle the whole
              host-tenant gate is built to refuse.
  · anything else → the screen renders its own unavailable state. A district
              admin whose roster did not load must not be shown an empty
              directory: "no schools" is a claim about their district, and we
              did not read one.

  The roster's own outcome governs. The branding read is a NAME — nice to
  have, never the reason a page fails — so a branding failure beside a good
  roster renders the list under the plain "Schools" title rather than the
  error state; only a denial on either read is a denial of the page.
*/
export const metadata: Metadata = {
  title: 'Schools — Moyo',
  description: 'Schools in this district.',
};

export default async function DistrictSchoolsPage() {
  const h = await headers();
  const [org, schools] = await Promise.all([
    readInstitutionOverview(loadOrgBranding, { scope: 'district', resource: 'schools' }, auth, h),
    readDistrictSchools(loadSchools, auth, h),
  ]);

  if (org.state === 'denied' || schools.state === 'denied') {
    notFound();
  }

  return <SchoolsView schools={schools} org={org.state === 'ok' ? org.data : null} />;
}
