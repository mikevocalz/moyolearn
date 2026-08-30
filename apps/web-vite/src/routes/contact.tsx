/**
 * /contact — How to reach Moyo.
 *
 * SOT: .claude/skills/ux-copy/SKILL.md · apps/web-vite/src/copy/content-pages.ts
 * SOT-KEYWORDS: route contact page email support content page web-vite
 */
import { createFileRoute } from '@tanstack/react-router';
import { Link, Paragraph } from '@acme/ui/primitives';
import { SitePage } from '@/components/site-page';
import { PageSection } from '@/components/page-section';
import { contact, EMAIL } from '@/copy/content-pages';

const SITE_ORIGIN = 'https://moyolearn.com';
const TITLE = 'Contact — Moyo';
const DESCRIPTION = 'Get in touch with Moyo for questions, support, or school and business inquiries.';

export const Route = createFileRoute('/contact')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: `${SITE_ORIGIN}/contact` }],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <SitePage heading={contact.heading} lead={contact.lead}>
      {contact.sections.map((section) => (
        <PageSection key={section.title} title={section.title}>
          {section.title === 'Email' ? (
            <Paragraph className="text-site-body text-moyo-ink">
              The best way to reach us is <Link href={`mailto:${EMAIL}`} className="text-moyo-primary underline">{EMAIL}</Link>. A real person reads every message.
            </Paragraph>
          ) : (
            <Paragraph className="text-site-body text-moyo-ink">{section.body}</Paragraph>
          )}
        </PageSection>
      ))}
    </SitePage>
  );
}
