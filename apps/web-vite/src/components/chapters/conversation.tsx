/**
 * Chapter 03 · THE CONVERSATION — the refusal, shown as artifacts.
 *
 * The one message (research §4.3): *Moyo never just gives the answer — it
 * teaches the next step.* The named failure is that a refusal shown ALONE
 * reads as withholding ("so it's less useful than ChatGPT"), so the exchange
 * here carries the refusal and the teaching move in the same reply. Any
 * shortened variant of `site.conversation.demo.natalie` that drops her second
 * and third sentences is a regression, and the deck says so.
 *
 * NOT CHAT BUBBLES. docs/site/mobbin/conversation.md records that the index
 * returned no handwritten-annotation precedent at all — paper marks are simply
 * not indexed — so the paper half of this chapter is designed from the Tactile
 * Learning design language rather than referenced. What IS referenced is the
 * artifact grammar: the learner's own work stays on the page, the wrong path
 * stays visible under a strike rather than being deleted, and the guidance is a
 * second card physically attached to the work.
 *
 * THE STRIKE IS NEUTRAL. The mobbin pass explicitly refused the "villainous
 * before-state" pattern: in a tutoring context the previous attempt belongs to
 * the learner, so it is struck in graphite, never in the heart red, and it is
 * never dimmed. The end state of `crossOut` is the crossed-out mark VISIBLE —
 * the information is the correction; the movement was only the delivery.
 *
 * ACCENT BUDGET. No `moyoSun` and no `moyoHeart` in this chapter: chapter 01
 * spends the heart on the learner door and chapter 02 spends the highlighter on
 * the mastery band. The step that locks into place is `moyoLeaf`, which
 * docs/site/tokens.md reserves for growth.
 *
 * F-04 is shipped as written: `site.conversation.body` publishes the ≥50
 * extraction attempts per grade band. The deck records that this becomes a
 * public commitment; `site.conversation.body.alt` is the numeral-free fallback
 * if an owner decides otherwise.
 *
 * Mobbin: https://mobbin.com/sites/sections/1b0448c5-83f8-4044-a403-e54f30ce316c
 * (Grammarly — a second card overlapping the work's lower-right corner, so the
 * guidance is physically attached to the work rather than living in a separate
 * conversation column) · https://mobbin.com/sites/sections/e8c582a5-165d-4b90-811a-76dd59488207
 * (Grammarly — the original stays visible with a strike on the changed part, so
 * the correction is a legible diff and the learner's own words are never
 * deleted from view) · https://mobbin.com/sites/sections/88a31de0-8431-4a5e-a8df-8761600e6676
 * (OpenAI — the same input printed verbatim under the result, which is what
 * makes a comparison honest rather than promotional) ·
 * https://mobbin.com/sites/sections/9138eef2-4217-4b65-bdac-b9f7909c6d40
 * (Ploy — was/now on one row sharing a horizontal rule, read without leaving
 * the line) · https://mobbin.com/sites/sections/eef9343d-0d21-41e4-9524-54462b7612db
 * (Wild — captions annotate one continuous object instead of each getting its
 * own card). Structure only.
 *
 * SOT: docs/site/copy-deck.md §4 (+ §12 F-04, F-09) · docs/site/research.md §4.3
 *      docs/site/mobbin/conversation.md · docs/site/tokens.md
 *      docs/site/motion-matrix.md
 * SOT-KEYWORDS: site chapter conversation refusal artifacts pencil underline
 *               cross-out lock-in claims arrows shantell draw web-vite
 */
import { Container, Heading, Text } from '@acme/ui/typography';
import { List, ListItem, Paragraph, Section, View } from '@acme/ui/primitives';
import { useMotionScene } from '@/motion';
import type { MotionScene } from '@/motion';

const SCOPE = '.conversation-chapter';

const SLAB =
  'border-moyo-rule rounded-moyo-card border-moyo-outline bg-moyo-paper-raised';

/**
 * The three supporting claims. Each carries a hand-drawn arrow annotation,
 * which is content rather than decoration — deck §11 rule 5 — so each arrow's
 * words get a real accessible name.
 */
const CLAIMS = [
  {
    title: 'Natalie remembers',
    body: 'Every session updates what Moyo knows about your child’s skills, so tomorrow starts where today stopped.',
    arrow: 'not from scratch',
  },
  {
    title: 'Guardrailed for kids',
    body: 'Natalie won’t keep secrets, won’t steer your child away from talking to you, and won’t play doctor or therapist. If something serious comes up, tutoring stops.',
    arrow: 'and you’re told',
  },
  {
    title: 'Every session comes back to you',
    body: 'After each session you get a short written report: what your child worked on, what they answered, and where the skill moved.',
    arrow: 'in plain words',
  },
] as const;

