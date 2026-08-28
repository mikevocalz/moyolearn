/**
 * Chapter 04 · A WORLD OF LEARNING — the globe chapter.
 *
 * WHAT THIS FILE OWNS, AND WHAT IT DOES NOT. The globe engine is complete
 * before this file touches it: geometry, the three performance tiers, the four
 * node cards, drag, the keyboard path and the alt text all belong to
 * `src/globe/` and reach the page through `<Globe />`. What lives here is the
 * composition around it and the one scrubbed scalar — `globeApi.setPhase` —
 * that reveals the node cards as the chapter comes into view.
 * `docs/site/globe-api.md` draws that boundary; this file stays on its side.
 *
 * ── THE CHAPTER READS TOP TO BOTTOM, AND THAT IS THE POINT ──────────────────
 * This chapter was previously a 500svh pinned stage: the display line sat as
 * back-layer type BEHIND the globe, the globe was cropped by the stage's bottom
 * edge, the four node cards were parked in the stage's corners on top of the
 * disc, and a cobalt disc grew over the whole composition on the way out. Every
 * one of those was a collision rather than depth, and together they cost the
 * reader the ability to simply read the section — `LEARNING HAS NO BORDERS`
 * arrived as "LEARNIN … RDERS", which is neither text nor texture.
 *
 * So the pin is gone and the order is a normal chapter:
 *
 *   headline (the display line, in ink, in flow, crossed by nothing)
 *   → the sub-line → the deck paragraph
 *   → the globe, whole, in its own reserved height, cards in real gutters
 *   → the availability sentence
 *
 * `backtype` is the `<h2>`. The copy deck (§5) files it as "back-layer display
 * type", which is a treatment, not a claim — and the treatment is what failed.
 * It is the line the chapter is actually about, so it is set as the chapter's
 * heading at full ink contrast, and `headline` sits under it as the sub-line.
 * Both strings ship, both are legible, neither is behind anything.
 *
 * The parallax survives as ONE small slow drift on the headline block (a
 * `travel.parallax-far` step), which is depth. A second, occluded copy of a
 * line behind the subject is not.
 *
 * NORMAL PAGE SCROLL ALWAYS WORKS. Nothing here listens for `wheel`, nothing
 * pins, nothing is `position: fixed`. Zooming the globe on wheel is a named
 * failure mode in the build spec and no code path in this chapter can produce
 * it.
 *
 * EVERYTHING IS IN THE DOM AT REST. Under reduced motion `parallax` applies its
 * rest state and returns a trigger-less timeline, so the driver never runs and
 * the globe stays at its rest `phase` of 1 — every node card shown. Nothing in
 * this chapter is conveyed by movement, and nothing is left invisible without
 * it.
 *
 * Mobbin: docs/site/mobbin/globe.md — Klarna (headline and the qualifying
 * sentence set OUTSIDE the figure, so the globe is a figure with a caption) ·
 * Braintrust (labels lifted clear of the map on leader lines — owned by the
 * globe's own node layer, and this chapter's job is to leave it the gutters it
 * needs). Visitors (the globe cropped by the stage's bottom edge, read as a
 * horizon) and Oryzo (the next section arriving as a hard-edged circle
 * expanding through this one) were cited by the pinned build and are NOT built:
 * both depend on a viewport-height crop, and the crop is what cut the globe in
 * half and clipped the right-hand node card off the screen.
 *
 * SOT: docs/site/copy-deck.md §5 · docs/site/globe-api.md
 *      docs/site/motion-matrix.md · docs/site/adr-002-globe-geometry.md
 * SOT-KEYWORDS: site chapter 04 world globe headline node cards gutters leader
 *               lines phase reveal parallax reduced-motion web-vite
 */
