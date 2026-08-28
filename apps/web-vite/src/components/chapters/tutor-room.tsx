/**
 * Chapter 05 · THE TUTOR ROOM — Natalie, over the cobalt chapter 04 floods in.
 *
 * Mobbin: docs/site/mobbin/tutor-room.md — Mural (the flooded band ends partway
 * down and the artefact is dropped so it STRADDLES the boundary; that break is
 * what gives a flood depth instead of leaving it a coloured box) · Wise (the
 * band carries one enormous line of type and nothing else, then the page returns
 * to neutral for the list beneath) · Daylight (product truth docked to the
 * bottom EDGE of the evidence, not floated over its middle) · Miro/071f (the
 * surface at full width first, then the three things it means, as equal claim
 * columns). Refused, from the same pass: Uxcel's streak/leaderboard cell
 * (engagement-pressure mechanics aimed at children are a non-starter here) and
 * Canva's decorative progress bar (an indicator at zero for everyone is worse
 * than none) — which is why this chapter draws no progress mark at all.
 *
 * THE NATALIE PLATE IS A PLACEHOLDER, AND IT IS BUILT TO LOOK LIKE ONE. No
 * Natalie asset exists: `docs/site/research.md` §4.5 and the copy deck's §12
 * F-07 put 3D embodiment and human tutoring in **Phase 2**, and the copy deck's
 * one-voice guard is absolute — "the site plays real baked Natalie audio or it
 * plays nothing", with silent loops the only sanctioned fallback. So the plate
 * is a flat token composition with an empty outlined aperture where the still
 * will go. It is deliberately NOT a mocked-up product screenshot or a stand-in
 * portrait: a fake screenshot of a Phase 2 capability is the exact overpromise
 * this chapter's research note exists to prevent. It carries `aria-hidden`
 * because it makes no claim, and the claim it will eventually illustrate —
 * `site.room.embodiment.*`, in the roadmap tense the law requires — is docked to
 * its bottom edge as real text.
 *
 * The four `site.room.clip.*` strings ship with the asset, not before it: a
 * "Play with sound" control over a clip that does not exist would be a promise,
 * and "Muted until you tap" describes a tap this page cannot offer.
 *
 * F-05: the shared canvas is specced in doc 26 but absent from doc 33 §7's v1 FR
 * list, so feature 2 uses `site.room.canvas.body.safe` — the variant that is
 * true today regardless — and not the present-tense annotation copy.
 *
 * SOT: docs/site/copy-deck.md §6, §11, §12 F-05/F-07 · docs/site/research.md §4.5
 *      docs/site/mobbin/tutor-room.md · ./handoff.ts
 * SOT-KEYWORDS: site chapter 05 tutor room natalie cobalt flood ground product
 *               truths placeholder phase 2 roadmap tense voice guard web-vite
 */
import { Container, Heading, Text } from '@acme/ui/typography';
import { List, ListItem, Paragraph, Section, View } from '@acme/ui/primitives';
import { useMotionScene } from '@/motion';
import type { MotionSceneBuilder } from '@/motion';
import {
  HANDOFF_GROUND_CLASS,
  HANDOFF_ON_GROUND_CLASS,
  TUTOR_ROOM_CHAPTER_ID,
} from './handoff';
import './chapters.css';

/**
 * Verbatim from `docs/site/copy-deck.md` §6. Two rules govern every string here
 * and both are checked by `tooling/check-copy-law.mjs`:
 *
 *  - **Voice-input guard.** Every line describes Natalie SPEAKING. Nothing here
 *    may suggest the child speaks back — "talk to Natalie", "just ask out loud",
 *    "hands-free" and "voice chat" are banned phrasings, and voice input is a
 *    documented v1 non-goal.
 *  - **Roadmap tense by law.** `embodiment` and `bridge` describe Phase 2 work.
 *    Any edit of either into the present tense is a regression, not a polish.
 */
const COPY = {
  /** `site.room.eyebrow` */
  eyebrow: 'The tutor room',
  /** `site.room.headline` */
  headline: 'Meet Natalie.',
  /** `site.room.body` */
  body: 'Natalie is the tutor your child works with. One voice, always the same one — and if that voice can’t run, the session continues in text. Moyo never swaps in a stranger.',
  /** `site.room.embodiment.*` — future tense by law (F-07). */
  embodiment: {
    title: 'A tutor with a face',
    body: 'Natalie is being built as a full 3D tutor — head, body, expression — arriving first on devices that can carry her. Where a device can’t, the session steps down to voice, then to text. Nothing breaks.',
  },
  /** `site.room.bridge.*` — future tense by law (F-07). */
  bridge: {
    title: 'Real tutors, same room, same heart.',
    body: 'Human tutors are coming into the same room Natalie works in — the same page, the same reports, the same rules.',
  },
} as const;

/**
 * The three v1 truths, as the chunky claim columns the Miro row calls for.
 * Order is the research note's: lead with the voice and the room, which are v1
 * facts, and let the qualified embodiment line sit on the plate rather than
 * become the headline.
 */
const TRUTHS = [
  {
    id: 'voice',
    /** `site.room.voice.title` */
    title: 'A voice that teaches, and captions that keep up',
    /** `site.room.voice.body` */
    body: 'Natalie speaks at your child’s grade level. Captions are on by default for the youngest learners, any line can be replayed, and the transcript is always there.',
  },
  {
    id: 'canvas',
    /** `site.room.canvas.title` */
    title: 'You work on the same page',
    /** `site.room.canvas.body.safe` — the F-05 variant. See the header. */
    body: 'Moyo is built around your child’s own work: the page they photographed is the page the session happens on.',
  },
  {
    id: 'progress',
    /** `site.room.progress.title` */
    title: 'Progress locks into the path',
    /** `site.room.progress.body` */
    body: 'What happens in a session updates your child’s skills map, and tomorrow’s path is built from it.',
  },
] as const;

