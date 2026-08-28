/**
 * Chapter 08 · START — pricing, and the one primary action.
 *
 * ONE card. No comparison table, no monthly/annual toggle, nothing
 * pre-selected, and no countdown. Doc 05 §2.2 names manufactured scarcity as
 * the dark pattern this product refuses, and the Mobbin pass found **no honest
 * early-bird pattern in the entire index** — every discount returned was either
 * a fake deadline or an eligibility programme. So the offer is stated, the
 * regular price is stated at the same level, and nothing on this card ticks.
 *
 * THE PLACEHOLDER, AND WHY IT IS VISIBLE. `site.start.price.eligibility`
 * interpolates `{EARLY_BIRD_LIMIT}` — a real cap ("the first 500 families") or
 * a real printed date. Copy-deck §12 F-06 is a launch blocker: doc 05 requires
 * honest scarcity and **decides neither the number nor the date**, and
 * inventing either would itself be the dark pattern the rule exists to refuse.
 * So the token renders, marked, instead of being quietly filled or quietly
 * dropped. A missing line reads as finished work; a marked one does not.
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

/**
 * Doc 05 §2.2 requires eligibility to be "a real, stated limit — first N
 * founding families OR a hard date printed on the paywall — never a fake
 * countdown". Mike set the date: 1 November 2026.
 *
 * A date, not a countdown, and deliberately so: the Mobbin pass found no
 * honest early-bird pattern anywhere in the index — every discount surveyed was
 * a manufactured deadline or an eligibility programme. A printed date is
 * checkable and expires once; a ticking clock manufactures pressure and, if it
 * ever resets, is the exact dark pattern doc 05 refuses.
 *
 * When the date passes the offer is gone (doc 05: a "limited" price that never
 * ends is the dark pattern). Changing this constant is how that happens.
 */
const EARLY_BIRD_LIMIT = '1 November 2026';

/** Doc 05 §2.2: all children included. A learner cap here is a pricing error. */
const INCLUDED = [
  'Every child in your family',
  'Homework help from a photo — coached, never answered',
  'Natalie, one voice, speaking at your child’s grade level',
  'A written report after every session',
  'Safety guardrails, and you’re told when something happens',
  'No ads, and nothing about your child sold',
] as const;

export function StartChapter() {
  useMotionScene(SCOPE, buildScene);

  return (
    <Section id="start" className="chapter-start bg-moyo-paper py-section">
      <Container width="detail" className="gap-section">
        <View className="gap-group">
          <Text variant="label" className="text-site-label text-moyo-secondary">
            Start
          </Text>
          <Heading
            level={2}
            size="display-xl"
            className="start-headline font-moyo-display text-site-chapter md:text-site-chapter"
          >
            One plan. Every child.
          </Heading>
          {/*
            The Reflect move: the model in plain words, printed before the
            number. A parent who reads only this line has still been told the
            thing that answers O4 — the unit is the family, not the seat.
          */}
          <Paragraph className="text-site-lead text-moyo-ink">
            Moyo has one family plan, and it covers every child in your family.
          </Paragraph>
        </View>

        {/*
          The one card. Slab weight — 4px outline, square, hard offset shadow at
          the hero step — because it is the only card in the chapter and there
          is nothing for it to be compared against.
        */}
        <View className="start-card border-moyo-slab rounded-moyo-square border-moyo-outline bg-moyo-paper-raised p-inset-roomy gap-group shadow-moyo-3">
          <View className="flex-row flex-wrap items-center gap-stack">
            <Text className="text-site-subtitle md:text-site-subtitle text-moyo-ink">Family plan</Text>
            {/*
              A badge, outlined rather than filled: the chapter's one highlighter
              accent is spent on the placeholder below, where a reader actually
              needs to notice something is unresolved.
            */}
            <View className="border-moyo-hair rounded-moyo-square border-moyo-outline px-inset-tight py-inset-field">
              <Text className="text-site-label md:text-site-label text-moyo-secondary">Early bird</Text>
            </View>
          </View>

          {/*
            Craft's geometry, and only its geometry: the struck price sits
            immediately left of the live price on the same baseline in the same
            size class, so the comparison happens in one eye stop rather than
            across two lines — and `/mo` stays attached to the numeral instead
            of becoming a separate line of small print (Intercom).
          */}
          <View className="flex-row flex-wrap items-baseline gap-stack">
            <Text className="font-moyo-display text-site-title md:text-site-title text-moyo-ink-muted line-through">
              $15.99
            </Text>
            <Text className="font-moyo-display text-site-title md:text-site-title text-moyo-ink">$11</Text>
            <Text className="text-site-body md:text-site-body text-moyo-ink-muted">/mo</Text>
          </View>

          {/*
            F-06, made visible. `{EARLY_BIRD_LIMIT}` sits on the sun block —
            fill only, ink on it at 9.68:1 — which is this screen's single
            highlighter accent and its single unresolved value. It is left
            unfilled deliberately: doc 05 requires a real cap or a real printed
            date and decides neither, so a number here would be invented
            scarcity rather than honest scarcity.
          */}
          <View className="flex-row flex-wrap items-baseline gap-stack">
            <Text className="text-site-body md:text-site-body text-moyo-ink">
              Founding-family price, open until
            </Text>
            <Text className="bg-moyo-sun px-inset-tight text-site-body md:text-site-body text-moyo-on-sun">
              {EARLY_BIRD_LIMIT}
            </Text>
          </View>

          <View className="gap-stack">
            <Paragraph className="text-site-body text-moyo-ink">
              Your price stays $11 a month for as long as you stay subscribed.
            </Paragraph>
            {/* The un-discounted price, at the same level as the offer. */}
            <Paragraph className="text-site-body text-moyo-ink">
              Regular price is $15.99 a month.
            </Paragraph>
          </View>

          <View className="gap-stack">
            <Text variant="label" className="text-site-label text-moyo-secondary">
              What&rsquo;s included
            </Text>
            {/*
              Two columns at width, one on a phone. No row gap and no column
              gap: `basis-1/2` plus a gap overflows to a single item per row,
              and the vertical rhythm is carried by each row's own inset — which
              is what keeps the list reading as one block rather than six.
            */}
            <List className="flex-row flex-wrap">
              {INCLUDED.map((item) => (
                <ListItem
                  key={item}
                  className="start-included basis-full py-inset-tight pr-inset md:basis-1/2"
                >
                  <Text className="text-site-body md:text-site-body text-moyo-ink">{item}</Text>
                </ListItem>
              ))}
            </List>
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
            className="start-cta moyo-pressable border-moyo-rule self-start rounded-moyo-square border-moyo-outline bg-moyo-primary px-inset-roomy py-inset text-site-subtitle text-moyo-on-primary"
          >
            Start learning
          </Link>

          {/*
            The auto-renewal disclosure, in real text at AA — `moyoInkMuted` on
            `moyoPaperRaised` is 7.58:1, at body size. Never the faintest type
            on the page: that is the ClassPass pattern this chapter refused.
          */}
          <Paragraph className="text-site-body text-moyo-ink-muted">
            After the 30-day free trial, the family plan renews monthly at $11 (early
            bird) or $15.99 (regular) until you cancel. Cancel anytime in the app.
          </Paragraph>
        </View>

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
