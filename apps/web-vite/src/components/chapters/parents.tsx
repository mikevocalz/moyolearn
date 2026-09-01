/**
 * Chapter 06 · FOR PARENTS — the magazine turn.
 *
 * The page changes register here. Everywhere else the site is neubrutalist
 * slabs; this chapter is a printed article — an opening hairline rule, an
 * editorial serif standfirst at a ~65ch measure, a caption system, and
 * whitespace used as the luxury signal. That shift is the argument: the parent
 * chapter has to read as something written for them rather than sold to them.
 *
 * Two decisions worth naming:
 *
 *  1. The serif carries the STANDFIRST and the pull-quote, not the chapter
 *     title. `docs/site/tokens.md` §5.2 binds `site-chapter` to Clash Display
 *     and `site-quote` to a larger display measure, and every chapter opener on the page
 *     has to agree or the composition stops being one document. So the register
 *     turn is made where the type ramp already sanctions it — plus the measure,
 *     the rules-not-boxes hierarchy and the margin spec sheet.
 *  2. The report is SHOWN, not described (research §4.6: "one real artifact
 *     outperforms every adjective"). Its six block labels are set as a spec
 *     sheet in the margin rather than as a fake screenshot, because sample
 *     report CONTENT belongs to chapter 02 and duplicating Maya's work here
 *     would print the same specimen twice on one page.
 *
 * Mobbin: Kinfolk (a full-width hairline opens the section; shrinking type does
 * all the hierarchy, no boxes) · Zellerfeld (two-column letter — the narrow
 * measure on one side, deliberate emptiness on the other) · Claude (the "spec
 * sheet" lives in the margin beside the body, where it can be ignored) ·
 * Intercom (standfirst noticeably larger than body; ONE tinted inset marks
 * context) · Shop (four trust claims on hairline rules, each linking to the
 * real policy — no shields, no badges) · The New Yorker (a plate carrying an
 * inset caption stack). Full set: docs/site/mobbin/parents.md.
 *
 * SOT: docs/site/copy-deck.md §7 (every string) · docs/site/research.md §4.6 and
 *      §3 O2/O3/O6/O8 · docs/site/tokens.md · docs/site/motion-matrix.md
 *      docs/pack/08-visual-hierarchy-spacing-spec.md §5 (the ink frame) and §6
 *      (imagery policy, editorial grayscale at rest) · ../photography.ts
 * SOT-KEYWORDS: site chapter parents magazine editorial serif session report
 *               trust safety screentime controls price honesty ink-frame web-vite
 */
import { Container, Heading, Text } from '@acme/ui/typography';
import {
  Figcaption,
  Figure,
  Link,
  List,
  ListItem,
  Paragraph,
  Section,
  View,
} from '@acme/ui/primitives';
import { useMotionScene } from '@/motion';
import type { MotionScene } from '@/motion';
import { Photo } from '@/components/photo';

/*
  Policy destinations are ABSOLUTE on purpose. `/safety` and `/privacy` are not
  routes yet, and TanStack Start's prerender crawls every href beginning with
  `/` or `./` and fails the build on a 404
  (node_modules/@tanstack/start-plugin-core/dist/esm/prerender.js:43, :81 —
  verified by building a probe route that linked to `/privacy`). An absolute URL
  is skipped by the crawler and is still the correct destination once those
  pages ship, so the claim stays checkable — which is the entire point of the
  Shop pattern this chapter adopts.
*/
const SITE_ORIGIN = 'https://moyolearn.com';

const SCOPE = '.chapter-parents';

/** The article's measure. Prose here is set at 65ch and never wider. */
const MEASURE = 'max-w-content-prose';

/**
 * A trust cell. Rules, never boxes — doc 08 §2.3 and the Shop pattern both put
 * the structure in the separator, and a 2×2 of framed cards would drag the
 * chapter back into the slab register the whole section exists to leave.
 * The transparent sides carry the width class's other three edges; only the top
 * takes ink.
 */
