/**
 * /terms — Moyo's terms of service.
 *
 * SOT: docs/site/copy-deck.md §10
 * SOT-KEYWORDS: route terms page legal terms of service content page web-vite
 */
import { createFileRoute } from '@tanstack/react-router';
import { Paragraph } from '@acme/ui/primitives';
import { Text } from '@acme/ui/typography';
import { SitePage } from '@/components/site-page';

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
    <SitePage heading="Terms">
      <Paragraph className="text-site-lead text-moyo-ink">
        By using Moyo, you agree to these terms. We have written them in plain language so you actually know what you are agreeing to.
      </Paragraph>

      <Paragraph className="text-site-body text-moyo-ink">
        <Text className="font-moyo-text font-semibold">Accounts.</Text> Moyo accounts are for families and their learners. You must be 18 or older to create an account and add a learner.
      </Paragraph>

      <Paragraph className="text-site-body text-moyo-ink">
        <Text className="font-moyo-text font-semibold">Payments and trials.</Text> New subscriptions start with a 30-day free trial. After that, the plan you chose renews monthly. You can cancel anytime in the app; your access continues through the paid period.
      </Paragraph>

      <Paragraph className="text-site-body text-moyo-ink">
        <Text className="font-moyo-text font-semibold">Acceptable use.</Text> Moyo is a learning tool. Do not use it to generate harmful content, impersonate others, or attempt to bypass the safety guardrails.
      </Paragraph>

      <Paragraph className="text-site-body text-moyo-ink">
        <Text className="font-moyo-text font-semibold">Changes.</Text> If we change these terms or our pricing, we will email you and give you a chance to cancel before the change takes effect.
      </Paragraph>
    </SitePage>
  );
}