export function Conversation() {
  useMotionScene(SCOPE, buildConversationScene);

  return (
    <Section
      id="conversation"
      aria-labelledby="conversation-headline"
      className="conversation-chapter bg-moyo-paper py-section"
    >
      <Container width="wide" className="gap-section">
        <View className="gap-stack">
          <Text variant="label" className="text-site-label text-moyo-secondary">
            The conversation
          </Text>

          {/*
            The binding law, stated verbatim. It is the section's whole claim,
            so the pencil rule is drawn under it rather than under a decorative
            fragment — the underline is where a teacher would put it.
          */}
          <Heading
            id="conversation-headline"
            level={2}
            size="display-xl"
            /* See hero.tsx for why the md: step is restated rather than assumed. */
            className="font-moyo-display text-site-chapter uppercase md:text-site-chapter"
          >
            Moyo never just gives the answer. It teaches the next step.
          </Heading>
          <PencilRule />

          <Paragraph className="max-w-content-prose text-site-lead">
            Ask outright and it still won&rsquo;t. The refusal is the product, so it&rsquo;s
            tested before every release &mdash; at least fifty attempts to extract an answer
            in each grade band, and one leak fails the release.
          </Paragraph>
        </View>

        <View className="gap-group lg:flex-row lg:items-start lg:gap-section">
          {/* ── the artifacts ──────────────────────────────────────────── */}
          <View className="gap-stack lg:w-7/12">
            <Text variant="label" className="text-site-label text-moyo-ink-muted">
              A 3rd-grade session
            </Text>

            {/* The learner's own page. Ruled, worked on, and never re-typed. */}
            <View className={`${SLAB} relative gap-group p-inset-roomy shadow-moyo-2`}>
              <GraphPaper />

              <View className="gap-element">
                <Text className="font-moyo-display text-site-title md:text-site-title">
                  47 &minus; 19
                </Text>
                {/*
                  The wrong path. It stays on the page under a graphite strike —
                  the Grammarly diff move — because deleting it would delete the
                  learner's own thinking, and colouring it red would make the
                  child's attempt the villain of the section.
                */}
                <View className="relative self-start">
                  <Text className="text-site-subtitle text-moyo-ink-muted md:text-site-subtitle">
                    = 32
                  </Text>
                  <View className="conversation-strike absolute inset-x-0 top-1/2 h-1 bg-moyo-ink-muted" />
                </View>
              </View>

              {/*
                The correct step, arriving as a piece that seats into a slot.
                `lockIn` rather than `snap`: this is the click of something
                already aligned dropping the last millimetre, which is the
                progress language the site uses for learning.
              */}
              <View className="conversation-step border-moyo-slab self-start rounded-moyo-card border-moyo-outline bg-moyo-leaf px-inset-roomy py-inset">
                <Text className="text-site-subtitle text-moyo-on-leaf md:text-site-subtitle">
                  Borrow one ten &rarr; 17 &minus; 9
                </Text>
              </View>
            </View>

            {/*
              Grammarly's attachment move: the guidance is a second card lying
              over the work's lower-right corner, not a bubble in a column
              beside it. `-translate-y-1/4` overlaps it by a quarter of its own
              height without taking the work out of the document flow.
            */}
            <View
              className={`conversation-reply ${SLAB} border-moyo-slab w-11/12 -translate-y-1/4 self-end gap-element p-inset-roomy shadow-moyo-3`}
            >
              <Text variant="label" className="text-site-label text-moyo-secondary">
                Natalie
              </Text>
              <Text className="text-site-body md:text-site-body">
                I won&rsquo;t give you that one. But I&rsquo;ll get you there. Look at 47
                minus 19. Can you take 9 away from 7?
              </Text>
            </View>
          </View>

          {/* ── the input, printed verbatim under the result ───────────── */}
          <View className="gap-stack lg:w-5/12">
            {/*
              The OpenAI move. The child's request is reproduced exactly as it
              was typed — lower case, no punctuation — because a tidied-up
              version of the prompt is what makes a demo promotional.
            */}
            <View className="border-moyo-hair gap-element rounded-moyo-card border-moyo-outline bg-moyo-paper-sunken p-inset-roomy">
              {/*
                `Learner` and `Natalie` are the only two words on this exchange
                the copy deck does not key, and neither is authored copy: both
                are glossary terms (deck §0.2 retains `Learner` for the role,
                and Natalie is never "the AI"). An unlabelled two-turn exchange
                cannot be read, and inventing marketing copy for a speaker tag
                would be the worse of the two deviations.
              */}
              <Text variant="label" className="text-site-label text-moyo-ink-muted">
                Learner
              </Text>
              <Text className="text-site-subtitle md:text-site-subtitle">
                just tell me the answer
              </Text>
            </View>

            <Text className="text-site-note text-moyo-ink-muted md:text-site-note">
              Same problem, same child. Moyo hands back the step, not the answer.
            </Text>
          </View>
        </View>

        {/* ── the three claims ─────────────────────────────────────────── */}
        <List className="gap-section lg:flex-row lg:gap-group">
          {CLAIMS.map((claim) => (
            <ListItem key={claim.title} className="gap-stack lg:w-4/12">
              <View className="flex-row items-end gap-element">
                <Text
                  aria-label={`Handwritten note: ${claim.arrow}`}
                  className="font-moyo-text text-site-note font-medium text-moyo-secondary md:text-site-note"
                >
                  {claim.arrow}
                </Text>
                <ClaimArrow />
              </View>
              {/*
                A real `h3`. Each claim is a titled section of the chapter, so
                the level is what a screen-reader user navigates by — a `Text`
                at `site-subtitle` looks identical and is not reachable at all.
                `md:` restated for the tokens.md reason.
              */}
              <Heading
                level={3}
                className="my-0 font-moyo-display text-site-subtitle font-normal md:text-site-subtitle"
              >
                {claim.title}
              </Heading>
              <Paragraph className="max-w-content-prose text-site-body text-moyo-ink-muted">
                {claim.body}
              </Paragraph>
            </ListItem>
          ))}
        </List>
      </Container>
    </Section>
  );
}

