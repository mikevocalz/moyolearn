/**
 * /about — What Moyo is and why it exists.
 *
 * SOT: docs/site/copy-deck.md §10
 * SOT-KEYWORDS: route about page mission team content page web-vite
 */
import { createFileRoute } from '@tanstack/react-router';
import { Paragraph } from '@acme/ui/primitives';
import { SitePage } from '@/components/site-page';

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
    <SitePage heading="About Moyo">
      <Paragraph className="text-site-lead text-moyo-ink">
        Moyo is an AI tutor for children: patient, safe, and built to turn practice into understanding that lasts.
      </Paragraph>

      <Paragraph className="text-site-body text-moyo-ink">
        Most homework tools hand out answers. Moyo does not. Natalie, the tutor, asks questions, points out what a learner already knows, and guides them to the next step. A parent gets a real report after every session, not a score.
      </Paragraph>

      <Paragraph className="text-site-body text-moyo-ink">
        We started Moyo because a child should not need a parent who can tutor every subject. The product is designed for the dinner-table moment: the learner is stuck, the grown-up is busy, and someone still needs to explain it well.
      </Paragraph>

      <Paragraph className="text-site-body text-moyo-ink">
        Moyo is made by a small team of teachers, engineers, and parents in New York.
      </Paragraph>
    </SitePage>
  );
}
