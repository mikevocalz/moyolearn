/**
 * `/` — the SSR lane spike (ADR-001). One hero, built only from kit components,
 * because the point of this route is to prove the chain, not to be the page:
 * @acme/ui → @expo/html-elements → react-native-web → real HTML, with the
 * className boundary (react-native-css) resolving during the prerender pass.
 *
 * Visual design and the chapter structure are Phase 1 and deliberately absent.
 *
 * SOT: packages/ui/index.ts (component index) · docs/site/adr-001-ssr-lane.md
 * SOT-KEYWORDS: web-vite marketing hero route index prerender ssr kit proof
 */
import { Container, Heading, Text } from '@acme/ui';
import { Main, Section } from '@acme/ui/primitives';
import { createFileRoute } from '@tanstack/react-router';

const TITLE = 'Moyo — AI tutoring that helps children learn it by heart';
const DESCRIPTION =
  'Moyo is an AI tutor for children: patient, safe, and built to turn practice into understanding that lasts.';

// The site ships to moyolearn.com. A canonical pointing anywhere else tells
// crawlers the real domain is the duplicate, so this constant is the one place
// the origin is spelled and every route composes its canonical from it.
const SITE_ORIGIN = 'https://moyolearn.com';

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: `${SITE_ORIGIN}/` },
    ],
    links: [{ rel: 'canonical', href: `${SITE_ORIGIN}/` }],
  }),
  component: MarketingHome,
});

function MarketingHome() {
  return (
    <Main className="min-h-screen bg-surface py-section">
      <Section>
        <Container width="prose" className="gap-stack">
          <Heading level={1} size="display-xl">
            AI tutoring that helps children learn it by heart
          </Heading>
          <Text variant="body" tone="muted">
            {DESCRIPTION}
          </Text>
        </Container>
      </Section>
    </Main>
  );
}
