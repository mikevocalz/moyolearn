/**
 * /childrens-privacy — Privacy notice for children under 13.
 *
 * SOT: .claude/skills/ux-copy/SKILL.md · apps/web-vite/src/copy/content-pages.ts
 * SOT-KEYWORDS: route childrens privacy coppa ferpa kids legal content page web-vite
 */
import { createFileRoute } from '@tanstack/react-router';
import { Paragraph } from '@acme/ui/primitives';
import { SitePage } from '@/components/site-page';
import { PageSection } from '@/components/page-section';
import { childrens } from '@/copy/content-pages';

const SITE_ORIGIN = 'https://moyolearn.com';
const TITLE = "Children's Privacy — Moyo";
const DESCRIPTION = 'How Moyo protects children under 13 and the rights parents have.';

export const Route = createFileRoute('/childrens-privacy')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: `${SITE_ORIGIN}/childrens-privacy` }],
  }),
  component: ChildrensPrivacyPage,
});

function ChildrensPrivacyPage() {
  return (
    <SitePage heading={childrens.heading} lead={childrens.lead}>
      {childrens.sections.map((section) => (
        <PageSection key={section.title} title={section.title}>
          <Paragraph className="text-site-body text-moyo-ink">{section.body}</Paragraph>
        </PageSection>
      ))}
    </SitePage>
  );
}
