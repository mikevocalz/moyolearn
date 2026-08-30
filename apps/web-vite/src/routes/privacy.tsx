/**
 * /privacy — Moyo's privacy policy.
 *
 * SOT: docs/site/copy-deck.md §10 · docs/pack/33 §6.8
 * SOT-KEYWORDS: route privacy page data policy legal content page web-vite
 */
import { createFileRoute } from '@tanstack/react-router';
import { Paragraph } from '@acme/ui/primitives';
import { Text } from '@acme/ui/typography';
import { SitePage } from '@/components/site-page';

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
    <SitePage heading="Privacy">
      <Paragraph className="text-site-lead text-moyo-ink">
        Your family's information is not our product. Moyo collects only what is needed to tutor your child and to keep the account secure.
      </Paragraph>

      <Paragraph className="text-site-body text-moyo-ink">
        <Text className="font-moyo-text font-semibold">What we collect.</Text> The learner's name, grade level, prompts and answers during sessions, and any photos a grown-up chooses to share for homework help. We also collect the email and payment information tied to the account.
      </Paragraph>

      <Paragraph className="text-site-body text-moyo-ink">
        <Text className="font-moyo-text font-semibold">Why we collect it.</Text> To personalize the tutor's voice and difficulty, to generate the session report, and to let grown-ups see progress. Payment information is used only for billing.
      </Paragraph>

      <Paragraph className="text-site-body text-moyo-ink">
        <Text className="font-moyo-text font-semibold">Who sees it.</Text> The learner's data is shared only with the grown-ups on the family account, the Moyo safety team when needed, and the service providers that run our infrastructure under strict contracts.
      </Paragraph>

      <Paragraph className="text-site-body text-moyo-ink">
        <Text className="font-moyo-text font-semibold">Your choices.</Text> You can cancel anytime, export your data, or ask us to delete it by emailing <a href="mailto:info@moyolearn.com" className="text-moyo-primary underline">info@moyolearn.com</a>.
      </Paragraph>
    </SitePage>
  );
}
