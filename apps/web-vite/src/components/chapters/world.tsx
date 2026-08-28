/**
 * Chapter 04 · A WORLD OF LEARNING — the globe chapter, and the first half of
 * the single continuous move that ends inside chapter 05.
 *
 * WHAT THIS FILE OWNS, AND WHAT IT DOES NOT. The globe engine is complete
 * before this file touches it: geometry, the three performance tiers, the four
 * node cards, drag, the keyboard path and the alt text all belong to
 * `src/globe/` and reach the page through `<Globe />`. What lives here is the
 * pinned scroll choreography — the 0–20 / 20–45 / 45–65 / 65–85 / 85–100 acts,
 * driven through `globeApi` and nothing else — and the composition around it.
 * `docs/site/globe-api.md` draws that boundary; this file stays on its side.
 *
 * THE CHOREOGRAPHY IS A PROGRESSIVE ENHANCEMENT, NOT THE CHAPTER. Everything
 * the chapter says is in the DOM at rest: the back-layer type, the headline, the
 * availability sentence, and the four node cards the globe renders. Under
 * reduced motion no ScrollTrigger is created at all (motion-matrix §4), the
 * stage is not sticky, `phase` is pinned at 1 so every node is shown, and the
 * reader gets the finished, unpinned composition. Below 52rem the same fallback
 * applies for a different reason — a cropped viewport-height stage would clip
 * the node list the globe stacks under itself on a narrow container, and a fact
 * you have to scroll a clipped box to reach is a fact you cannot reach.
 *
 * NORMAL PAGE SCROLL ALWAYS WORKS. Nothing here listens for `wheel`, and the
 * stage holds with `position: sticky` rather than a ScrollTrigger `pin`, so
 * there is no pin-spacer, no fixed positioning, and nothing that can swallow a
 * scroll gesture. Zooming the globe on wheel is a named failure mode in the
 * build spec and no code path in this chapter can produce it.
 *
 * Mobbin: docs/site/mobbin/globe.md — Klarna (headline and the qualifying
 * sentence set OUTSIDE and above the figure, so the globe is a figure with a
 * caption) · Visitors (the globe cropped by the stage's bottom edge and read as
 * a horizon, which buys the vertical room the type needs) · Braintrust (labels
 * lifted clear of the map on leader lines — already owned by the globe's own
 * node layer) · Structured (the scroll-progress read drawn INSIDE the artwork,
 * the one thing that makes a pinned section tolerable) · Oryzo (the next
 * section arriving as a hard-edged circle expanding through this one).
 *
 * SOT: docs/site/copy-deck.md §5 · docs/site/globe-api.md
 *      docs/site/motion-matrix.md · docs/site/adr-002-globe-geometry.md
 * SOT-KEYWORDS: site chapter 04 world globe pinned scroll choreography phases
 *               cobalt flood handoff parallax sticky reduced-motion web-vite
 */
import { Heading, Text } from '@acme/ui/typography';
import { Paragraph, Section, View } from '@acme/ui/primitives';
import { globeApi } from '@/globe/api';
import { Globe } from '@/globe/globe';
import { useMotionScene } from '@/motion';
import type { MotionSceneBuilder } from '@/motion';
import { degrees, scale, travel } from '@/motion/tokens';
import { HANDOFF_GROUND_CLASS, WORLD_CHAPTER_ID } from './handoff';
import './chapters.css';

/**
 * Verbatim from `docs/site/copy-deck.md` §5. Nothing on this surface may be
 * written, paraphrased or "improved" locally — §5's own rejected-strings table
 * and §12 F-01 record why this is the highest-correctness-risk chapter on the
 * page. The four region cards are NOT here: they live in `src/globe/nodes.ts`
 * because the globe owns its own leader lines, and duplicating them would give
 * one claim two places to drift.
 *
 * `backtype` ships only alongside `availability` — alone it reads as an
 * availability claim, which the copy deck rejects outright. The pinned stage is
 * what guarantees they share a viewport.
 */
const COPY = {
  /** `site.world.backtype` — set in caps by TREATMENT, never authored in caps. */
  backtype: 'Learning has no borders',
  /** `site.world.headline` */
  headline: 'Wherever curiosity begins.',
  /** `site.world.body` */
  body: 'Moyo means heart in Swahili. That’s not decoration — the thing that keeps a child going isn’t a subject and it isn’t a country.',
  /** `site.world.availability` — must sit in the same viewport as `backtype`. */
  availability: 'Moyo is available in the United States, in English, today.',
} as const;

/**
 * Where each act of the build spec's choreography begins, as chapter progress.
 *
 * These are structural fractions of a scroll range, not design values — the
 * same class of constant as `NODE_REVEAL_START` in `globe-store.ts` — so they
 * live here rather than in `siteMotion`, which holds durations, eases and
 * magnitudes. The spec fixes them; this object is the only place they are
 * spelled.
 */
