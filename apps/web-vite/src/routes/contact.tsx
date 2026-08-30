/**
 * /contact — How to reach Moyo.
 *
 * SOT: docs/site/copy-deck.md §10
 * SOT-KEYWORDS: route contact page email support content page web-vite
 */
import { createFileRoute } from '@tanstack/react-router';
import { Paragraph } from '@acme/ui/primitives';
import { SitePage } from '@/components/site-page';

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
    <SitePage heading="Contact">
      <Paragraph className="text-site-lead text-moyo-ink">
        We read every message. If you have a question, a safety concern, or a school inquiry, write to us.
      </Paragraph>

      <Paragraph className="text-site-body text-moyo-ink">
        Email: <a href="mailto:info@moyolearn.com" className="text-moyo-primary underline">info@moyolearn.com</a>
      </Paragraph>

      <Paragraph className="text-site-body text-moyo-ink">
        For schools, tutoring businesses, or press: use the same address and it will reach the right person.
      </Paragraph>

      <Paragraph className="text-site-body text-moyo-ink">
        Moyo does not have a public phone line, but we aim to reply to every email within one business day.
      </Paragraph>
    </SitePage>
  );
}
