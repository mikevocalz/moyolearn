/**
 * /childrens-privacy — Privacy notice for children under 13.
 *
 * SOT: docs/site/copy-deck.md §10 · docs/pack/33 §6.8
 * SOT-KEYWORDS: route childrens privacy coppa ferpa kids legal content page web-vite
 */
import { createFileRoute } from '@tanstack/react-router';
import { Paragraph } from '@acme/ui/primitives';
import { Text } from '@acme/ui/typography';
import { SitePage } from '@/components/site-page';

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
    <SitePage heading="Children's Privacy">
      <Paragraph className="text-site-lead text-moyo-ink">
        Moyo is designed for learners, and that changes how we treat information. We follow COPPA, FERPA-aligned practices, and common-sense rules: collect less, keep it safe, and give parents control.
      </Paragraph>

      <Paragraph className="text-site-body text-moyo-ink">
        <Text className="font-moyo-text font-semibold">Parental consent.</Text> A grown-up must create the account and add learners. We do not knowingly allow a child under 13 to sign up alone.
      </Paragraph>

      <Paragraph className="text-site-body text-moyo-ink">
        <Text className="font-moyo-text font-semibold">No advertising.</Text> We do not show ads to children or target them with marketing. We do not sell a child's data to anyone.
      </Paragraph>

      <Paragraph className="text-site-body text-moyo-ink">
        <Text className="font-moyo-text font-semibold">Parent rights.</Text> Parents can review a learner's sessions, delete the learner's data, or cancel the account at any time. To request deletion or a copy of your data, email <a href="mailto:info@moyolearn.com" className="text-moyo-primary underline">info@moyolearn.com</a>.
      </Paragraph>
    </SitePage>
  );
}
