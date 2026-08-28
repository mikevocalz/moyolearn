/**
 * Chapter 09 · FOOTER — the desk at rest.
 *
 * The footer is where a site either confirms it was made by people who care or
 * admits it stopped caring at 80% scroll. So: a way to reach a human BEFORE the
 * sitemap, three columns and not six, a legal band visually separated from the
 * navigation, reduced motion as an available CONTROL rather than a claim on a
 * policy page — and one moment of play along the top edge that rewards noticing
 * without demanding attention.
 *
 * THE COMPLIANCE LINE IS US-ONLY. COPPA, FERPA-aligned handling, state
 * student-privacy law. `GDPR`, `EU privacy` and any EU regulation are a hard
 * never (doc 33 §6.8), and `tooling/check-copy-law.mjs` fails the build on all
 * three — the rule is enforced rather than remembered. There are no badges and
 * no seals either: "COPPA certified" would be false, because the posture is
 * compliance by design plus counsel review (doc 33 §16.6), and the Shop/Grain
 * discipline says a claim that links to the real policy beats a badge that
 * links nowhere.
 *
 * TWO ANIMATIONS, BOTH ONCE. The sticker peels on the first hover and never
 * again — `peel` is the vocabulary's only primitive that is explicitly
 * non-looping, and the brief bans looping delight outright. The mark performs
 * its book → M → heart → path signature once when it is scrolled into view,
 * drawn with `stroke-dashoffset`. Under reduced motion both simply exist in
 * their finished state: the sticker flat, the mark fully drawn.
 *
 * LOCALE-READY, NOT LOCALISED. `site.footer.locale` ("English (US)") is
 * deliberately NOT rendered: doc 16 §3 and doc 33 §9 gate a language switcher
 * behind a second locale actually shipping, and a switcher with one entry is a
 * control that lies about the product. The column it would occupy is in the
 * layout; the control is not.
 *
 * Mobbin: In Common With (lead the footer with contact, before the sitemap) ·
 * Mural (a distinct lower legal band so compliance text does not dilute the
 * navigation) · Vucko (the mark is the footer's mass; utility links are the
 * small print) · Mixpanel (a reduced-motion toggle living in the footer beside
 * the wordmark) · Opennote (the desk-at-rest play sits at the edge, not in the
 * columns) · Swap (the play is a strip along one edge, so it never interrupts
 * the link columns). Refused: Employment Hero's and Mural's thirty-to-forty
 * link walls, and Robot.com's low-contrast legal links. Full set:
 * docs/site/mobbin/footer.md.
 *
 * SOT: docs/site/copy-deck.md §10 (every string) · docs/site/research.md §4.9 ·
 *      docs/site/tokens.md · docs/site/motion-matrix.md · apps/web-vite/src/stores/perf-store.ts
 * SOT-KEYWORDS: site footer sitemap compliance coppa ferpa contact reduce motion
 *               toggle desk clutter sticker peel mark signature draw web-vite
 */
import { Container, Text } from '@acme/ui/typography';
import {
  Button,
  Footer,
  Link,
  List,
  ListItem,
  Nav,
  Paragraph,
  View,
  useHydrated,
} from '@acme/ui/primitives';
import { usePerfStore } from '@/stores/perf-store';
import { useMotionScene } from '@/motion';
import type { MotionScene } from '@/motion';

/*
  Trust and company destinations are absolute. Those routes do not exist yet,
  and TanStack Start's prerender crawls every href beginning with `/` or `./`
  and fails the build on a 404 (start-plugin-core/prerender.js:43, :81 —
  verified against a probe route). An absolute URL is skipped by the crawler and
  stays the right destination once the pages ship, which is what keeps the
  compliance claims checkable instead of decorative. `/login` and `/signup` are
  FD-02 and FD-03 in doc 38's route table, not paths invented here.
*/
const SITE_ORIGIN = 'https://moyolearn.com';

const SCOPE = '.site-footer';

/** The real contact address, supplied by Mike. Chapter 07's "Talk to us" lands here. */
const SUPPORT_EMAIL = 'mikeallen@moyolearn.com';

/**
 * Three columns, not six. Past roughly four a footer sitemap stops being
 * navigable and becomes a wall — the volume this pass refused in Employment
 * Hero and Mural — and Moyo's audience split needs fewer, clearer doors.
 *
 * The Product column is in-page: those chapters are on this document. The
 * anchors match the `id` each chapter section carries; `#how-it-works` is
 * chapter 03's, which is another lane's section.
 */
