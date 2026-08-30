/**
 * /terms — Moyo's terms of service.
 *
 * SOT: .claude/skills/ux-copy/SKILL.md · apps/web-vite/src/copy/content-pages.ts
 * SOT-KEYWORDS: route terms page legal terms of service content page web-vite
 */
import { createFileRoute } from '@tanstack/react-router';
import { Paragraph } from '@acme/ui/primitives';
import { SitePage } from '@/components/site-page';
import { PageSection } from '@/components/page-section';
import { terms } from '@/copy/content-pages';

const SITE_ORIGIN = 'https://moyolearn.com';
const TITLE = 'Terms — Moyo';
const DESCRIPTION = 'The rules, payments, and cancellation policy for using Moyo.';

export const Route = createFileRoute('/terms')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: `${SITE_ORIGIN}/terms` }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <SitePage heading={terms.heading} lead={terms.lead}>
      {terms.sections.map((section) => (
        <PageSection key={section.title} title={section.title}>
          <Paragraph className="text-site-body text-moyo-ink">{section.body}</Paragraph>
        </PageSection>
      ))}
    </SitePage>
  );
}
