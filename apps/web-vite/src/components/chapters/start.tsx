/**
 * Chapter 08 · START — pricing, and the one primary action.
 *
 * TWO cards: one for an individual learner and one for the whole family. No
 * comparison table, no monthly/annual toggle, nothing pre-selected, and no
 * countdown. Doc 05 §2.2 names manufactured scarcity as the dark pattern this
 * product refuses. The offer is stated, the billing condition is attached to
 * the numeral, then the inclusions, then the trial terms, then the button.
 *
 * Ordering is Reflect's, and it is load-bearing: the model in plain words comes
 * BEFORE the number, the billing condition is attached to the figure rather
 * than demoted to small print, then the inclusions, then the trial terms, then
 * the button. The trial line sits in body-size text directly above the action
 * (Squarespace's placement) because research §4.8 names the real failure here —
 * a parent starting a trial without knowing a card is required and that it
 * renews — and the ClassPass refusal says the sentence describing what will be
 * charged must never be the faintest type on the page.
 *
 * Mobbin: Reflect (model → price → contents → action) · Craft, GEOMETRY ONLY
 * (the struck price immediately left of the live one, same baseline, same size
 * class, so the comparison is one eye stop) · Squarespace (the two real
 * objections answered in one small unboxed line at the point of decision) ·
 * Intercom (the qualifier stays attached to the numeral instead of becoming a
 * separate line of small print). Refused: Craft's "Limited Time Only" banner,
 * Headspace's pre-checked annual, Superlist's four tiers and a toggle. Full
 * set: docs/site/mobbin/pricing.md.
 *
 * SOT: docs/site/copy-deck.md §9 (every string) and §12 F-06 ·
 *      docs/site/research.md §4.8 and §3 O4/O7 · docs/site/tokens.md
 * SOT-KEYWORDS: site chapter start pricing family plan early bird trial cta
 *               compress thunk placeholder eligibility renewal web-vite
 */
import { Container, Heading, Text } from '@acme/ui/typography';
import { Link, List, ListItem, Paragraph, Section, View } from '@acme/ui/primitives';
import { useMotionScene } from '@/motion';
import type { MotionScene } from '@/motion';

/*
  Absolute, for the reason parents.tsx records: the prerender crawls every href
  beginning with `/` and fails the build on a route that does not exist yet.
  `/signup` is FD-03 in doc 38 §'s route table — the front door the deck says
  this action lands on — not a path invented here.
*/
const SITE_ORIGIN = 'https://moyolearn.com';
const FRONT_DOOR = `${SITE_ORIGIN}/signup`;

const SCOPE = '.chapter-start';

const PLUS_INCLUDED = [
  'Unlimited AI tutor',
  'Tutor Room',
  'Personalized learning plan',
  'Assignments',
  'Mastery tracking',
] as const;

const FAMILY_INCLUDED = [
  'Everything in Plus for up to 3 children',
  'Parent dashboard',
  'Family progress',
  'Shared calendar',
] as const;