import { Heading, Text } from '@acme/ui/typography';
import { Paragraph, Section, View } from '@acme/ui/primitives';
import { globeApi } from '@/globe/api';
import { Globe } from '@/globe/globe';
import { useMotionScene } from '@/motion';
import type { MotionSceneBuilder } from '@/motion';
import { travel } from '@/motion/tokens';
import { WORLD_CHAPTER_ID } from './handoff';
import './chapters.css';

/** The heading's own id, so the section is named by the line it is about. */
const HEADLINE_ID = 'world-headline';

/**
 * Verbatim from `docs/site/copy-deck.md` §5. Nothing on this surface may be
 * written, paraphrased or "improved" locally — §5's own rejected-strings table
 * and §12 F-01 record why this is the highest-correctness-risk chapter on the
 * page. The four region cards are NOT here: they live in `src/globe/nodes.ts`
 * because the globe owns its own leader lines, and duplicating them would give
 * one claim two places to drift.
 *
 * `backtype` ships only alongside `availability` — alone it reads as an
 * availability claim, which the copy deck rejects outright. They are two
 * children of the same unpinned section, so nothing can separate them.
 */
const COPY = {
  /** `site.world.backtype` — set in caps by TREATMENT, never authored in caps. */
  backtype: 'Learning has no borders',
  /** `site.world.headline` */
  headline: 'Wherever curiosity begins.',
  /** `site.world.body` */
  body: 'Moyo means heart in Swahili. That’s not decoration — the thing that keeps a child going isn’t a subject and it isn’t a country.',
  /** `site.world.availability` — ships in the same section as `backtype`. */
  availability: 'Moyo is available in the United States, in English, today.',
} as const;

/**
 * Where each act begins, as chapter progress.
 *
 * These are structural fractions of a scroll range, not design values — the
 * same class of constant as `NODE_REVEAL_START` in `globe-store.ts` — so they
 * live here rather than in `siteMotion`, which holds durations, eases and
 * magnitudes.
 */
const ACT_START = {
  /** 25% — the globe turns toward Africa as the figure enters the viewport. */
  africa: 0.25,
  /** 55% — the nodes have spread across regions and the globe follows them. */
  expand: 0.55,
  /** 80% — free interaction. The timeline stops driving the rotation. */
  open: 0.8,
} as const;

type Act = 'entrance' | 'africa' | 'expand' | 'open';

const actAt = (progress: number): Act =>
  progress < ACT_START.africa
    ? 'entrance'
    : progress < ACT_START.expand
      ? 'africa'
      : progress < ACT_START.open
        ? 'expand'
        : 'open';

/**
 * The only thing this chapter tells the globe to do, and it fires on an act
 * BOUNDARY rather than every frame. `focusRegion` starts a tween toward a
 * centroid; re-issuing it sixty times a second would restart that tween from
 * wherever the last frame left it and the globe would crawl instead of travel.
 */
function enterAct(act: Act): void {
  switch (act) {
    case 'entrance':
      // The timeline owns the rotation from here; the two would otherwise fight
      // and the fight looks like a bug in this one.
      globeApi.setAutoRotate(false);
      globeApi.focusRegion(null);
      return;
    case 'africa':
      globeApi.focusRegion('africa');
      return;
    case 'expand':
      // Two of the four node anchors are in the Americas, so travelling there is
      // the nodes expanding across regions rather than a second look at one.
      globeApi.focusRegion('americas');
      return;
    case 'open':
      // The rest of the chapter belongs to the reader: drag, arrow keys, and
      // pressing a node card all still work, and they always did — the globe
      // never stopped being interactive. `null` clears the highlight WITHOUT
      // moving anything, so a rotation the reader started is never yanked back.
      globeApi.focusRegion(null);
  }
}