const CELL = 'border-moyo-hair flex-1 border-transparent border-t-moyo-outline pt-inset-roomy gap-stack';

const TRUST = [
  {
    key: 'honesty',
    title: 'Honest, not flattering',
    body: 'Moyo won’t tell you your child is doing great when they aren’t. How far they came and where that sits against their grade are two separate lines, never blended into one comfortable number.',
    link: null,
  },
  {
    key: 'safety',
    title: 'Safety, in plain language',
    body: 'Natalie won’t keep secrets from you, won’t ask your child for personal details, and won’t give medical, therapy or legal advice. If a safety check goes down, tutoring pauses instead of guessing. If something serious comes up, tutoring stops, your child sees words written by people rather than by a model, and you’re told — with a person on it within two hours for the most urgent cases.',
    link: { label: 'Read the safety policy', href: `${SITE_ORIGIN}/safety` },
  },
  {
    key: 'screentime',
    title: 'Less time, not more',
    body: 'There are no streaks and no nudges to come back. Time in the app going down while your child’s skills go up is what Moyo counts as working.',
    link: null,
  },
  {
    key: 'controls',
    title: 'The controls are yours',
    body: 'Turn the voice off. Cap how long a session runs. Set the reading level if grade isn’t the right fit. Ask for your child’s data to be deleted, and it goes.',
    link: { label: 'Read the privacy policy', href: `${SITE_ORIGIN}/privacy` },
  },
] as const;

/** The eight blocks of doc 34 §2, as the report's spec sheet. */
const REPORT_BLOCKS = [
  'What we worked on',
  'The problems',
  'How it went',
  'A moment of effort',
  'What’s next',
  'How to help at home',
] as const;