export function StartChapter() {
  useMotionScene(SCOPE, buildScene);

  return (
    <Section
      id="start"
      aria-labelledby="start-headline"
      className="chapter-start bg-moyo-paper py-section"
    >
      <Container width="detail" className="gap-section">
        <View className="gap-group">
          <Text variant="label" className="text-site-label text-moyo-secondary">
            Start
          </Text>
          <Heading
            level={2}
            size="display-xl"
            id="start-headline"
            className="start-headline font-moyo-display text-site-chapter md:text-site-chapter"
          >
            One learner. Or the whole family.
          </Heading>
          {/*
            The Reflect move: the model in plain words, printed before the
            number. A parent who reads only this line has still been told the
            thing that answers O4 — the unit is the learner or the family, not the seat.
          */}
          <Paragraph className="text-site-lead text-moyo-ink">
            Moyo has two plans: one for an individual learner and one that covers every child in your family.
          </Paragraph>
        </View>

        <View className="flex flex-col gap-stack md:flex-row md:gap-group">
          <PricingCard
            name="Moyo Plus"
            price="$14.99"
            period="/mo"
            audience="Individual learner"
            included={PLUS_INCLUDED}
          />
          <PricingCard
            name="Moyo Family"
            price="$24.99"
            period="/mo"
            audience="Families"
            included={FAMILY_INCLUDED}
            note="Each additional child after the first 3 is $11/mo."
          />
        </View>

        {/*
          The Squarespace placement. Body size, no box, no icon, directly
          above the button — the card condition and the cancel route are the
          two objections that actually stop people, and they are answered at
          the exact point of decision.
        */}
        <Paragraph className="text-site-body text-moyo-ink">
          30 days free. A card is required to start, we&rsquo;ll email you before the
          first charge, and you can cancel anytime in the app.
        </Paragraph>

        {/*
          An anchor, not a button element: this action navigates. It carries
          `.moyo-pressable`, whose box-shadow and translate are both calc()'d
          from `--moyo-shadow-offset-2`, so the distance it travels under the
          press and the offset its shadow loses are the same number by
          construction. No `shadow-*` utility here — Tailwind's important flag
          would win over that relationship and the press would stop reading as
          an object moving toward its own shadow.
        */}
        <Link
          href={FRONT_DOOR}
          className="start-cta moyo-pressable border-moyo-rule self-start rounded-moyo-card border-moyo-outline bg-moyo-primary px-inset-roomy py-inset text-site-subtitle text-moyo-on-primary"
        >
          Start learning
        </Link>

        {/*
          The auto-renewal disclosure, in real text at AA — `moyoInkMuted` on
          `moyoPaperRaised` is 7.58:1, at body size. Never the faintest type
          on the page: that is the ClassPass pattern this chapter refused.
        */}
        <Paragraph className="text-site-body text-moyo-ink-muted">
          After the 30-day free trial, Moyo Plus renews at $14.99/mo and Moyo Family at
          $24.99/mo. Each additional child beyond the first 3 is $11/mo. Cancel anytime in the app.
        </Paragraph>

        <View className="gap-stack">
          {/* A link, never a second card — chapter 07 is a different audience. */}
          <Link href="#for-schools" className="text-site-body text-moyo-primary underline">
            Run a school or a tutoring business? Talk to us.
          </Link>
          <Text className="text-site-body md:text-site-body text-moyo-ink-muted">
            Prices and plans live with the grown-ups. Your child never sees a price in
            Moyo.
          </Text>
        </View>
      </Container>
    </Section>
  );
}

function PricingCard({
  name,
  price,
  period,
  audience,
  included,
  note,
}: {
  readonly name: string;
  readonly price: string;
  readonly period: string;
  readonly audience: string;
  readonly included: readonly string[];
  readonly note?: string;
}) {
  return (
    <View className="start-card flex-1 border-moyo-slab rounded-moyo-square border-moyo-outline bg-moyo-paper-raised p-inset-roomy gap-group shadow-moyo-3">
      <View className="flex-row flex-wrap items-center gap-stack">
        <Heading
          level={3}
          className="my-0 font-moyo-text text-site-subtitle font-normal md:text-site-subtitle text-moyo-ink"
        >
          {name}
        </Heading>
      </View>

      <View className="flex-row flex-wrap items-baseline gap-stack">
        <Text className="font-moyo-display text-site-title md:text-site-title text-moyo-ink">
          {price}
        </Text>
        <Text className="text-site-body md:text-site-body text-moyo-ink-muted">{period}</Text>
      </View>

      <Text className="text-site-body text-moyo-ink-muted">{audience}</Text>

      <View className="gap-stack">
        <Text variant="label" className="text-site-label text-moyo-secondary">
          What&rsquo;s included
        </Text>
        {/*
          Two columns at width, one on a phone. No row gap and no column
          gap: `basis-full` keeps one item per row; the vertical rhythm is
          carried by each row's own inset.
        */}
        <List className="flex-row flex-wrap">
          {included.map((item) => (
            <ListItem
              key={item}
              className="start-included basis-full py-inset-tight pr-inset"
            >
              <Text className="text-site-body md:text-site-body text-moyo-ink">{item}</Text>
            </ListItem>
          ))}
        </List>
      </View>

      {note ? (
        <Paragraph className="text-site-body text-moyo-ink-muted">{note}</Paragraph>
      ) : null}
    </View>
  );
}

/**
 * The button is an object: it THUNKS into place on the way in and COMPRESSES
 * under the finger. `compress` is the one primitive on `reducedMotion:
 * 'instant'` — it keeps its beats and loses its duration — because a control
 * that stops responding has lost its affordance for exactly the reader who
 * asked for less movement.
 */
function buildScene({ motion, scope }: MotionScene): () => void {
  const { split } = motion.splitReveal({ targets: '.start-headline', scroll: {} });
  motion.thunk({ targets: '.start-card', scroll: {} });
  // Delayed so the control lands AFTER the card it sits in, rather than
  // dropping through a card that is still dropping. `delay` is the one timing
  // value a chapter owns — BaseOptions exposes it for exactly this staggering.
  motion.thunk({ targets: '.start-cta', delay: 0.15, scroll: {} });
  motion.snap({ targets: '.start-included', from: 'left', stagger: 0.04, scroll: {} });

  const press = motion.compress({ targets: '.start-cta' });
  const cta = scope.querySelector('.start-cta');
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
