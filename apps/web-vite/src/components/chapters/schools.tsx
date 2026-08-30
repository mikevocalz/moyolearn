/**
 * Chapter 07 · FOR SCHOOLS & TUTORING BUSINESSES — the Swiss turn.
 *
 * REF-07's register: columned rigor, a duotone data graphic built out of the
 * token fills, and information density done with discipline. The chapter has
 * one job a parent can feel without reading a word — "serious infrastructure" —
 * and one job the institutional buyer came for: an ask that is a conversation
 * rather than a tier.
 *
 * THE STRUCTURAL RULE: no price appears here. Not a tier, not a "from", not a
 * range. Doc 05 §2.2 — *a parent never sees these numbers* — and
 * `tooling/check-copy-law.mjs` fails the build on the doc 05 literals, so this
 * is a property of the build rather than of anyone's memory. It is also why the
 * ask is `Talk to us` and why it is never styled as the page's primary action:
 * `Start learning` is the one primary, in the nav, the hero and chapter 08.
 *
 * TWO PLACES THE COPY IS TENSE-BOUND. `Payroll` is the v1-true noun (doc 05
 * §5.2: v1 COMPUTES pay runs; money movement is M2), and LMS/LTI is an explicit
 * v1 non-goal (doc 33 §8.6, copy-deck §12 F-08), so the LTI capability may only
 * render adjacent to the roadmap line and never in the present tense.
 *
 * Mobbin: ElevenLabs (one kicker, one three-line sentence, one button, nothing
 * else — refusing to list features is what reads as infrastructure) · Aside
 * (kicker → promise → qualifier → contact → THEN the capability list, so a
 * convinced buyer never scrolls past a list to act) · Büro (a fixed rail with
 * the measure varying against it) · The Leap (a genuinely bordered, labelled
 * data table) · Hex (a hairline rectangle, no fill and no shadow, is enough to
 * make a CTA a destination in a dense layout). Refused: Teachable's enterprise
 * tile inside the price grid, and Maze's comparison table under the ask. Full
 * set: docs/site/mobbin/schools.md.
 *
 * SOT: docs/site/copy-deck.md §8 (every string) · docs/site/research.md §4.7 and
 *      §3 O9/O10/O11 · docs/site/tokens.md · docs/site/motion-matrix.md
 * SOT-KEYWORDS: site chapter schools tutoring business operations cloud crm
 *               scheduling payroll org admin lti roadmap wall duotone web-vite
 */
import { Container, Heading, Text } from '@acme/ui/typography';
import { Link, List, ListItem, Paragraph, Section, View } from '@acme/ui/primitives';
import { useMotionScene } from '@/motion';
import type { MotionScene } from '@/motion';
import { Photo } from '@/components/photo';
import type { PhotoName } from '@/components/photography';

const SCOPE = '.chapter-schools';

/*
  The ask lands on the footer's contact band rather than on a route. `/contact`
  does not exist, and TanStack Start's prerender crawls every href starting with
  `/` and fails the build on a 404 — so a link to an unbuilt route would take
  the whole site down at build time, not at click time. The footer band is a
  real destination that works today; it is where `{SUPPORT_EMAIL}` lands when an
  owner supplies one.
*/
const CONTACT_ANCHOR = '#talk-to-a-person';

/**
 * Split at the em dash so the term and its qualifier can sit in two columns —
 * The Leap's labelled-table discipline — without a single word of the copy
 * changing. The deck authors these as one string each; this is a layout of that
 * string, not an edit of it.
 */
const CAPABILITIES = [
  {
    term: 'CRM',
    detail: 'leads, families and enrolments in one place',
    roadmap: false,
  },
  {
    term: 'Scheduling',
    detail: 'a calendar built around tutors, rooms and sessions',
    roadmap: false,
  },
  {
    term: 'Payroll',
    detail:
      'pay rules per tutor and per service, computed from completed sessions, with statements and export',
    roadmap: false,
  },
  {
    term: 'Org administration',
    detail: 'roles, scoped queues, and an append-only audit trail on every incident',
    roadmap: false,
  },
  {
    term: 'LMS and LTI',
    detail: 'launch from the LMS you already run, sync rosters, pass grades back',
    roadmap: true,
  },
] as const;

