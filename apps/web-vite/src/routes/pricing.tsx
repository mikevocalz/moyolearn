/**
 * /pricing — Moyo's plans and the start-learning ask.
 *
 * SOT: apps/web-vite/src/components/chapters/start.tsx
 *      apps/web-vite/src/components/site-nav.tsx · apps/web-vite/src/components/site-footer.tsx
 * SOT-KEYWORDS: route pricing page web-vite
 */
import { createFileRoute } from '@tanstack/react-router';
import { coverageSentence, monthlyPriceSentence, CONSUMER_PLANS } from '@acme/auth/plan-catalog';
import { Main } from '@acme/ui/primitives';
import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';
import { StartChapter } from '@/components/chapters/start';

const SITE_ORIGIN = 'https://moyolearn.com';
const TITLE = 'Pricing — Moyo';
const DESCRIPTION = `${CONSUMER_PLANS.plus.title} is ${monthlyPriceSentence('plus')} for ${coverageSentence('plus')}, ${monthlyPriceSentence('family')} for the whole family. Start learning today.`;

export const Route = createFileRoute('/pricing')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: `${SITE_ORIGIN}/pricing` }],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <>
      <SiteNav />
      <Main role="main" className="bg-moyo-paper pb-40">
        <StartChapter />
      </Main>
      <SiteFooter />
    </>
  );
}
