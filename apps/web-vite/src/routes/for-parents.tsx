/**
 * /for-parents — Moyo's parent report, controls, and trust claims.
 *
 * SOT: apps/web-vite/src/components/chapters/parents.tsx
 *      apps/web-vite/src/components/site-nav.tsx · apps/web-vite/src/components/site-footer.tsx
 * SOT-KEYWORDS: route for parents page web-vite
 */
import { createFileRoute } from '@tanstack/react-router';
import { Main } from '@acme/ui/primitives';
import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';
import { ParentsChapter } from '@/components/chapters/parents';

const SITE_ORIGIN = 'https://moyolearn.com';
const TITLE = 'For parents — Moyo';
const DESCRIPTION =
  'Moyo writes parents a short, honest note after every session: what their child worked on, what they answered, and one thing to try at home.';

export const Route = createFileRoute('/for-parents')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: `${SITE_ORIGIN}/for-parents` }],
  }),
  component: ForParentsPage,
});

function ForParentsPage() {
  return (
    <>
      <SiteNav />
      <Main role="main" className="bg-moyo-paper pb-40">
        <ParentsChapter />
      </Main>
      <SiteFooter />
    </>
  );
}