/**
 * The two sides of the wall, as the duotone. Cobalt against the sunken paper is
 * the only two-value pairing the token layer offers that reads as a data
 * graphic rather than as decoration, and both foregrounds are measured:
 * `moyoOnPrimary` on `moyoPrimary` is 7.42:1, `moyoInk` on `moyoPaperSunken` is
 * 15.00:1 (tokens.md, `SITE_PAIRS`).
 */
const OPERATIONS = ['CRM', 'Scheduling', 'Payroll', 'Org administration'] as const;
const LEARNING_RECORD = ['A child’s session', 'A safety incident'] as const;

export function SchoolsChapter() {
  useMotionScene(SCOPE, buildScene);

  return (
    <Section
      id="for-schools"
      aria-labelledby="schools-headline"
      className="chapter-schools bg-moyo-paper py-section"
    >
      <Container width="wide" className="gap-section">
        {/*
          The ElevenLabs half: kicker, one sentence, one button. Nothing else is
          allowed in here — a feature list above the fold is what turns an
          infrastructure pitch back into a plan tier, which is the exact failure
          research §4.7 names.
        */}
        <View className="gap-group">
          <Text variant="label" className="text-site-label text-moyo-secondary">
            For schools and tutoring businesses
          </Text>
          <Heading
            id="schools-headline"
            level={2}
            size="display-xl"
            className="schools-headline max-w-content-detail font-moyo-display text-site-chapter md:text-site-chapter"
          >
            The operations cloud under the tutoring.
          </Heading>
          <Paragraph className="max-w-content-prose text-site-lead text-moyo-ink">
            Moyo runs the business, not only the lesson: families and leads, scheduling,
            tutor pay, org administration — with the learning platform your tutors and
            students already use sitting on top of it.
          </Paragraph>
          {/*
            Hex's move: a hairline rectangle with no fill and no shadow class is
            enough to make the ask a destination. The shadow comes from
            `.moyo-pressable` (globals.css), which calc()s it and the press
            travel from ONE token so they cannot drift — adding a `shadow-*`
            utility here would win on Tailwind's important flag and break that
            relationship.
          */}
          <View className="gap-stack">
            <Link
              href={CONTACT_ANCHOR}
              className="schools-cta moyo-pressable border-moyo-rule self-start rounded-moyo-square border-moyo-outline bg-moyo-paper-raised px-inset-roomy py-inset text-site-body text-moyo-ink"
            >
              Talk to us
            </Link>
            <Text className="text-site-body md:text-site-body text-moyo-ink-muted">
              We&rsquo;ll ask what you run today and what&rsquo;s breaking.
            </Text>
          </View>
        </View>

        {/*
          The chapter's visual bento. Two 3:2 landscapes pair with two 3:4
          portraits; the desktop 2:1 flex ratio makes each row land at one
          shared height without fixed pixels, while phones receive a simple
          one-column reading order. Every tile uses the same ink frame and
          raised paper caption as the rest of the site.
        */}
        <View className="gap-group">
          <View className="max-w-content-prose gap-stack">
            <Text variant="label" className="text-site-label text-moyo-secondary">
              Built around the people doing the work
            </Text>
            <Heading
              level={3}
              className="my-0 font-moyo-text text-site-title font-normal md:text-site-title text-moyo-ink"
            >
              The lesson is only one part of the day.
            </Heading>
            <Paragraph className="text-site-body text-moyo-ink-muted">
              The classroom stays human. Moyo Learn handles the work around it without
              mixing the operational record with what a child says or does in a session.
            </Paragraph>
          </View>

          <View className="gap-stack">
            <View className="flex-col gap-stack md:flex-row">
              <SchoolBentoCard
                name="schools-operations"
                sizes="(min-width: 48rem) 48rem, 92vw"
                index="01"
                title="The back office"
                detail="Families, schedules, payroll and administration."
                className="md:flex-[2]"
              />
              <SchoolBentoCard
                name="schools-educator"
                sizes="(min-width: 48rem) 24rem, 92vw"
                index="02"
                title="The educator"
                detail="Preparation stays connected to every session."
                className="md:flex-1"
              />
            </View>
            <View className="flex-col gap-stack md:flex-row">
              <SchoolBentoCard
                name="schools-instruction"
                sizes="(min-width: 48rem) 24rem, 92vw"
                index="03"
                title="The classroom"
                detail="The teacher leads; students keep doing the work."
                className="md:flex-1"
              />
              <SchoolBentoCard
                name="schools-classroom"
                sizes="(min-width: 48rem) 48rem, 92vw"
                index="04"
                title="The whole school day"
                detail="Learning above. Operations underneath."
                className="md:flex-[2]"
              />
            </View>
          </View>
        </View>

        {/*
          Aside's ordering: the capability list comes AFTER the ask. Büro's rail
          supplies the density — a fixed index column on the left, the measure
          varying against it — and The Leap supplies the bordered rows.
        */}
        <List>
          {CAPABILITIES.map((capability, index) => (
            <ListItem
              key={capability.term}
              className="schools-row border-moyo-hair flex-col border-transparent border-t-moyo-outline gap-stack py-inset md:flex-row md:gap-group"
            >
              <Text className="text-site-label md:text-site-label text-moyo-ink-muted md:basis-1/12">
                {`0${index + 1}`}
              </Text>
              {/* The capability name is a heading, not text that looks like
                  one: a `Text` at `site-subtitle` is invisible to every
                  heading-navigation affordance (1.3.1). */}
              <Heading
                level={3}
                className="my-0 font-moyo-text text-site-subtitle font-normal md:text-site-subtitle text-moyo-ink md:basis-1/4"
              >
                {capability.term}
              </Heading>
              <View className="gap-stack md:flex-1">
                <Text className="text-site-body md:text-site-body text-moyo-ink-muted">
                  {capability.detail}
                </Text>
                {/*
                  F-08: the LTI row may only exist beside the roadmap line, and
                  never in the present tense. Rendering them as siblings rather
                  than as a footnote somewhere else is what keeps that true when
                  someone reorders the list later.
                */}
                {capability.roadmap ? (
                  <Text className="text-site-body md:text-site-body text-moyo-secondary">
                    LMS and LTI integration and automated tutor payouts are on the roadmap
                    — talk to us about timing.
                  </Text>
                ) : null}
              </View>
            </ListItem>
          ))}
        </List>
        {/*
          The table's closing rule. It lives AFTER the list, not inside it: a
          `<div>` among `<li>`s is invalid markup, and assistive technology that
          honours it announces a five-item list with a stray sixth child. The
          rule is structure, so it renders the same either way — only the
          semantics were wrong.
        */}
        <View className="border-moyo-hair border-transparent border-t-moyo-outline" />

        {/*
          The O11 proof, drawn. This is the strongest line in the chapter and a
          diagram states it faster than a paragraph: two tone fields, one heavy
          rule between them, and no numbers — a data graphic that invents no
          data, which a bar chart on this page would have had to.
        */}
        <View className="gap-group">
          <Heading
            level={3}
            className="my-0 font-moyo-text text-site-title font-normal md:text-site-title text-moyo-ink"
          >
            Your sales tools can&rsquo;t read a child&rsquo;s session
          </Heading>
          <View className="flex-col items-stretch md:flex-row">
            <View className="schools-field flex-1 bg-moyo-primary p-inset-roomy gap-stack">
              <Text variant="label" className="text-site-label text-moyo-on-primary">
                The CRM
              </Text>
              {OPERATIONS.map((item) => (
                <Text key={item} className="text-site-body md:text-site-body text-moyo-on-primary">
                  {item}
                </Text>
              ))}
            </View>
            {/*
              The wall. 4px of ink is the slab weight, the heaviest rule the
              token layer has, and the sun block beside it is this screen's one
              highlighter accent — fill only, ink on it at 9.68:1.
            */}
            <View className="schools-wall border-moyo-slab flex-row items-center justify-center border-transparent border-t-moyo-outline gap-stack py-inset md:flex-col md:border-t-transparent md:border-l-moyo-outline md:px-inset md:py-0">
              <View className="size-6 bg-moyo-sun" />
              <Text className="text-site-label md:text-site-label text-moyo-secondary">
                separated in the code
              </Text>
            </View>
            <View className="schools-field flex-1 bg-moyo-paper-sunken p-inset-roomy gap-stack">
              <Text variant="label" className="text-site-label text-moyo-secondary">
                The learning record
              </Text>
              {LEARNING_RECORD.map((item) => (
                <Text key={item} className="text-site-body md:text-site-body text-moyo-ink">
                  {item}
                </Text>
              ))}
            </View>
          </View>
          <Paragraph className="max-w-content-prose text-site-body text-moyo-ink-muted">
            The CRM and the learning record are separated in the code, not by policy. A
            safety incident can never become a sales signal.
          </Paragraph>
        </View>

        {/*
         * The second proof, aimed at the district reviewer.
         *
         * COPY DEVIATION, DELIBERATE. Copy-deck §8 writes the second sentence
         * with its refusal at the END of the clause — teacher material and the
         * keys "never enter" the index. `check-copy-law.mjs` clears a match
         * only when a negation governs it EARLIER in the same clause, so the
         * deck's own sanctioned sentence fails the gate. The gate's own
         * instruction on failure is explicit — "make the negation explicit in
         * the copy rather than widening a pattern, the law is the product, not
         * the regex" — so the clause is reordered to put the refusal first.
         * Same claim, same words, one fewer way to misread it. Logged for the
         * copy owner.
         *
         * (This comment is `*`-prefixed for the same reason: the gate scopes
         * itself to lines a visitor can read, and it recognises a comment by
         * that prefix — an unprefixed JSX comment quoting the deck would fail
         * the build for describing the problem it was documenting.)
         */}
        <View className="max-w-content-prose gap-stack">
          <Heading
            level={3}
            className="my-0 font-moyo-text text-site-title font-normal md:text-site-title text-moyo-ink"
          >
            Guided-only isn&rsquo;t a setting
          </Heading>
          <Paragraph className="text-site-body text-moyo-ink-muted">
            No district, school or teacher can switch Moyo into answering mode, because there isn’t one. And no answer key or teacher material enters the index the student tutor can read.
          </Paragraph>
        </View>
      </Container>
    </Section>
  );
}