const buildWorldScene: MotionSceneBuilder = ({ motion, scope, reducedMotion }) => {
  const headline = scope.querySelector<HTMLElement>('.moyo-world-copy');
  if (!headline) return;

  /*
    One layer, one small travel, and it is the whole parallax this chapter has.
    `parallax-far` is the shallowest of the three depth steps, which is the
    correct one here: the deeper steps were sized for a PINNED chapter, where
    the layer differential is the entire effect because no page movement sits
    underneath it to borrow from. In an unpinned section the page is already
    moving, so anything larger reads as the copy sliding off its own paragraph.

    This timeline is also the chapter's clock. The range closes at
    `center center` rather than at the section's bottom: `phase` drives the node
    reveal, and a reveal that only finished as the section left the viewport
    would show a reader the globe with half its claims missing for the whole
    time the globe was actually on screen.
  */
  const master = motion.parallax({
    targets: headline,
    distance: travel['parallax-far'],
    scroll: { trigger: scope, start: 'top bottom', end: 'center center', scrub: true },
  });

  let act: Act | null = null;

  const drive = (): void => {
    const progress = master.progress();
    globeApi.setPhase(progress);

    const next = actAt(progress);
    if (next !== act) {
      act = next;
      enterAct(next);
    }
  };

  // `onUpdate` on a scrubbed timeline fires once per rendered frame, which is
  // exactly what `setPhase` is built for — the globe samples the store inside
  // its own frame loop, so this renders zero React and needs no throttling.
  master.eventCallback('onUpdate', drive);

  // A ScrollTrigger does not fire `onUpdate` until progress actually changes, so
  // without this the globe would sit at its rest `phase` of 1 — every node
  // already revealed — until the reader first moved. Priming it once puts the
  // chapter at the state its own scroll position describes. Under reduced
  // motion it is deliberately skipped, and the rest state (phase 1, every card
  // shown) is what the reader keeps.
  if (!reducedMotion) drive();
};

export function WorldChapter() {
  useMotionScene(`#${WORLD_CHAPTER_ID}`, buildWorldScene);

  return (
    <Section
      id={WORLD_CHAPTER_ID}
      aria-labelledby={HEADLINE_ID}
      className="moyo-world bg-moyo-paper"
    >
      <View className="moyo-world-stage">
        <View className="moyo-world-copy">
          {/*
            `md:text-site-chapter` is not a typo and not belt-and-braces — the
            same seam `tokens.md` documents. `Heading`'s size variant steps up at
            md and tailwind-merge only lets a class beat another in the SAME
            modifier group, so overriding the base step alone leaves the
            product's UI size winning from 768px up: correct on a phone,
            silently wrong on every desktop, which is where this line is
            supposed to be at its largest.
          */}
          <Heading
            id={HEADLINE_ID}
            level={2}
            className="font-moyo-display text-site-chapter uppercase text-moyo-ink md:text-site-chapter"
          >
            {COPY.backtype}
          </Heading>
          <Text className="font-moyo-display text-site-title text-moyo-ink md:text-site-title">
            {COPY.headline}
          </Text>
          <Paragraph className="max-w-content-prose text-site-lead text-moyo-ink">
            {COPY.body}
          </Paragraph>
        </View>

        {/*
          The globe's reserved height. The well is a real block sized by the
          figure inside it — the square frame plus, above the gutter breakpoint,
          the node cards in the stage's corners — so nothing crops it and there
          is no composition in which the disc runs off an edge.
        */}
        <View className="moyo-world-well">
          <View className="moyo-world-globe">
            <Globe />
          </View>
        </View>

        {/*
          The qualifying sentence, framed rather than set as small print. The
          copy deck is explicit that the display line ships only alongside it;
          giving it a slab of its own is what stops it reading as a footnote to
          a claim it is actually correcting.
        */}
        <View className="moyo-world-foot">
          <View className="moyo-world-availability rounded-moyo-square border-moyo-rule border-moyo-outline bg-moyo-paper-raised p-inset-roomy shadow-moyo-2">
            <Paragraph className="text-site-body text-moyo-ink">{COPY.availability}</Paragraph>
          </View>
        </View>
      </View>
    </Section>
  );
}