const ACT_START = {
  /** 20% — the globe has settled to true size and turns toward Africa. */
  africa: 0.2,
  /** 45% — the nodes expand across regions and the globe drifts laterally. */
  expand: 0.45,
  /** 65% — free interaction. The timeline stops driving the rotation. */
  open: 0.65,
  /** 85% — the camera pushes in and cobalt floods the screen. */
  flood: 0.85,
} as const;

type Act = 'entrance' | 'africa' | 'expand' | 'open' | 'flood';

/**
 * How far past its own width the hand-off disc has to grow to leave no cream in
 * a corner. Pure geometry: the disc is inscribed in the stage's inline size, so
 * covering a stage of W×H from its centre needs `√(1 + (H/W)²)`. The flood only
 * renders above 52rem, where the stage is never more than about square, and 2.5
 * clears that with room for a very tall window.
 */
const FLOOD_COVER = 2.5;

/** The custom properties the driver owns, and the cleanup removes. */
const CHOREOGRAPHY_VARS = [
  '--moyo-world-crop',
  '--moyo-world-spin',
  '--moyo-world-drift',
  '--moyo-world-flood',
  '--moyo-world-progress',
] as const;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Progress through one act, 0–1, clamped outside it. */
const span = (progress: number, from: number, to: number): number =>
  clamp01((progress - from) / (to - from));

/** The rem magnitude of a `siteMotion.travel` token, for arithmetic. */
const remOf = (token: string): number => Number.parseFloat(token);

const actAt = (progress: number): Act =>
  progress < ACT_START.africa
    ? 'entrance'
    : progress < ACT_START.expand
      ? 'africa'
      : progress < ACT_START.open
        ? 'expand'
        : progress < ACT_START.flood
          ? 'open'
          : 'flood';

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
    case 'flood':
      // 65–100% belongs to the reader: drag, arrow keys, and pressing a node
      // card all still work, and they always did — the globe never stopped
      // being interactive. `null` clears the highlight WITHOUT moving anything,
      // so a rotation the reader started is never yanked back.
      globeApi.focusRegion(null);
  }
}

