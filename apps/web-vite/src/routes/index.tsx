/**
 * `/` — the hero, and the end-to-end proof of the site token layer.
 *
 * Two jobs, both deliberate:
 *
 * 1. It still proves the SSR chain of ADR-001 — @acme/ui →
 *    @expo/html-elements → react-native-web → real HTML, with the className
 *    boundary (react-native-css) resolving during the prerender pass.
 * 2. It now proves the §5.1/§5.2 layer reaches the page: the ground is
 *    `moyoPaper` (not `bg-surface`, which followed the reader's OS theme and
 *    inverted the whole design language on a dark-mode machine), the display
 *    face is Clash Display through `font-moyo-display`, and the size comes from
 *    the fluid `text-site-hero` step rather than the product's fixed ramp.
 *
 * Still ONE hero. Chapters, motion and the globe are other agents' work and are
 * deliberately absent — a second section here would be a merge conflict, not a
 * design.
 *
 * SOT: packages/ui/index.ts (component index) · docs/site/tokens.md
 *      docs/site/adr-001-ssr-lane.md
 * SOT-KEYWORDS: web-vite marketing hero route index prerender ssr kit proof
 *               moyo-paper site-hero clash-display tokens
 */
import { Container, Heading, Text } from '@acme/ui';
import { Main, Section, View } from '@acme/ui/primitives';
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
    <Main className="min-h-screen bg-moyo-paper py-section">
      <Section>
        <Container width="wide" className="gap-group">
          <Text variant="label" className="text-site-label text-moyo-secondary">
            Moyo · n. heart
          </Text>
          {/*
            `md:text-site-hero` is not a typo and not belt-and-braces. Heading's
            `size` variant steps up at md (`text-display-xl md:text-display-2xl`),
            and tailwind-merge only lets a class beat another in the SAME
            modifier group — so overriding the base step alone would leave the
            product's fixed 72px winning from 768px up, which is precisely where
            a fluid hero is supposed to be at its most dramatic. Restating it in
            the md group removes that one. The site-local `MoyoDisplay` in the
            component inventory closes this seam properly; this route documents
            it rather than hiding it.
          */}
          <Heading
            level={1}
            size="display-xl"
            className="font-moyo-display text-site-hero md:text-site-hero"
          >
            AI tutoring that helps children learn it by heart
          </Heading>
          {/*
            The lead sits in a framed slab: 3px outline, square corners, and a
            hard offset shadow with zero blur. One element, and it exercises the
            whole shape half of the layer — border width, radius law, offset
            elevation — so a regression in any of the three is visible on the
            one page that exists.
          */}
          <View className="border-moyo-rule max-w-content-prose rounded-moyo-square border-moyo-outline bg-moyo-paper-raised p-inset-roomy shadow-moyo-2">
            <Text variant="body" className="text-site-lead">
              {DESCRIPTION}
            </Text>
          </View>
        </Container>
      </Section>
    </Main>
  );
}
