/**
 * Chapter 02 · THE DESK — the bento, as a desk rather than a feature grid.
 *
 * The one message (research §4.2): *this is what you actually get — real work,
 * real evidence, from a real week.* The failure the research note names is a
 * bento of six equally-weighted cells, which reads as a feature list and gets
 * skimmed. So the grid is deliberately uneven: ONE loud cell (the photographed
 * homework, at scale, carrying the whole objection visually), ONE silent cell
 * (the mastery numeral, with nothing on its baseline), and five quiet ones.
 *
 * Every string is `site.desk.*` from the copy deck. Two rows in that section
 * are flagged conditional variants and are NOT rendered here: the numeric
 * movement cell (F-02 — doc 34 §2.4 renders movement to a guardian as words,
 * not a weekly percentage) and the clock-timed schedule cell (F-03 — a
 * clock-timed family session is unverified). The words-and-`Today's path`
 * variants the deck marks **recommended** are what ship. Sample data no screen
 * in the product can produce is a defect, not a mockup.
 *
 * `site.desk.disclaimer` renders INSIDE this section, which F-12 requires: the
 * sample child is Maya throughout because doc 34 uses that name in its own
 * examples, and illustrative data that leaves its own disclaimer behind reads
 * as a customer result.
 *
 * ACCENT BUDGET. This chapter spends the page's highlighter: one `moyoSun`
 * band, behind the mastery numeral, carrying ink at 9.68:1. No heart is used
 * here — chapter 01 spent it on the learner door.
 *
 * TYPE NOTE. `text-site-chapter` appears twice in this section: once on the
 * chapter opener, which is what the step is for, and once on the mastery
 * numeral, which is the section's loud figure. The one-per-page law in
 * docs/site/tokens.md is about `site-hero`, which appears only in chapter 01.
 *
 * Mobbin: https://mobbin.com/sites/sections/f85060f2-e490-4793-b11f-86d41a6a2cd0
 * (Robot.com — cells deliberately unequal: one tall cell holds only a headline,
 * several hold a single figure, one is silent) · https://mobbin.com/sites/sections/bde9e82a-b11e-446f-9858-76c20256b468
 * (AI in Design Report 2026 — a chapter numeral and a one-word name form the
 * cell's entire left column, prose sits in a narrow right column, so the number
 * is a label rather than an ornament above a heading) ·
 * https://mobbin.com/sites/sections/34a2151f-c9b2-4121-b790-8e85202fe9ca
 * (Spade — four corner crop marks instead of a card border, tiny kicker pinned
 * top-left, value anchored to the bottom edge, so the figure reads as printed
 * on the page) · https://mobbin.com/sites/sections/679cf598-2beb-4257-8152-d2efddac64f7
 * (Gumroad — cell content crossing its own boundary, which is what stitches the
 * grid to the page instead of tiling it) · https://mobbin.com/sites/sections/229496fd-8db0-4230-b10b-573b5b028300
 * (Claude — labels anchored to the bottom of each cell, which is what makes
 * uneven cell heights survivable). Structure only.
 *
 * SOT: docs/site/copy-deck.md §3 (+ §12 F-02, F-03, F-12) · docs/site/research.md §4.2
 *      docs/site/mobbin/bento.md · docs/site/tokens.md · docs/site/motion-matrix.md
 * SOT-KEYWORDS: site chapter desk bento grid asymmetric numbered cells mastery
 *               numeral graph paper torn notebook snap compress escape web-vite
 */
import { Container, Heading, Text } from '@acme/ui/typography';
import { List, ListItem, Paragraph, Section, View } from '@acme/ui/primitives';
import { useMotionScene } from '@/motion';
import type { MotionScene } from '@/motion';

const SCOPE = '.desk-chapter';

