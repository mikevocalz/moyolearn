/**
 * /faq — Frequently asked questions.
 *
 * SOT: .claude/skills/ux-copy/SKILL.md · apps/web-vite/src/copy/content-pages.ts
 * SOT-KEYWORDS: route faq page questions answers content page web-vite
 */
import { createFileRoute } from '@tanstack/react-router';
import { SitePage } from '@/components/site-page';
import { FaqAccordion } from '@/components/faq-accordion';
import { faq } from '@/copy/content-pages';

const SITE_ORIGIN = 'https://moyolearn.com';
const TITLE = 'FAQ — Moyo';
const DESCRIPTION = 'Answers to common questions about Moyo, pricing, safety, and how the AI tutor works.';

export const Route = createFileRoute('/faq')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: `${SITE_ORIGIN}/faq` }],
  }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <SitePage heading={faq.heading} lead={faq.lead}>
      <FaqAccordion items={faq.faqs} />
    </SitePage>
  );
}