const COLUMNS = [
  {
    heading: 'Product',
    links: [
      { label: 'How it works', href: '#how-it-works' },
      { label: 'For parents', href: '#for-parents' },
      { label: 'For schools', href: '#for-schools' },
      { label: 'Pricing', href: '#start' },
    ],
  },
  {
    heading: 'Trust',
    links: [
      { label: 'Safety', href: `${SITE_ORIGIN}/safety` },
      { label: 'Privacy', href: `${SITE_ORIGIN}/privacy` },
      { label: 'Children’s privacy', href: `${SITE_ORIGIN}/childrens-privacy` },
      { label: 'Terms', href: `${SITE_ORIGIN}/terms` },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: `${SITE_ORIGIN}/about` },
      { label: 'Contact', href: `${SITE_ORIGIN}/contact` },
      { label: 'Log in', href: `${SITE_ORIGIN}/login` },
    ],
  },
] as const;

const RULE = 'border-moyo-hair border-transparent border-t-moyo-outline';

export function SiteFooter() {
  /*
    The hydration law, and the one place in these chapters that has to touch it.
    The server has no motion preference — it renders one document for every
    reader — so a first client render that already knew the answer is a text
    mismatch (React #418). `useHydrated` reports false until after hydration, so
    the first paint matches the server byte for byte and the real state arrives
    a tick later as an ordinary store update. The toggle writes through the same
    public setter the OS media-query listener uses; there is no footer-only
    bypass, or the control would not be the thing being audited.
  */
  const hydrated = useHydrated();
  const reducedMotion = usePerfStore((state) => state.reducedMotion) && hydrated;
  const setReducedMotion = usePerfStore((state) => state.setReducedMotion);

  useMotionScene(SCOPE, buildScene);

  return (
    <Footer className="site-footer bg-moyo-paper-sunken">
      {/*
        The desk at rest. A strip along the top edge rather than a panel among
        the columns (Swap), so the play never competes with the navigation —
        and it is decorative, so it leaves the accessibility tree entirely.
        Sizes here are object geometry, not spacing tiers: there is no token for
        "as long as a pencil", the same reason the motion lane names its scroll
        thresholds in code rather than in the theme.
      */}
      <View
        aria-hidden
        className={`${RULE} flex-row flex-wrap items-end gap-group px-6 py-inset`}
      >
        <View className="h-2 w-28 bg-moyo-earth" />
        <View className="h-4 w-10 bg-moyo-paper-raised border-moyo-hair border-moyo-outline" />
        <View className="footer-sticker border-moyo-hair size-10 border-moyo-outline bg-moyo-sun" />
        <View className="h-6 w-6 border-moyo-hair rounded-moyo-card border-moyo-outline" />
        <View className="h-1 w-16 bg-moyo-ink-muted" />
      </View>

      <Container width="wide" className="gap-section py-section">
        {/*
          In Common With: the way to reach a human comes first, above the
          sitemap. It costs nothing and it is the whole difference between a
          footer and a filing cabinet.
        */}
        <View id="talk-to-a-person" className="gap-stack">
          <Text variant="label" className="text-site-label text-moyo-secondary">
            Talk to a person
          </Text>
          {/*
            A real address, so a real mailto: a contact line you have to retype
            is friction on the one block that exists to be contacted. Outlined
            rather than filled because this screen's single highlighter accent
            is spent on the sticker — the slab now frames something that works
            instead of marking an unresolved token.
          */}
          <Link
            href={`mailto:${SUPPORT_EMAIL}`}
            className="border-moyo-rule self-start rounded-moyo-square border-moyo-outline bg-moyo-paper-raised px-inset-tight py-inset-field text-site-subtitle md:text-site-subtitle text-moyo-ink"
          >
            {SUPPORT_EMAIL}
          </Link>
        </View>

        <Nav className={`${RULE} flex-col gap-section pt-section md:flex-row`}>
          {COLUMNS.map((column) => (
            <View key={column.heading} className="gap-stack md:flex-1">
              <Text variant="label" className="text-site-label text-moyo-secondary">
                {column.heading}
              </Text>
              <List className="gap-stack">
                {column.links.map((link) => (
                  <ListItem key={link.label}>
                    <Link href={link.href} className="text-site-body text-moyo-ink">
                      {link.label}
                    </Link>
                  </ListItem>
                ))}
              </List>
            </View>
          ))}
        </Nav>

        {/*
          Mural's separated legal band. Full contrast, never the faintest type:
          `moyoInkMuted` on `moyoPaperSunken` is 6.32:1, and privacy and consent
          are the two things a reader most often needs under stress.
        */}
        <View className={`${RULE} gap-stack pt-section`}>
          <Paragraph className="max-w-content-prose text-site-body text-moyo-ink-muted">
            Moyo is built for families and schools in the United States. Children&rsquo;s
            privacy follows COPPA, school data is handled on a FERPA-aligned basis, and
            state student-privacy requirements apply.
          </Paragraph>
          <Paragraph className="max-w-content-prose text-site-body text-moyo-ink-muted">
            A parent or guardian creates every learner account and gives consent before a
            child uses Moyo.
          </Paragraph>
          <Paragraph className="max-w-content-prose text-site-body text-moyo-ink">
            No ads. No data sold. Not now, not later.
          </Paragraph>
        </View>

        {/*
          Vucko's lower half: the mark carries the footer's mass and the utility
          links share its baseline. The reduced-motion control sits here beside
          the wordmark (Mixpanel) — an accessibility preference is a control the
          reader can reach, not a sentence on a policy page.
        */}
        <View className={`${RULE} flex-col gap-group pt-section md:flex-row md:items-end`}>
          <View className="gap-stack md:flex-1">
            <MarkSignature />
            <Text className="font-moyo-display text-site-chapter md:text-site-chapter text-moyo-ink">Moyo AI</Text>
            <Text className="font-moyo-serif text-site-quote md:text-site-quote text-moyo-ink">
              Learn it by heart.
            </Text>
          </View>
          <View className="gap-stack">
            <Button
              className="moyo-pressable border-moyo-rule self-start rounded-moyo-square border-moyo-outline bg-moyo-paper-raised px-inset-roomy py-inset text-site-body text-moyo-ink"
              onPress={() => setReducedMotion(!reducedMotion)}
              aria-pressed={reducedMotion}
            >
              Reduce motion
            </Button>
            <Text className="text-site-body md:text-site-body text-moyo-ink-muted">
              {`© ${new Date().getFullYear()} Moyo AI.`}
            </Text>
          </View>
        </View>
      </Container>
    </Footer>
  );
}

