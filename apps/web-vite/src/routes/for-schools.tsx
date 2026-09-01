/**
 * /for-schools — Moyo's school and tutoring business operations cloud.
 *
 * SOT: apps/web-vite/src/components/chapters/schools.tsx
 *      apps/web-vite/src/components/site-nav.tsx · apps/web-vite/src/components/site-footer.tsx
 * SOT-KEYWORDS: route for schools page web-vite
 */
import { createFileRoute } from '@tanstack/react-router';
import { Main } from '@acme/ui/primitives';
import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';
import { SchoolsChapter } from '@/components/chapters/schools';

const SITE_ORIGIN = 'https://moyolearn.com';
const TITLE = 'For schools — Moyo';
const DESCRIPTION =
  'Moyo runs the business underneath the tutoring: CRM, scheduling, payroll, org administration, with learning records kept separate.';

export const Route = createFileRoute('/for-schools')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: `${SITE_ORIGIN}/for-schools` }],
  }),
  component: ForSchoolsPage,
});

function ForSchoolsPage() {
  return (
    <>
      <SiteNav />
      <Main role="main" className="bg-moyo-paper pb-40">
        <SchoolsChapter />
      </Main>
      <SiteFooter />
    </>
  );
}