/**
 * The pencil rule under the chapter's law. A raw `<svg>` for the reason
 * /motion-lab gives: the kit has no SVG primitive on this surface, and `draw`
 * is defined by `getTotalLength()`, which only a real SVGGeometryElement has.
 *
 * The path is authored UNDASHED and the primitive writes the dash at build
 * time. A CSS-authored `stroke-dasharray` would render the rule invisible to a
 * reader with JS off — which is precisely the failure the end-state law exists
 * to prevent.
 */
function PencilRule() {
  return (
    <svg
      className="h-3 w-full max-w-content-detail"
      viewBox="0 0 480 12"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        className="conversation-underline"
        d="M2 8 C 96 2, 214 11, 330 4 C 396 1, 440 7, 478 5"
        fill="none"
        stroke="var(--color-moyo-secondary)"
        strokeWidth="3"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** The hand-drawn arrow beside each claim's annotation. Decorative; the words are not. */
function ClaimArrow() {
  return (
    <svg width="72" height="26" viewBox="0 0 72 26" aria-hidden="true">
      <path
        className="conversation-arrow"
        d="M2 4 C 24 2, 48 8, 64 21"
        fill="none"
        stroke="var(--color-moyo-secondary)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        className="conversation-arrow"
        d="M55 22 L 66 23 L 63 13"
        fill="none"
        stroke="var(--color-moyo-secondary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Ruled paper. The numbers are SVG user units — geometry, not design values. */
function GraphPaper() {
  return (
    <svg className="absolute inset-0 size-full" aria-hidden="true">
      <defs>
        <pattern id="conversation-graph" width="22" height="22" patternUnits="userSpaceOnUse">
          <path
            d="M22 0 L 0 0 0 22"
            fill="none"
            stroke="var(--color-moyo-ink-muted)"
            strokeWidth="0.5"
            opacity="0.45"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#conversation-graph)" />
    </svg>
  );
}

/**
 * The chapter's argument, told as four movements in the order a tutor would
 * make them: the rule is drawn under the claim, the wrong path is crossed out,
 * the correct step seats into place, and the reply lands attached to the work.
 * The claim arrows are drawn last, once the artifact has been read.
 *
 * Every one of these is on the `end-state` reduced-motion behaviour, so a
 * reader who asked for less movement is handed the finished page: the rule
 * drawn, the wrong path already struck through, the step already seated. None
 * of the information here is carried by the movement.
 */
function buildConversationScene({ motion }: MotionScene): void {
  motion.draw({ targets: '.conversation-underline', scroll: { once: true } });
  motion.crossOut({ targets: '.conversation-strike', scroll: { once: true } });
  motion.lockIn({ targets: '.conversation-step', scroll: { once: true } });
  motion.thunk({ targets: '.conversation-reply', scroll: { once: true } });
  motion.draw({ targets: '.conversation-arrow', stagger: 0.12, scroll: { once: true } });
}
