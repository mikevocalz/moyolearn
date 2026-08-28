/**
 * Chapter 01 · HERO — the page's one display moment.
 *
 * The one message (research §4.1): *Moyo is a tutor with a heart — and it
 * teaches, it doesn't answer.* Both halves have to land above the fold, which
 * is why the refusal idea lives inside `site.hero.body` and is not deferred to
 * chapter 03: a parent who reads "AI tutor" and nothing else files Moyo with
 * the camera-solvers, which is the exact failure the research note names.
 *
 * Every string is `site.hero.*` from the copy deck, verbatim and in sentence
 * case. The caps are a TREATMENT (`uppercase`), never an authored string —
 * §13 of the deck makes that a localisation requirement, not a style note.
 *
 * ONE DEVIATION, FLAGGED. The third door reads `I have a code`, which the copy
 * deck does not key: the deck covers chapters, and the learner door is
 * specified in doc 38 §FD-01 instead. The string, and the "for kids: enter the
 * code from your grown-up" hint carried on its accessible name, are both taken
 * verbatim from there rather than written here.
 *
 * ACCENT BUDGET. This chapter spends the page's heart moment on the learner
 * door and nothing else — the annotation rule is `moyoSecondary`, which
 * docs/site/tokens.md reserves for exactly that (eyebrows, underlines,
 * annotation rules). No `moyoSun` is used here; the highlighter is spent in
 * chapter 02.
 *
 * Mobbin: https://mobbin.com/sites/sections/4de98a06-dbff-4e54-83c6-a301c519bba0
 * (SSENSE — headline so large the controls are a fraction of its height, so the
 * SENTENCE is the hero) · https://mobbin.com/sites/sections/8d2a4681-cdad-4b4b-bc6e-83fd0be35983
 * (MasterClass — an object slotted into the notch the shorter headline line
 * leaves, rather than placed beside the type) · https://mobbin.com/sites/sections/4e363497-beed-4917-9f40-2ddee269fb2c
 * (Craft — three CTAs on one row in three visibly different fill weights, so
 * hierarchy is carried by treatment rather than by position) ·
 * https://mobbin.com/sites/sections/55f94117-780b-451c-94f4-880f8943ba29
 * (Oatly — three hard cells that complete the headline, so choosing a door
 * finishes a thought) · https://mobbin.com/sites/sections/2e4c40b8-7bf9-42ba-9d84-474dc0493871
 * (Linktree — the generic path is offered first, self-identification second).
 * Structure only; palette, type and shape come from docs/site/tokens.md.
 *
 * SOT: docs/site/copy-deck.md §2 · docs/site/research.md §4.1
 *      docs/site/mobbin/hero.md · docs/site/tokens.md · docs/site/motion-matrix.md
 *      docs/38-front-door-and-flow.md §FD-01 (the learner door)
 * SOT-KEYWORDS: site chapter hero display headline learning has a heart three
 *               doors learner door annotation shantell split-reveal thunk draw
 *               web-vite marketing
 */
import { Container, Heading, Text } from '@acme/ui/typography';
import { Link, Paragraph, Section, View } from '@acme/ui/primitives';
import { useMotionScene } from '@/motion';
import type { MotionScene } from '@/motion';
import { Photo } from '@/components/photo';

/** The scene root. Unique per chapter, so `gsap.context` cannot cross into another. */
const SCOPE = '.hero-chapter';

/*
  The app's real routes (apps/web/app/(auth)). Named here rather than typed into
  three elements so the handoff is one edit if the deployment ever mounts the
  product somewhere else — and so it is visible that these are existing screens,
  not placeholders. `/onboarding/learner` is FD-08's door: the learner sequence,
  which is where a kid with a code belongs.
*/
const APP_START = '/onboarding';
const APP_LOGIN = '/login';
const APP_LEARNER = '/onboarding/learner';