/*
  One cell, one shape. `.moyo-pressable` supplies the resting offset shadow and
  the compression travel from a single token, so a cell cannot have a shadow
  that disagrees with how far it moves when it is pressed.
*/
const CELL =
  'desk-cell moyo-pressable relative border-moyo-rule rounded-moyo-square border-moyo-outline bg-moyo-paper-raised p-inset-roomy gap-stack';

/** The three status pills, verbatim from doc 34 §2.3 via the deck. */
const STATUSES = [
  'Solved on their own',
  'Solved with help',
  'Still working on it',
] as const;

export function Desk() {
  useMotionScene(SCOPE, buildDeskScene);

  return (
    <Section
      id="desk"
      aria-labelledby="desk-headline"
      className="desk-chapter bg-moyo-paper py-section"
    >
      <Container width="wide" className="gap-section">
        <View className="gap-stack">
          <Text variant="label" className="text-site-label text-moyo-secondary">
            The desk
          </Text>
          <Heading
            id="desk-headline"
            level={2}
            size="display-xl"
            /* See hero.tsx: the md: restatement is what beats `Heading`'s own step. */
            className="font-moyo-display text-site-chapter uppercase md:text-site-chapter"
          >
            A week, as your child actually lived it.
          </Heading>
          <Paragraph className="max-w-content-prose text-site-lead">
            Every cell here is something Moyo shows you for real: the problem your child
            photographed, the answer they gave, and where the skill moved.
          </Paragraph>
        </View>

        {/*
          One grid, twelve columns, uneven spans. Below `md` it collapses to a
          single column in reading order — the hierarchy the spans carry is a
          desktop composition, and a phone gets the sequence instead.
        */}
        <View className="grid grid-cols-1 gap-group md:grid-cols-12">
          {/* ── 01 · the loud cell ─────────────────────────────────────── */}
          <View className={`${CELL} md:col-span-7 md:row-span-2`}>
            <CellLabel index="01" name="The work" />
            <View className="border-moyo-hair relative rounded-moyo-square border-moyo-outline bg-moyo-paper p-inset-roomy">
              <GraphPaper />
              <View className="gap-element">
                <Text className="font-moyo-display text-site-title md:text-site-title">47 &minus; 19</Text>
                <Text className="text-site-body text-moyo-ink-muted md:text-site-body">
                  Two-digit subtraction &middot; regrouping
                </Text>
              </View>
            </View>
            {/*
              The Gumroad escape. The margin note is written across the cell's
              own right rule, so the grid reads as pages on a desk rather than
              as tiles. It stays inside the container, so nothing here can push
              the document sideways.
            */}
            <Text
              aria-label="Handwritten note: You are close. Look at this part again."
              className="absolute right-0 top-inset-roomy w-1/2 translate-x-1/3 font-moyo-hand text-site-note text-moyo-secondary md:text-site-note"
            >
              You&rsquo;re close. Look at this part again &uarr;
            </Text>
            <Text className="mt-auto text-site-note text-moyo-ink-muted md:text-site-note">
              Photographed on the kitchen table, then worked through step by step.
            </Text>
          </View>

          {/* ── 02 · the silent cell ───────────────────────────────────── */}
          {/*
            Spade's crop marks instead of a frame, and nothing on the numeral's
            baseline — bento.md refuses the Deel pattern of an icon sharing an
            eye-stop with a figure. The highlighter band sits behind the lower
            half of the numeral so the mark reads as a swipe over the page
            rather than as a filled card.

            This is the one cell WITHOUT `.moyo-pressable`, so it is also the
            one cell that does not compress under the pointer. That is the
            point of a silent cell: it is printed on the page rather than
            sitting on it, and a figure that lifts when you brush past it is
            back to being a card.
          */}
          <View className="desk-cell relative md:col-span-5 md:flex md:flex-col md:justify-end">
            <CropMarks />
            <View className="relative p-inset-roomy">
              <View className="absolute inset-x-0 bottom-inset-roomy h-1/3 bg-moyo-sun" />
              <View className="relative gap-element">
                <CellLabel index="02" name="Mastery" />
                <Text className="font-moyo-display text-site-chapter text-moyo-ink md:text-site-chapter">87%</Text>
                <Text variant="label" className="text-site-label text-moyo-ink">
                  Two-digit subtraction &middot; mastery
                </Text>
              </View>
            </View>
          </View>

          {/* ── 03 · movement, in words ────────────────────────────────── */}
          <View className={`${CELL} md:col-span-5`}>
            <CellLabel index="03" name="Movement" />
            <Text className="text-site-subtitle md:text-site-subtitle">Fractions &mdash; practicing &rarr; getting it</Text>
            <Text className="mt-auto text-site-note text-moyo-ink-muted md:text-site-note">This week</Text>
          </View>

          {/* ── 04 · today's path ──────────────────────────────────────── */}
          <View className={`${CELL} md:col-span-4`}>
            <CellLabel index="04" name="The plan" />
            <Text className="text-site-subtitle md:text-site-subtitle">Today&rsquo;s path &middot; Math</Text>
          </View>

          {/* ── 05 · how each problem went ─────────────────────────────── */}
          <View className={`${CELL} md:col-span-4`}>
            <CellLabel index="05" name="How it went" />
            <List className="gap-element">
              {STATUSES.map((status) => (
                <ListItem
                  key={status}
                  className="border-moyo-hair self-start rounded-moyo-card border-moyo-outline px-inset-tight py-element"
                >
                  <Text className="text-site-note md:text-site-note">{status}</Text>
                </ListItem>
              ))}
            </List>
          </View>

          {/* ── 06 · the facts strip, de-emphasised by law ─────────────── */}
          {/*
            doc 34 §2.8: minutes are context, never an achievement. The strip is
            set at note size in muted ink and given the quietest cell in the
            grid on purpose — promoting it would turn time-on-task into a score.
          */}
          <View className={`${CELL} md:col-span-4`}>
            <CellLabel index="06" name="The facts" />
            <Text className="mt-auto text-site-note text-moyo-ink-muted md:text-site-note">
              22 min &middot; 6 problems &middot; 4 on their own
            </Text>
          </View>

          {/* ── 07 · the report, on a torn page ────────────────────────── */}
          <View
            className={`${CELL} border-b-0 pb-section md:col-span-12 md:flex-row md:items-start md:gap-section`}
          >
            <View className="md:w-3/12">
              <CellLabel index="07" name="The report" />
            </View>
            <View className="gap-stack md:w-9/12">
              <Text className="text-site-subtitle md:text-site-subtitle">
                Maya solved 4 two-digit subtraction problems on her own &mdash; including one
                she&rsquo;d missed twice before.
              </Text>
              <Paragraph className="max-w-content-prose text-site-body text-moyo-ink-muted">
                She tried three strategies on the hardest one and stuck with it after two
                misses.
              </Paragraph>
              <View className="gap-element">
                <Text variant="label" className="text-site-label text-moyo-secondary">
                  Next: regrouping with three digits
                </Text>
                <Text className="text-site-body md:text-site-body">
                  Ask her to show you the borrowing trick with coins.
                </Text>
              </View>
            </View>
            <TornEdge />
          </View>
        </View>

        {/* F-12: the disclaimer renders inside the same section as the sample. */}
        <Text className="text-site-note text-moyo-ink-muted md:text-site-note">
          Example report. Real reports are built from your child&rsquo;s own work.
        </Text>
      </Container>
    </Section>
  );
}

