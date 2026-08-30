/**
 * /safety — Moyo's child-safety posture.
 *
 * SOT: docs/site/copy-deck.md §10 · docs/pack/07-security-child-ai-safety-spec.md
 * SOT-KEYWORDS: route safety page child guardrails ai content page web-vite
 */
import { createFileRoute } from '@tanstack/react-router';
import { Paragraph } from '@acme/ui/primitives';
import { Text } from '@acme/ui/typography';
import { SitePage } from '@/components/site-page';

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
    <SitePage heading="Safety">
      <Paragraph className="text-site-lead text-moyo-ink">
        Moyo is built for children. Every design choice starts with the question: is this safe for a learner?
      </Paragraph>

      <Paragraph className="text-site-body text-moyo-ink">
        <Text className="font-moyo-text font-semibold">AI guardrails.</Text> Natalie, the tutor, is instructed to coach rather than answer, to stay grade-level, and to surface anything concerning to the grown-up on the account.
      </Paragraph>

      <Paragraph className="text-site-body text-moyo-ink">
        <Text className="font-moyo-text font-semibold">Human review.</Text> Safety incidents and edge cases are reviewed by a human team. We do not train our models on a child's sessions without explicit consent.
      </Paragraph>

      <Paragraph className="text-site-body text-moyo-ink">
        <Text className="font-moyo-text font-semibold">No ads. No selling data.</Text> Moyo has no advertising and no data brokers. A learner's sessions, mistakes, and progress are never for sale.
      </Paragraph>

      <Paragraph className="text-site-body text-moyo-ink">
        If something does not feel right, email us at <a href="mailto:info@moyolearn.com" className="text-moyo-primary underline">info@moyolearn.com</a> and a real person will read it.
      </Paragraph>
    </SitePage>
  );
}