/*
  Shared shape. `.moyo-pressable` (globals.css) supplies the resting offset
  shadow and the press travel from one token, so no door writes a shadow class
  of its own — the two would drift the moment the press animation ran.
*/
/*
  No `md:` restatement on the doors, and that is not an oversight: `Link` is a
  raw primitive, so nothing runs its classes through tailwind-merge. Only the
  `tv()`-backed `Heading` and `Text` carry a responsive step that a bare
  `text-site-*` would silently lose to from 768px up.
*/
const DOOR =
  'moyo-pressable border-moyo-outline items-center justify-center px-inset-roomy py-inset text-center text-site-body';

/** The one primary action on the page — same label in the nav and chapter 08. */
const DOOR_PRIMARY = `${DOOR} hero-door border-moyo-rule rounded-moyo-square bg-moyo-primary text-moyo-on-primary min-h-target-adult`;
const DOOR_SECONDARY = `${DOOR} hero-door border-moyo-rule rounded-moyo-square bg-moyo-paper-raised min-h-target-adult`;
/*
  The kid's door, and it has to be findable by a kid rather than read by one:
  heavier frame, the single soft radius the shape law allows, the heart fill,
  and the learner-band target size. Four differences at once, because one is a
  variant and four are a different object.
*/
const DOOR_LEARNER = `${DOOR} hero-door border-moyo-slab rounded-moyo-card bg-moyo-heart text-moyo-on-heart min-h-target-child`;

export function Hero() {
  useMotionScene(SCOPE, buildHeroScene);

  return (
    <Section
      id="hero"
      aria-labelledby="hero-headline"
      className="hero-chapter min-h-screen justify-center bg-moyo-paper py-section"
    >
      <Container width="wide" className="gap-section">
        <Text variant="label" className="text-site-label text-moyo-secondary">
          An AI tutor for kindergarten through 12th grade
        </Text>

        {/*
          The MasterClass move. The headline wraps ragged and its last line is
          short; the worksheet is bottom-aligned beside it, so it sits IN the
          notch the short line leaves rather than next to a block of type.
          Below `lg` the two stack and the notch simply does not exist, which is
          the honest small-screen answer — a faked notch is a cropped one.
        */}
        <View className="gap-group lg:flex-row lg:items-end lg:gap-section">
          <Heading
            id="hero-headline"
            level={1}
            size="display-xl"
            /*
              `md:text-site-hero` is not a duplicate. `Heading`'s size variant
              steps up at md (`text-display-xl md:text-display-2xl`) and
              tailwind-merge only lets a class beat another inside the SAME
              modifier group, so overriding the base step alone would leave the
              product's fixed 72px winning from 768px up — exactly where a fluid
              hero should be at its largest. Documented in routes/index.tsx and
              in docs/site/component-inventory.md (#1, `MoyoDisplay`).
            */
            className="hero-headline font-moyo-display text-site-hero uppercase md:text-site-hero lg:w-8/12"
          >
            Learning has a heart.
          </Heading>
          <Worksheet />
        </View>

        <View className="gap-group lg:flex-row lg:items-start lg:justify-between lg:gap-section">
          <Paragraph className="max-w-content-prose text-site-lead lg:w-7/12">
            Moyo coaches your child through the work instead of doing it for them. Point the
            camera at the homework and Natalie teaches the next step — at your child&rsquo;s
            grade level, in one familiar voice, with every session written up for you.
          </Paragraph>

          <View className="gap-stack lg:w-5/12">
            {/*
              Three doors on one row, in three fill weights. `role="group"`
              plus a name so a screen reader hears them as one set of choices
              and not as three unrelated links in a paragraph.
            */}
            <View
              role="group"
              aria-label="Ways in"
              className="flex-row flex-wrap items-stretch gap-stack"
            >
              <Link href={APP_START} className={DOOR_PRIMARY}>
                Start learning
              </Link>
              <Link href={APP_LOGIN} className={DOOR_SECONDARY}>
                Log in
              </Link>
              {/*
                The visible label is contained in the accessible name, so
                WCAG 2.5.3 holds while the hint doc 38 §FD-01 specifies still
                reaches a kid using a screen reader. It is deliberately NOT
                visible copy: the deck states this site carries no learner-band
                copy, and "grown-up" is learner-band by the glossary.
              */}
              <Link
                href={APP_LEARNER}
                aria-label="I have a code — for kids: enter the code from your grown-up"
                className={DOOR_LEARNER}
              >
                I have a code
              </Link>
            </View>

            <Text className="text-site-note text-moyo-ink-muted md:text-site-note">
              One plan. Every child in your family.
            </Text>

            <Link href="#conversation" className="text-site-body text-moyo-primary underline">
              See how Moyo teaches
            </Link>
          </View>
        </View>

        <Text className="text-site-label text-moyo-ink-muted md:text-site-label">Scroll to see a real week</Text>
      </Container>
    </Section>
  );
}

