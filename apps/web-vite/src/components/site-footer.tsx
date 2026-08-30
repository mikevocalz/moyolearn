/**
 * Chapter 09 · FOOTER — a clear close to the page.
 *
 * The hierarchy is intentionally short: brand and human contact first,
 * navigation second, compliance and reader controls last. Each group has one
 * job, and the legal copy is separated without being faded into illegibility.
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
 * LOCALE-READY, NOT LOCALISED. `site.footer.locale` ("English (US)") is
 * deliberately NOT rendered: doc 16 §3 and doc 33 §9 gate a language switcher
 * behind a second locale actually shipping, and a switcher with one entry is a
 * control that lies about the product. The column it would occupy is in the
 * layout; the control is not.
 *
 * Mobbin: In Common With (human contact before the sitemap) · Mural (a distinct
 * lower legal band) · Vucko (the brand carries the footer's mass) · Mixpanel
 * (reduced-motion control beside utility copy). Full set:
 * docs/site/mobbin/footer.md.
 *
 * SOT: docs/site/copy-deck.md §10 (every string) · docs/site/research.md §4.9 ·
 *      docs/site/tokens.md · docs/site/motion-matrix.md · apps/web-vite/src/stores/perf-store.ts
 * SOT-KEYWORDS: site footer sitemap compliance coppa ferpa contact reduce motion
 *               toggle brand logo web-vite
 */
import { MoyoLearnLogo } from '@acme/ui/brand';
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

  return (
    <Footer className={`site-footer ${RULE} bg-moyo-paper-sunken`}>
      <Container width="wide" className="gap-section py-section">
        <View className="flex-col gap-section lg:flex-row lg:gap-section">
          {/* Brand and direct contact form one clear starting point. */}
          <View className="gap-group lg:flex-1">
            <View className="w-full max-w-content-form">
              <MoyoLearnLogo accessibilityLabel="Moyo Learn" />
            </View>
            <Text className="font-moyo-display text-site-quote md:text-site-quote text-moyo-ink">
              Learn it by heart.
            </Text>

            <View
              id="talk-to-a-person"
              className="border-moyo-rule max-w-content-form gap-stack rounded-moyo-card border-moyo-outline bg-moyo-paper-raised p-inset-roomy shadow-moyo-2"
            >
              <View className="flex-row items-center gap-stack">
                <View aria-hidden className="size-4 bg-moyo-sun" />
                <Text variant="label" className="text-site-label text-moyo-secondary">
                  Talk to a person
                </Text>
              </View>
              <Link
                href={`mailto:${SUPPORT_EMAIL}`}
                className="self-start text-site-body text-moyo-ink underline"
              >
                {SUPPORT_EMAIL}
              </Link>
            </View>
          </View>

          {/* The second navigation landmark is explicitly named for assistive technology. */}
          <Nav
            aria-label="Footer"
            className={`${RULE} flex-row flex-wrap gap-section pt-section lg:flex-1 lg:border-t-0 lg:pt-0`}
          >
            {COLUMNS.map((column) => (
              <View key={column.heading} className="min-w-28 flex-1 gap-stack">
                <Text
                  id={`footer-col-${column.heading}`}
                  variant="label"
                  className="text-site-label text-moyo-secondary"
                >
                  {column.heading}
                </Text>
                <List aria-labelledby={`footer-col-${column.heading}`} className="gap-stack">
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
        </View>

        {/* Compliance and reader controls share a quiet, clearly separated close. */}
        <View
          className={`${RULE} flex-col gap-group pt-section md:flex-row md:items-end md:justify-between`}
        >
          <View className="max-w-content-prose gap-stack">
            <Paragraph className="text-site-body text-moyo-ink-muted">
              Moyo Learn is built for families and schools in the United States.
              Children&rsquo;s privacy follows COPPA, school data is handled on a
              FERPA-aligned basis, and state student-privacy requirements apply.
            </Paragraph>
            <Paragraph className="text-site-body text-moyo-ink-muted">
              A parent or guardian creates every learner account and gives consent before
              a child uses Moyo Learn.
            </Paragraph>
            <Paragraph className="text-site-body text-moyo-ink">
              No ads. No data sold. Not now, not later.
            </Paragraph>
          </View>

          <View className="gap-stack md:items-end">
            <Button
              className="moyo-pressable border-moyo-rule self-start rounded-moyo-card border-moyo-outline bg-moyo-mark px-inset-roomy py-inset text-site-body text-moyo-on-mark md:self-end"
              onPress={() => setReducedMotion(!reducedMotion)}
              aria-pressed={reducedMotion}
            >
              Reduce motion
            </Button>
            <Text className="text-site-body md:text-site-body text-moyo-ink-muted">
              {`© ${new Date().getFullYear()} Moyo Learn.`}
            </Text>
          </View>
        </View>
      </Container>
    </Footer>
  );
}