/**
 * The numeral and the one-word name, as the cell's own label column. The
 * numeral is `aria-hidden`: it is a positional device for a reader looking at
 * the grid, and read aloud in front of every cell it is noise.
 */
function CellLabel({ index, name }: { index: string; name: string }) {
  return (
    <View className="flex-row items-baseline gap-element">
      <Text aria-hidden className="font-moyo-display text-site-subtitle text-moyo-ink-muted md:text-site-subtitle">
        {index}
      </Text>
      <Text variant="label" className="text-site-label text-moyo-secondary">
        {name}
      </Text>
    </View>
  );
}

/**
 * Spade's corner marks. Four short rules that imply a boundary instead of
 * drawing one — the cell reads as a figure printed on the page rather than as a
 * card sitting on it. Decorative, so the whole set is out of the a11y tree.
 */
function CropMarks() {
  return (
    <View aria-hidden className="absolute inset-0">
      <View className="border-moyo-rule absolute left-0 top-0 size-6 border-b-0 border-r-0 border-moyo-outline" />
      <View className="border-moyo-rule absolute right-0 top-0 size-6 border-b-0 border-l-0 border-moyo-outline" />
      <View className="border-moyo-rule absolute bottom-0 left-0 size-6 border-r-0 border-t-0 border-moyo-outline" />
      <View className="border-moyo-rule absolute bottom-0 right-0 size-6 border-l-0 border-t-0 border-moyo-outline" />
    </View>
  );
}