/**
 * The object in the notch — and it is now the photograph the art direction
 * always specified.
 *
 * This element used to be a ruled sheet drawn from tokens, standing in for a
 * photograph nobody had shot, and its comment promised that "the photograph
 * replaces this element without moving anything around it". That is exactly
 * what happened: the plate, the annotation, the arrow and the notch geometry
 * are unchanged, and only the thing inside the frame is different. The two
 * strings the stand-in carried ("Two-digit subtraction", "47 − 19") are gone
 * with it — they were scaffolding invented here, not deck copy; the deck keys
 * "47 minus 19" only inside `site.conversation.demo.natalie`, in chapter 03.
 *
 * FULL BLEED INSIDE THE FRAME, no mat. `p-inset-roomy` on the plate would set
 * the photograph on a paper margin, which is a mounted print; the shape ladder
 * here is a hero slab, and a slab holds its picture right out to the ink.
 * `overflow-hidden` is what makes the frame's radius cut the image rather than
 * letting a square corner poke through a rounded one.
 *
 * `priority`: this is the largest thing above the fold and the page's LCP
 * candidate, so it loads eagerly and decodes synchronously. It is the only
 * photograph on the site that does.
 */
function Worksheet() {
  return (
    <View className="relative max-w-content-form lg:w-4/12 lg:self-end">
      <View className="border-moyo-slab relative overflow-hidden rounded-moyo-square border-moyo-outline bg-moyo-paper-raised shadow-moyo-3">
        {/*
          `sizes` describes the plate, not the viewport: a third of the 72rem
          container from `lg` up, and the `max-w-content-form` cap below it.
          Without this the browser assumes 100vw and downloads the 840px file
          onto a phone that is showing it at 320.
        */}
        <Photo name="hero-kitchen-table" sizes="(min-width: 64rem) 24rem, (min-width: 30rem) 28rem, 92vw" priority />
      </View>

      {/*
        The annotation, and the arrow that points it at the sheet. The note is
        CONTENT — deck §11 rule 5 — so it carries `site.hero.annotation.aria` as
        its accessible name; only the arrow is decorative.

        `flex-col-reverse`, and the photograph is the reason. The group still
        straddles the plate's bottom edge exactly as before — same offset, same
        footprint, so it still clears the doors below — but the two children
        have swapped ends of it. That was free while the plate was a cream ruled
        sheet, because brown handwriting reads the same on `paper-raised` above
        the edge as on `paper` below it. Over a photograph the half of the note
        that landed inside went to mid-grey and stopped being legible: brown ink
        on a duotone is not a contrast pair, and a scrim to rescue it is a
        surface this design language does not have.

        So the NOTE takes the outside half, where it is on paper and legible,
        and the ARROW takes the inside half, over the plate. That is the right
        way round on its own merits: the arrow is `aria-hidden` decoration, a
        2px line rather than letterforms, and an arrow drawn onto the picture is
        what the gesture was always describing.

        Reversed with flex rather than by moving the JSX, so the note stays
        first in the DOM — it is the content, and the reading order should not
        be decided by which end of a box it is painted at.
      */}
      <View className="absolute bottom-0 right-0 translate-y-1/2 flex-col-reverse items-end gap-element">
        <Text
          aria-label="Handwritten note: fractions, Tuesday"
          className="font-moyo-hand text-site-note text-moyo-secondary md:text-site-note"
        >
          fractions, Tuesday
        </Text>
        {/*
          A raw <svg>: the kit has no SVG primitive on this surface, and `draw`
          is defined by `getTotalLength()`, which only a real SVGGeometryElement
          has. Same justification, and the same shape, as /motion-lab's pencil
          underline. The path is authored UNDASHED — the primitive owns the
          dash, so with no JS the arrow is simply drawn.
        */}
        <svg width="96" height="34" viewBox="0 0 96 34" aria-hidden="true">
          <path
            className="hero-arrow"
            d="M94 3 C 70 6, 34 10, 12 27"
            fill="none"
            stroke="var(--color-moyo-secondary)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            className="hero-arrow"
            d="M6 18 L 10 28 L 21 26"
            fill="none"
            stroke="var(--color-moyo-secondary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </View>
    </View>
  );
}

