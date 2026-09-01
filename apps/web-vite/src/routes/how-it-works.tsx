/**
 * /how-it-works — Moyo's conversation and teaching approach.
 *
 * SOT: apps/web-vite/src/components/chapters/conversation.tsx
 *      apps/web-vite/src/components/site-nav.tsx · apps/web-vite/src/components/site-footer.tsx
 * SOT-KEYWORDS: route how it works conversation page web-vite
 */
import { createFileRoute } from '@tanstack/react-router';
import { Main } from '@acme/ui/primitives';
import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';
import { Conversation } from '@/components/chapters/conversation';

const SITE_ORIGIN = 'https://moyolearn.com';
const TITLE = 'How it works — Moyo';
const DESCRIPTION =
  'Moyo never just gives the answer. It teaches the next step, so learners understand the work instead of copying it.';

export const Route = createFileRoute('/how-it-works')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: `${SITE_ORIGIN}/how-it-works` }],
  }),
  component: HowItWorksPage,
});

function HowItWorksPage() {
  return (
    <>
      <SiteNav />
      <Main role="main" className="bg-moyo-paper pb-40">
        <Conversation />
      </Main>
      <SiteFooter />
    </>
  );
}
