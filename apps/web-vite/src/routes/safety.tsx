/**
 * /safety — Moyo's child-safety posture.
 *
 * SOT: .claude/skills/ux-copy/SKILL.md · apps/web-vite/src/copy/content-pages.ts
 * SOT-KEYWORDS: route safety page child guardrails ai content page web-vite
 */
import { createFileRoute } from '@tanstack/react-router';
import { Paragraph } from '@acme/ui/primitives';
import { SitePage } from '@/components/site-page';
import { PageSection } from '@/components/page-section';
import { safety } from '@/copy/content-pages';

const SITE_ORIGIN = 'https://moyolearn.com';
const TITLE = 'Safety — Moyo';
const DESCRIPTION = 'How Moyo keeps learners safe: guardrails, human review, and a product that never sells or advertises to children.';

export const Route = createFileRoute('/safety')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: `${SITE_ORIGIN}/safety` }],
  }),
  component: SafetyPage,
});

function SafetyPage() {
  return (
    <SitePage heading={safety.heading} lead={safety.lead}>
      {safety.sections.map((section) => (
        <PageSection key={section.title} title={section.title}>
          <Paragraph className="text-site-body text-moyo-ink">{section.body}</Paragraph>
        </PageSection>
      ))}
    </SitePage>
  );
}