const buildWorldScene: MotionSceneBuilder = ({ motion, scope, reducedMotion }) => {
  const stage = scope.querySelector<HTMLElement>('.moyo-world-stage');
  const backType = scope.querySelector<HTMLElement>('.moyo-world-backtype');
  const fragments = scope.querySelector<HTMLElement>('.moyo-world-fragments');
  const front = scope.querySelector<HTMLElement>('.moyo-world-front');
  if (!stage || !backType || !fragments || !front) return;

  /*
    Three depth layers, one scroll range, three speeds. The back type travels
    least, the foreground travels most, and the globe — which travels not at all
    — is the still point the other two are measured against. Elements are passed
    rather than selector strings so the wiring does not depend on how
    `gsap.context` scopes a ScrollTrigger's own config.

    Direction is the depth cue: a layer that LAGS the scroll (positive, drifting
    down the stage) reads as far away, and one that leads it (negative) reads as
    near. So the back type takes the largest positive travel, the foreground the
    smallest negative one, and the fragments sit between them going the other
    way from the type.

    The magnitudes are not symmetric because the stage is not: the back type is
    centred in a 600px box and can afford `parallax-near`, while the front panel
    is parked against the top edge with the globe's node cards immediately below
    it — travel it cannot pay for in either direction without either leaving
    through the crop or landing on a card. A depth cue achieved by pushing the
    copy into something else has stopped being a depth cue.

    The FIRST call is the master: its ScrollTrigger is the chapter's clock and
    every other layer rides the same range. Under reduced motion `parallax`
    applies its rest state and returns an empty, trigger-less timeline, so the
    clock never starts and the `onUpdate` below never fires.
  */
  const range = { trigger: scope, start: 'top top', end: 'bottom bottom', scrub: true } as const;

  const master = motion.parallax({
    targets: backType,
    distance: travel['parallax-near'],
    scroll: range,
  });
  motion.parallax({
    targets: fragments,
    distance: `-${travel['parallax-mid']}`,
    scroll: range,
  });
  motion.parallax({
    targets: front,
    distance: `-${travel['parallax-far']}`,
    scroll: range,
  });

  const drift = remOf(travel['parallax-far']);
  let act: Act | null = null;

  const drive = (): void => {
    const progress = master.progress();
    globeApi.setPhase(progress);

    // 1 at the top of the chapter, 0 once the entrance has landed. One scalar
    // drives both halves of the entrance so the scale and the tilt cannot
    // finish at different moments.
    const entering = 1 - span(progress, 0, ACT_START.africa);

    stage.style.setProperty('--moyo-world-crop', (1 + (scale.crop - 1) * entering).toFixed(4));
    stage.style.setProperty('--moyo-world-spin', `${(-degrees('snap') * entering).toFixed(3)}deg`);
    // A hump, not a ramp: the globe leaves centre and comes back, so the reader
    // arrives at free interaction with the whole figure square in the stage
    // rather than half of it pushed against an edge.
    stage.style.setProperty(
      '--moyo-world-drift',
      `${(drift * Math.sin(Math.PI * span(progress, ACT_START.expand, ACT_START.open))).toFixed(3)}rem`,
    );
    stage.style.setProperty(
      '--moyo-world-flood',
      (FLOOD_COVER * span(progress, ACT_START.flood, 1)).toFixed(4),
    );
    stage.style.setProperty('--moyo-world-progress', progress.toFixed(4));

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
  // chapter at the state its own scroll position describes.
  if (!reducedMotion) drive();

  return () => {
    // These were written with `setProperty`, not by GSAP, so `ctx.revert()` does
    // not know about them. Without this, flipping the OS reduced-motion setting
    // mid-visit would rebuild the scene on top of the last frame's values and
    // leave the composition frozen mid-flood.
    for (const name of CHOREOGRAPHY_VARS) stage.style.removeProperty(name);
  };
};

export function WorldChapter() {
  useMotionScene(`#${WORLD_CHAPTER_ID}`, buildWorldScene);

  return (
    <Section id={WORLD_CHAPTER_ID} className="moyo-world bg-moyo-paper">
      <View className="moyo-world-stage">
        {/*
          The back layer. Brand type, not the section heading — the `<h2>` below
          is the heading, and this is the display treatment behind it. Depth here
          is occlusion: the globe passes in FRONT of it, which is why the type
          stays at full contrast instead of being faded toward the ground it has
          to remain legible against.
        */}
        <View className="moyo-world-backtype">
          {/*
            `md:text-site-chapter` is not a typo and not belt-and-braces — the
            same seam `tokens.md` documents for `Heading`. `Text`'s default
            `body` variant is `text-body md:text-body-lg`, and tailwind-merge
            only lets a class beat another in the SAME modifier group, so
            overriding the base step alone leaves the product's UI body size
            winning from 768px up: correct on a phone, silently wrong on every
            desktop, which is where this type is supposed to be at its largest.
          */}
          <Text className="text-center font-moyo-display text-site-chapter uppercase text-moyo-ink-muted md:text-site-chapter">
            {COPY.backtype}
          </Text>
        </View>

        {/*
          The mid layer: drawn fragments between the type and the globe, so the
          stage reads as three depths rather than a picture on a wall. They carry
          no claim — every claim in this chapter is card text — so they are
          removed from the accessibility tree outright.
        */}
        <View className="moyo-world-fragments" aria-hidden>
          <View className="moyo-world-fragment moyo-world-fragment--a border-moyo-rule border-moyo-outline bg-moyo-paper-raised shadow-moyo-1" />
          <View className="moyo-world-fragment moyo-world-fragment--b border-moyo-hair border-moyo-outline bg-moyo-paper-sunken" />
          <View className="moyo-world-fragment moyo-world-fragment--c border-moyo-rule border-moyo-outline bg-moyo-paper-raised shadow-moyo-1" />
          <View className="moyo-world-fragment moyo-world-fragment--d border-moyo-hair border-moyo-outline bg-moyo-paper-sunken" />
        </View>

        <View className="moyo-world-front">
          <View className="moyo-world-front-copy">
            <Heading
              level={2}
              className="font-moyo-display text-site-title text-moyo-ink md:text-site-title"
            >
              {COPY.headline}
            </Heading>
            <Paragraph className="text-site-lead text-moyo-ink">{COPY.body}</Paragraph>
          </View>

          {/*
            The qualifying sentence, framed rather than set as small print. The
            copy deck is explicit that the back-layer type ships only alongside
            it; giving it a slab of its own is what stops it reading as a
            footnote to a claim it is actually correcting.
          */}
          <View className="moyo-world-availability rounded-moyo-square border-moyo-rule border-moyo-outline bg-moyo-paper-raised p-inset-roomy shadow-moyo-2">
            <Paragraph className="text-site-body text-moyo-ink">{COPY.availability}</Paragraph>
          </View>
        </View>

        <View className="moyo-world-well">
          <View className="moyo-world-globe">
            <Globe />
          </View>
        </View>

        {/* Structured's in-artwork progress read. Decoration over a fact the
            reader already has: how much of this section is left. */}
        <View className="moyo-world-progress" aria-hidden />

        {/* The hand-off. Cobalt, from `handoff.ts`, so chapter 05's ground and
            this disc are the same value and cannot drift apart. */}
        <View className="moyo-world-flood" aria-hidden>
          <View className={`moyo-world-flood-disc ${HANDOFF_GROUND_CLASS}`} />
        </View>
      </View>
    </Section>
  );
}