/**
 * The mark's signature: book → M → heart → path, performed once.
 *
 * Four strokes on one canvas, drawn in sequence by `stroke-dashoffset` rather
 * than morphed — the vocabulary has `draw` and does not have a morph, and
 * adding one would be a fourteenth personality nobody has a reason for. Read in
 * order the four shapes are the product's own sentence: a book becomes the
 * mark, the mark is a heart, the heart is a path forward.
 *
 * A raw `<svg>` because `draw` is defined by `getTotalLength()`, which only a
 * real SVGGeometryElement has, and the kit ships no SVG primitive on this
 * surface (the same reason `/motion-lab` draws its underline this way). The
 * viewBox numbers are geometry. `aria-hidden` because the wordmark beside it
 * carries the name — the mark is not a second, silent copy of it.
 */
function MarkSignature() {
  return (
    <svg width="180" height="52" viewBox="0 0 180 52" aria-hidden="true">
      <g fill="none" stroke="var(--color-moyo-ink)" strokeWidth="3" strokeLinecap="round">
        {/* book — two pages meeting at a spine */}
        <path className="footer-mark" d="M4 38 C 4 24, 22 24, 30 30 C 38 24, 56 24, 56 38 C 48 32, 12 32, 4 38 Z" />
        {/* M */}
        <path className="footer-mark" d="M70 40 L 76 16 L 86 30 L 96 16 L 102 40" />
        {/* heart */}
        <path className="footer-mark" d="M132 40 C 116 30, 112 22, 118 17 C 124 12, 132 18, 132 22 C 132 18, 140 12, 146 17 C 152 22, 148 30, 132 40 Z" />
        {/* path */}
        <path className="footer-mark" d="M158 42 C 166 30, 158 22, 166 14 C 170 10, 174 10, 176 12" />
      </g>
    </svg>
  );
}

/**
 * Two scenes, and nothing else in the footer moves.
 *
 * The sticker is bound to `pointerenter` and guarded by a flag rather than by
 * `once` on a ScrollTrigger, because this one is a hover: the guard is what
 * makes "peels once, never loops" true across a reader who hovers it twenty
 * times. Under reduced motion `compose` has already written the sticker's rest
 * state and returns an empty timeline, so `play()` is inert by construction —
 * there is no branch here that has to remember the preference.
 */
function buildScene({ motion, scope }: MotionScene): () => void {
  motion.draw({ targets: '.footer-mark', stagger: 0.14, scroll: { once: true } });

  const peel = motion.peel({ targets: '.footer-sticker', paused: true });
  const sticker = scope.querySelector('.footer-sticker');
  let peeled = false;
  const onEnter = (): void => {
    if (peeled) return;
    peeled = true;
    peel.play();
  };
  sticker?.addEventListener('pointerenter', onEnter);

  return () => sticker?.removeEventListener('pointerenter', onEnter);
}