const CARD_CLASS =
  'moyo-tutor-room-truth gap-stack rounded-moyo-card border-moyo-rule border-moyo-outline ' +
  'bg-moyo-paper-raised p-inset-roomy shadow-moyo-2';

const buildTutorRoomScene: MotionSceneBuilder = ({ motion, scope }) => {
  const headline = scope.querySelector<HTMLElement>('.moyo-tutor-room-headline');
  const plate = scope.querySelector<HTMLElement>('.moyo-tutor-room-plate');
  const cards = Array.from(scope.querySelectorAll<HTMLElement>('.moyo-tutor-room-truth'));
  const bridge = scope.querySelector<HTMLElement>('.moyo-tutor-room-bridge');
  if (!headline || !plate || !bridge || cards.length === 0) return;

  // The one display moment in this chapter gets the one split. `splitReveal`
  // hands back the SplitText instance precisely so the caller can revert it;
  // under reduced motion it returns `null` because the heading was never split,
  // which is both the documented behaviour and the better screen-reader result.
  const { split } = motion.splitReveal({ targets: headline, unit: 'lines', scroll: {} });

  // A card is an object with mass that arrives and stops. `thunk` is the
  // vocabulary's entrance for exactly that, and it is the only personality any
  // of these elements is assigned — nothing else on this chapter animates,
  // because an element with no personality does not.
  motion.thunk({ targets: plate, scroll: {} });
  motion.thunk({ targets: cards, stagger: 0.06, scroll: {} });
  motion.thunk({ targets: bridge, scroll: {} });

  return () => split?.revert();
};

export function TutorRoomChapter() {
  useMotionScene(`#${TUTOR_ROOM_CHAPTER_ID}`, buildTutorRoomScene);

  return (
    <Section id={TUTOR_ROOM_CHAPTER_ID} className="moyo-tutor-room bg-moyo-paper">
      {/*
        The band chapter 04's flood lands on. It is the top of this section, so
        the disc that filled the viewport a moment earlier releases onto the same
        cobalt and the two chapters read as one move rather than two blocks. The
        fill comes from `handoff.ts` so the two sides cannot drift apart.
      */}
      <View className={`moyo-tutor-room-band ${HANDOFF_GROUND_CLASS}`}>
        <Container width="wide" className="gap-stack">
          <Text
            variant="label"
            className={`text-site-label ${HANDOFF_ON_GROUND_CLASS}`}
          >
            {COPY.eyebrow}
          </Text>
          {/*
            `md:text-site-chapter` restated for the same reason `tokens.md` gives
            for the hero: `Heading`'s size variant steps up at md, and
            tailwind-merge only lets a class beat another in the same modifier
            group.
          */}
          <Heading
            level={2}
            className={`moyo-tutor-room-headline font-moyo-display text-site-chapter md:text-site-chapter ${HANDOFF_ON_GROUND_CLASS}`}
          >
            {COPY.headline}
          </Heading>
          <Paragraph className={`max-w-content-prose text-site-lead ${HANDOFF_ON_GROUND_CLASS}`}>
            {COPY.body}
          </Paragraph>
        </Container>
      </View>

      <Container width="wide" className="moyo-tutor-room-body gap-section">
        {/*
          The plate, straddling the band's bottom edge. See the file header: the
          artwork is an honest placeholder, and the claim it will illustrate is
          docked to its bottom edge in the roadmap tense the law requires.
        */}
        <View className="moyo-tutor-room-plate rounded-moyo-square border-moyo-slab border-moyo-outline bg-moyo-paper-raised shadow-moyo-3">
          <View className="moyo-tutor-room-plate-art" aria-hidden>
            <View className="moyo-tutor-room-plate-block--tall border-moyo-rule border-moyo-outline bg-moyo-earth">
              <View className="moyo-tutor-room-plate-aperture border-moyo-slab border-moyo-outline" />
            </View>
            {/* The chapter's one accent moment. `moyoSun` is fill-only — never
                type, never a border, never a focus ring. */}
            <View className="border-moyo-rule border-moyo-outline bg-moyo-sun" />
            <View className="border-moyo-rule border-moyo-outline bg-moyo-leaf" />
          </View>

          <View className="moyo-tutor-room-plate-dock gap-stack p-inset-roomy">
            <Heading
              level={3}
              className="font-moyo-display text-site-subtitle text-moyo-ink md:text-site-subtitle"
            >
              {COPY.embodiment.title}
            </Heading>
            <Paragraph className="text-site-body text-moyo-ink-muted">
              {COPY.embodiment.body}
            </Paragraph>
          </View>
        </View>

        <List className="moyo-tutor-room-truths">
          {TRUTHS.map((truth) => (
            <ListItem key={truth.id} className={CARD_CLASS}>
              <Heading
                level={3}
                className="font-moyo-display text-site-subtitle text-moyo-ink md:text-site-subtitle"
              >
                {truth.title}
              </Heading>
              <Paragraph className="text-site-body text-moyo-ink">{truth.body}</Paragraph>
            </ListItem>
          ))}
        </List>

        <View className="moyo-tutor-room-bridge max-w-content-prose gap-stack">
          <Heading
            level={3}
            className="font-moyo-display text-site-title text-moyo-ink md:text-site-title"
          >
            {COPY.bridge.title}
          </Heading>
          <Paragraph className="text-site-lead text-moyo-ink-muted">{COPY.bridge.body}</Paragraph>
        </View>
      </Container>
    </Section>
  );
}