/**
 * The bottom rule of the report cell, torn rather than ruled. The cell drops
 * its own bottom border (`border-b-0`) and this replaces it, so the page reads
 * as pulled out of a notebook. A raw `<svg>` for the same reason /motion-lab
 * gives: the kit has no SVG primitive on this surface. `preserveAspectRatio`
 * is off so the tear stretches to whatever width the cell resolves to.
 */
function TornEdge() {
  return (
    <svg
      className="absolute inset-x-0 bottom-0 h-4 w-full"
      viewBox="0 0 400 16"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0 6 L 18 12 L 37 4 L 56 13 L 74 5 L 93 12 L 112 3 L 131 11 L 150 4 L 169 13 L 188 5 L 207 12 L 226 4 L 245 11 L 264 5 L 283 13 L 302 4 L 321 12 L 340 5 L 359 11 L 378 4 L 400 10"
        fill="none"
        stroke="var(--color-moyo-outline)"
        strokeWidth="3"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * Ruled paper, tiled as an SVG pattern rather than a raster texture. The
 * numbers are SVG user units — geometry, not design values.
 */
function GraphPaper() {
  return (
    <svg className="absolute inset-0 size-full" aria-hidden="true">
      <defs>
        <pattern id="desk-graph" width="22" height="22" patternUnits="userSpaceOnUse">
          <path
            d="M22 0 L 0 0 0 22"
            fill="none"
            stroke="var(--color-moyo-ink-muted)"
            strokeWidth="0.5"
            opacity="0.45"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#desk-graph)" />
    </svg>
  );
}

/**
 * Cells SNAP into the grid — the progress language, applied to a layout: a
 * completed piece arrives off-axis and squares up into its slot with a 2%
 * overshoot. Never a fade, never a burst.
 *
 * Hover reuses `compress`, which is the same personality a button press has,
 * because the claim the chapter makes is that these are objects on a desk. It
 * is the one primitive on `reducedMotion: 'instant'`, so a reader who asked for
 * less movement still gets the compressed state without the travel time — and
 * nothing here is conveyed by the movement alone, so there is nothing lost when
 * `snap` declines to run.
 */
function buildDeskScene({ motion, scope }: MotionScene): () => void {
  motion.snap({ targets: '.desk-cell', stagger: 0.07, scroll: { once: true } });

  const disposers: (() => void)[] = [];
  for (const cell of scope.querySelectorAll<HTMLElement>('.desk-cell')) {
    const press = motion.compress({ targets: cell });
    const enter = (): void => {
      press.play();
    };
    const leave = (): void => {
      press.reverse();
    };
    cell.addEventListener('pointerenter', enter);
    cell.addEventListener('pointerleave', leave);
    disposers.push(() => {
      cell.removeEventListener('pointerenter', enter);
      cell.removeEventListener('pointerleave', leave);
    });
  }

  return () => {
    for (const dispose of disposers) dispose();
  };
}