export function ParentsChapter() {
  useMotionScene(SCOPE, buildScene);

  return (
    <Section
      id="for-parents"
      aria-labelledby="parents-headline"
      className="chapter-parents bg-moyo-paper py-section"
    >
      <Container width="wide" className="gap-section">
        {/*
          Kinfolk's opening move: the section is announced by a rule, not by a
          background change. `border-transparent` zeroes the colour on the three
          edges the width class also sets — the width utilities in @layer base
          are all-sides by construction (docs/site/tokens.md §5.1).
        */}
        <View className="border-moyo-hair border-transparent border-t-moyo-outline" />

        <View className="gap-group">
          <Text variant="label" className="text-site-label text-moyo-secondary">
            For parents
          </Text>
          <View className="gap-stack">
            <Heading
              id="parents-headline"
              level={2}
              size="display-xl"
              className="parents-headline font-moyo-display text-site-chapter md:text-site-chapter"
            >
              You&rsquo;ll actually know how it went.
            </Heading>
            {/*
              A pencil underline, drawn. Raw <svg> because `draw` is defined by
              `getTotalLength()`, which only a real SVGGeometryElement has, and
              the kit ships no SVG primitive on this surface. Decorative — the
              heading beside it carries the meaning — so it leaves the
              accessibility tree. The viewBox numbers are geometry, not design
              values: there is nothing in the token layer for "the curve a hand
              draws", the same reason the scroll thresholds are named in
              primitives.ts rather than in the theme.

              SIZED IN CSS, NEVER IN ATTRIBUTES — the PencilRule pattern from
              conversation.tsx. A literal `width="320"` is a floor no container
              can compress, and 320px is the WCAG 2.2 1.4.10 reflow width
              itself: inside this chapter's own inset the rule reached 336px and
              put the whole document into horizontal scroll. `vectorEffect`
              holds the stroke at 3px once `preserveAspectRatio="none"` starts
              scaling the box non-uniformly.
            */}
            <svg
              className="h-4 w-full max-w-content-detail"
              viewBox="0 0 320 16"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                className="parents-underline"
                d="M3 11 C 70 3, 180 15, 317 5"
                fill="none"
                stroke="var(--color-moyo-secondary)"
                strokeWidth="3"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </View>

          {/*
            The standfirst, and the register turn. Display type at
            `site-quote` — a deliberate scale step — set
            noticeably larger than the body (Intercom) at the article measure.
          */}
          <Paragraph
            className={`${MEASURE} font-moyo-display text-site-quote text-moyo-ink`}
          >
            Most homework apps hand you a streak and a smiley face. Moyo writes you a
            short, honest note after every session: what your child worked on, what they
            answered, what moved, and one thing to try at the table tonight.
          </Paragraph>
        </View>

        {/*
          The letter, per Zellerfeld: a narrow rail on the left carrying the
          report's spec sheet (Claude's margin metadata), and the article's own
          measure on the right. On a phone the rail simply stacks above — the
          emptiness is a wide-screen formality, not a layout dependency.
        */}
        <View className="flex-col gap-section md:flex-row md:gap-group">
          <View className="parents-margin gap-stack md:basis-1/3">
            <View className="flex-row items-center gap-stack">
              {/*
                The chapter's single highlighter accent. A sun block, never
                type and never a border — `moyoSun` is 1.69:1 on paper and is
                fill-only by law (tokens.md §5.1).
              */}
              <View className="size-6 bg-moyo-sun" />
              <Text variant="label" className="text-site-label text-moyo-secondary">
                What&rsquo;s in a session report
              </Text>
            </View>
            <List className="gap-stack">
              {REPORT_BLOCKS.map((block) => (
                <ListItem
                  key={block}
                  className="parents-block border-moyo-hair border-transparent border-t-moyo-outline pt-inset-tight"
                >
                  <Text className="text-site-body md:text-site-body text-moyo-ink">{block}</Text>
                </ListItem>
              ))}
            </List>
          </View>

          {/*
            `flex-1` rather than `basis-2/3`: react-native-web gives every View
            `flex-shrink: 0`, so a 1/3 + 2/3 pair plus a gap overflows its row
            instead of quietly compressing. The rail keeps its declared third
            and the article takes what is left.
          */}
          <View className="gap-group md:flex-1">
            {/*
              THE PHOTOGRAPH. The plate is the doc 08 §5/§6 ink frame — 2px
              outline, card radius, hard offset shadow — and the image inside it
              is a real Pexels frame shown grayscale at rest and in source color
              on hover. One responsive image serves both states, and the color
              reveal carries no meaning that is absent from the caption.

              WHAT IT IS A PHOTOGRAPH OF, AND WHY NOT THE REGISTER'S ROW. The
              copy deck's `site.alt.parents.report` describes a session report
              on a phone — a screenshot of a product surface, not photography.
              Shooting that is a mock-up, and this chapter's whole argument is
              that it does not flatter. So the plate carries the thing the
              report is ABOUT: a child part-way through the page, which is what
              the note the chapter promises would be written from. The caption
              names the work rather than praising it, in the register the
              standfirst already set.

              FULL BLEED INSIDE THE FRAME. `p-inset-roomy` would set the picture
              on a paper mat; the ink frame in doc 08 is a frame, not a mount.
              `overflow-hidden` is what makes the card radius cut the image.
            */}
            <Figure className="parents-plate gap-stack">
              <View className="border-moyo-hair overflow-hidden rounded-moyo-card border-moyo-outline bg-moyo-paper-sunken shadow-moyo-2">
                {/*
                  `sizes` is the article column, not the viewport: this plate
                  takes what is left of the 72rem container after the rail's
                  third and the gap, and the full measure once the two stack.
                */}
                <Photo name="hero-kitchen-table" sizes="(min-width: 48rem) 44rem, 92vw" />
              </View>
              {/*
                The two lines are wrapped in a View, not laid out by the
                Figcaption itself. `<figcaption>` and `<figure>` are html
                elements — display:block — so a `gap-*` on either is inert and
                two `Text` children, which render as inline spans, simply
                concatenate: the caption shipped reading "PlaceholderNo
                photography has been shot…" as one run. `View` is the kit's
                flex box, so the gap it is given is the gap it keeps.
              */}
              <Figcaption>
                <View className="gap-stack">
                  <Text variant="label" className="text-site-label text-moyo-secondary">
                    A session, before the note
                  </Text>
                  <Text className="text-site-body md:text-site-body text-moyo-ink-muted">
                    A notebook open, a pencil, and a page not finished yet. The note
                    is written from a half hour like this one &mdash; not from a score.
                  </Text>
                </View>
              </Figcaption>
            </Figure>
          </View>
        </View>

        {/*
          Shop's 2×2: four claims, hairline rules, two of them linking to the
          policy that makes the claim checkable. Nested rows rather than a grid
          because react-native-web renders these as flex containers and CSS grid
          does not survive the boundary.
        */}
        <View className="gap-group">
          <View className="flex-col gap-group md:flex-row">
            {TRUST.slice(0, 2).map((cell) => (
              <TrustCell key={cell.key} cell={cell} />
            ))}
          </View>
          <View className="flex-col gap-group md:flex-row">
            {TRUST.slice(2).map((cell) => (
              <TrustCell key={cell.key} cell={cell} />
            ))}
          </View>
        </View>

        {/*
          Intercom's tinted inset: ONE recessed panel marks "this is context,
          not the argument". Price honesty belongs in the parents chapter
          because O4 is answered by changing the unit, not by arguing the
          number — and the card itself lives in chapter 08.
        */}
        <View className={`${MEASURE} bg-moyo-paper-sunken p-inset-roomy gap-stack`}>
          <Text variant="label" className="text-site-label text-moyo-secondary">
            One price, every child
          </Text>
          <Paragraph className="font-moyo-display text-site-lead text-moyo-ink">
            $14.99 a month for one learner, $24.99 a month for the whole family. Each
            additional child after the first 3 is $11. No ads. Nothing about your
            child sold, ever.
          </Paragraph>
          <Link href="#start" className="text-site-body text-moyo-primary underline">
            See what&rsquo;s included
          </Link>
        </View>
      </Container>
    </Section>
  );
}