/**
 * Declared outside the component so it is a stable reference — `useMotionScene`
 * rebuilds on its declared deps, and an inline builder would be a new function
 * on every render.
 *
 * The entrance is a composition of two personalities on the same letters, which
 * is deliberate: `splitReveal` is what CUTS the heading and rises each character
 * out of its own mask, and `thunk` is what gives that arrival its overshoot and
 * hard settle. Neither one alone is the brief. They tween different properties
 * (`yPercent` against `y`/`scale`), so they compose rather than fight.
 *
 * Under reduced motion `splitReveal` does not split at all and returns a null
 * instance — so `thunk` is never wired to letters that do not exist, and the
 * heading stays a single text node, which is also the better screen-reader
 * result. The annotation's `draw` and the doors' `thunk` fall through the same
 * end-state law: written, seated, at rest.
 */
function buildHeroScene({ motion, scope }: MotionScene): () => void {
  const { split, timeline } = motion.splitReveal({
    targets: '.hero-headline',
    unit: 'chars',
    stagger: 0.014,
  });

  if (split) {
    motion.thunk({ targets: split.chars, stagger: 0.014 });
  }

  /*
    The annotation is written AFTER the headline has landed, because that is the
    order the gesture happened in: the page was worked, then somebody wrote in
    the margin. `timeline.duration()` is the measured length of the split rather
    than a number invented here, so the two cannot drift apart when the headline
    copy changes length.
  */
  const afterHeadline = timeline.duration();
  motion.draw({ targets: '.hero-arrow', delay: afterHeadline, stagger: 0.08 });
  motion.thunk({ targets: '.hero-door', delay: afterHeadline, stagger: 0.06 });

  /*
    Press behaviour, one timeline per door. `compress` is the only primitive on
    `reducedMotion: 'instant'` — a control that stops responding to a press has
    lost its affordance for the reader who asked for less movement, so it keeps
    its beats and loses its duration.
  */
  const disposers: (() => void)[] = [];
  for (const door of scope.querySelectorAll<HTMLElement>('.hero-door')) {
    const press = motion.compress({ targets: door });
    const down = (): void => {
      press.play();
    };
    const up = (): void => {
      press.reverse();
    };
    door.addEventListener('pointerdown', down);
    door.addEventListener('pointerup', up);
    door.addEventListener('pointerleave', up);
    // Keyboard parity: a door reached by tab must read as an object too.
    door.addEventListener('focus', down);
    door.addEventListener('blur', up);
    disposers.push(() => {
      door.removeEventListener('pointerdown', down);
      door.removeEventListener('pointerup', up);
      door.removeEventListener('pointerleave', up);
      door.removeEventListener('focus', down);
      door.removeEventListener('blur', up);
    });
  }

  /*
    Handed back to `gsap.context`, which runs it on revert. Timelines and
    ScrollTriggers are killed by the context itself; only what GSAP did not
    create is named here — the listeners, and the SplitText instance, whose
    `autoSplit` observers outlive the tween that used it.
  */
  return () => {
    for (const dispose of disposers) dispose();
    split?.revert();
  };
}
