/**
 * `/` — the landing page. Nine chapters in one scroll.
 *
 * This file composes and does nothing else. Every chapter owns its own copy,
 * layout, motion and anchor id; this route decides only the ORDER and the
 * document-level concerns (title, description, canonical, OG), because that is
 * the one thing no chapter can decide for itself.
 *
 * The order is the emotional arc, not an arbitrary stack:
 * curiosity (hero) → connection (desk) → conversation (how it tutors) →
 * discovery (the globe) → the tutor herself → the parent's case →
 * the institution's case → the ask → rest.
 *
 * ANCHOR CONTRACT — the nav and the footer link to these, and a chapter that
 * renders under a different id breaks a link silently rather than loudly:
 *   #hero · #desk · #conversation · #for-parents · #for-schools · #start
 *
 * Chapters render <Section>; SiteNav renders <Header>; SiteFooter renders
 * <Footer role="contentinfo">. Only this file renders <Main>, so the landmarks
 * nest correctly and a screen reader gets one main region.
 *
 * SOT: docs/site/copy-deck.md · docs/site/tokens.md · docs/site/adr-001-ssr-lane.md
 * SOT-KEYWORDS: web-vite marketing landing route index compose chapters anchors prerender ssr
 */
import { createFileRoute } from '@tanstack/react-router';
import { Main } from '@acme/ui/primitives';

import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';
import { Hero } from '@/components/chapters/hero';
import { Desk } from '@/components/chapters/desk';
import { WorldChapter } from '@/components/chapters/world';
import { TutorRoomChapter } from '@/components/chapters/tutor-room';

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
    <>
      <SiteNav />
      <Main role="main" className="bg-moyo-paper pb-40">
        <Hero />
        <Desk />
        <WorldChapter />
        <TutorRoomChapter />
      </Main>
      <SiteFooter />
    </>
  );
}