interface TrustCellProps {
  cell: (typeof TRUST)[number];
}

function TrustCell({ cell }: TrustCellProps) {
  return (
    <View className={`parents-cell ${CELL}`}>
      {/* An `h3`, not styled text: the four trust claims are the chapter's
          navigable structure, and 1.3.1 wants that in the markup. */}
      <Heading
        level={3}
        className="my-0 font-moyo-text text-site-subtitle font-normal md:text-site-subtitle text-moyo-ink"
      >
        {cell.title}
      </Heading>
      <Paragraph className="text-site-body text-moyo-ink-muted">{cell.body}</Paragraph>
      {cell.link ? (
        <Link href={cell.link.href} className="text-site-body text-moyo-primary underline">
          {cell.link.label}
        </Link>
      ) : null}
    </View>
  );
}

/**
 * Declared at module scope so the scene is rebuilt by its declared deps rather
 * than by every render (use-motion-scene.ts). Selector strings are scoped by
 * `gsap.context` to this chapter's own element and cannot reach another
 * chapter's markup.
 *
 * Four personalities, and nothing else animates: an element with no personality
 * assigned does not move (motion-matrix.md §9). Every one of these ends in the
 * state the markup already authored, so the reduced-motion pass, the JS-off
 * pass and the prerendered HTML are the same finished article.
 */
function buildScene({ motion }: MotionScene): () => void {
  const { split } = motion.splitReveal({ targets: '.parents-headline', scroll: {} });
  motion.draw({ targets: '.parents-underline', scroll: {} });
  motion.thunk({ targets: '.parents-plate', scroll: {} });
  motion.thunk({ targets: '.parents-cell', stagger: 0.06, scroll: {} });
  motion.snap({ targets: '.parents-block', from: 'left', stagger: 0.05, scroll: {} });

  // SplitText's `autoSplit` observers outlive the tween that used it, and GSAP's
  // context does not own them — so the one thing GSAP did not create is the one
  // thing named here. Null under reduced motion, where the heading was never
  // split at all.
  return () => split?.revert();
}
