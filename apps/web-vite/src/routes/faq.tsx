/**
 * /faq — Frequently asked questions.
 *
 * SOT: docs/site/copy-deck.md §10
 * SOT-KEYWORDS: route faq page questions answers content page web-vite
 */
import { createFileRoute } from '@tanstack/react-router';
import { List, ListItem, Paragraph } from '@acme/ui/primitives';
import { Heading, Text } from '@acme/ui/typography';
import { SitePage } from '@/components/site-page';

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

const FAQS = [
  {
    q: 'What is Moyo?',
    a: 'Moyo is an AI tutor for children. It helps learners work through their own homework by asking questions and guiding them to the answer, instead of giving it away.',
  },
  {
    q: 'How much does Moyo cost?',
    a: 'Moyo Plus is $14.99 a month for one learner. Moyo Family is $24.99 a month for up to 3 children. Each additional child after the first 3 is $11 a month.',
  },
  {
    q: 'Is Moyo safe for kids?',
    a: 'Yes. Moyo is built with guardrails, human review, no ads, and no selling of learner data. A grown-up creates the account and can see reports after every session.',
  },
  {
    q: 'Does Moyo give answers?',
    a: 'No. Natalie, the tutor, coaches the learner through the problem. The goal is for the child to understand the next step, not to copy a solution.',
  },
  {
    q: 'Can I cancel?',
    a: 'Yes. You can cancel anytime in the app. Your access continues through the current paid month. New accounts get 30 days free.',
  },
  {
    q: 'What ages is Moyo for?',
    a: 'Moyo is designed for learners in elementary through middle school. A grown-up adds each learner and sets the grade level so the tutor speaks at the right level.',
  },
] as const;

function FaqPage() {
  return (
    <SitePage heading="FAQ">
      <Paragraph className="text-site-lead text-moyo-ink">
        Common questions about Moyo. If you do not see your question, email us at{' '}
        <a href="mailto:info@moyolearn.com" className="text-moyo-primary underline">
          info@moyolearn.com
        </a>.
      </Paragraph>

      <List className="gap-group">
        {FAQS.map(({ q, a }) => (
          <ListItem key={q} className="gap-element">
            <Heading level={2} size="display-sm" className="font-moyo-text text-site-subtitle text-moyo-ink">
              {q}
            </Heading>
            <Text className="text-site-body text-moyo-ink-muted">{a}</Text>
          </ListItem>
        ))}
      </List>
    </SitePage>
  );
}
