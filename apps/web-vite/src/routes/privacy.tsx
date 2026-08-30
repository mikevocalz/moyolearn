/**
 * /privacy — Moyo's privacy policy.
 *
 * SOT: .claude/skills/ux-copy/SKILL.md · apps/web-vite/src/copy/content-pages.ts
 * SOT-KEYWORDS: route privacy page data policy legal content page web-vite
 */
import { createFileRoute } from '@tanstack/react-router';
import { Paragraph } from '@acme/ui/primitives';
import { SitePage } from '@/components/site-page';
import { PageSection } from '@/components/page-section';
import { privacy } from '@/copy/content-pages';

const SITE_ORIGIN = 'https://moyolearn.com';
const TITLE = 'Privacy — Moyo';
const DESCRIPTION = 'What Moyo collects, why we collect it, and the choices you have.';

export const Route = createFileRoute('/privacy')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: `${SITE_ORIGIN}/privacy` }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <SitePage heading={privacy.heading} lead={privacy.lead}>
      {privacy.sections.map((section) => (
        <PageSection key={section.title} title={section.title}>
          <Paragraph className="text-site-body text-moyo-ink">{section.body}</Paragraph>
        </PageSection>
      ))}
    </SitePage>
  );
}
