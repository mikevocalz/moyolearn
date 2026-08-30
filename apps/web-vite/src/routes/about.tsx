/**
 * /about — What Moyo is and why it exists.
 *
 * SOT: .claude/skills/ux-copy/SKILL.md · apps/web-vite/src/copy/content-pages.ts
 * SOT-KEYWORDS: route about page mission team content page web-vite
 */
import { createFileRoute } from '@tanstack/react-router';
import { List, ListItem, Paragraph } from '@acme/ui/primitives';
import { Text } from '@acme/ui/typography';
import { SitePage } from '@/components/site-page';
import { PageSection } from '@/components/page-section';
import { about } from '@/copy/content-pages';

const SITE_ORIGIN = 'https://moyolearn.com';
const TITLE = 'About — Moyo';
const DESCRIPTION = 'Moyo is an AI tutor built to help children actually understand their schoolwork.';

export const Route = createFileRoute('/about')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: `${SITE_ORIGIN}/about` }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <SitePage heading={about.heading} lead={about.lead}>
      {about.sections.map((section) => (
        <PageSection key={section.title} title={section.title}>
          <Paragraph className="text-site-body text-moyo-ink">{section.body}</Paragraph>
        </PageSection>
      ))}

      <PageSection title="What we believe">
        <List className="gap-element">
          {about.beliefs.map((belief) => (
            <ListItem key={belief} className="py-inset-tight">
              <Text className="text-site-body text-moyo-ink">{belief}</Text>
            </ListItem>
          ))}
        </List>
      </PageSection>
    </SitePage>
  );
}