interface SchoolBentoCardProps {
  name: PhotoName;
  sizes: string;
  index: string;
  title: string;
  detail: string;
  className?: string;
}

function SchoolBentoCard({
  name,
  sizes,
  index,
  title,
  detail,
  className,
}: SchoolBentoCardProps) {
  return (
    <View
      className={`schools-bento-card border-moyo-rule overflow-hidden rounded-moyo-card border-moyo-outline bg-moyo-paper-raised shadow-moyo-2 ${className ?? ''}`}
    >
      <Photo name={name} sizes={sizes} />
      <View className="flex-row items-start justify-between gap-group p-inset-roomy">
        <View className="flex-1 gap-stack">
          <Text variant="label" className="text-site-label text-moyo-secondary">
            {title}
          </Text>
          <Text className="text-site-body md:text-site-body text-moyo-ink">{detail}</Text>
        </View>
        <View className="size-8 items-center justify-center bg-moyo-sun">
          <Text className="text-site-label md:text-site-label text-moyo-ink">{index}</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Five personalities and nothing else moves. `snap` carries the capability rows
 * because the register is construction — pieces squaring up into a grid — and
 * it is never a burst and never confetti (motion-matrix.md §8).
 */
function buildScene({ motion, scope }: MotionScene): () => void {
  const { split } = motion.splitReveal({ targets: '.schools-headline', scroll: {} });
  motion.thunk({ targets: '.schools-bento-card', stagger: 0.08, scroll: {} });
  motion.snap({ targets: '.schools-row', from: 'left', stagger: 0.05, scroll: {} });
  motion.thunk({ targets: '.schools-field', stagger: 0.08, scroll: {} });
  motion.lockIn({ targets: '.schools-wall', scroll: {} });

  // Built paused and reversible: press plays it, release reverses it. This is
  // the one primitive on `reducedMotion: 'instant'`, so the control still reads
  // as a control for the reader who asked for less movement.
  const press = motion.compress({ targets: '.schools-cta' });
  const cta = scope.querySelector('.schools-cta');
  const onDown = (): void => {
    press.play();
  };
  const onUp = (): void => {
    press.reverse();
  };
  cta?.addEventListener('pointerdown', onDown);
  cta?.addEventListener('pointerup', onUp);
  cta?.addEventListener('pointerleave', onUp);

  return () => {
    cta?.removeEventListener('pointerdown', onDown);
    cta?.removeEventListener('pointerup', onUp);
    cta?.removeEventListener('pointerleave', onUp);
    split?.revert();
  };
}
