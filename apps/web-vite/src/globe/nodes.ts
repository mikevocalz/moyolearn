/**
 * The four learning nodes on the globe, and where on the Earth each one points.
 *
 * EVERY STRING HERE IS COPIED FROM `docs/site/copy-deck.md` §5 (chapter 04).
 * Nothing on this surface may be written, paraphrased or "improved" locally.
 * The copy deck's §12 F-01 records that the original brief's node — "Learn
 * Swahili with a conversational tutor" — is a FALSE CLAIM: Swahili is third in
 * the *interface* locale queue (doc 16 §3) and tutoring in any non-English
 * language is gated behind per-language safety evals that do not exist. The
 * four cards below are the committed replacements, and `check-copy-law.mjs`
 * scans this file on every `pnpm lint`.
 *
 * ANCHORS. Each card points at a real place its claim is actually about:
 *
 *   name      Tanzania — Swahili's heartland, which is where the word `moyo`
 *             comes from. The only anchor the copy names outright.
 *   language  Spain — the origin of the language the second card promises
 *             next. Deliberately NOT Latin America: an anchor there beside the
 *             words "Spanish next" reads as an availability claim, and doc 33
 *             §8.5 is US-market-only.
 *   bands     The contiguous United States. K–2 / 3–5 / 6–8 / 9–12 are US
 *             grade structures — the copy deck's own localization note says
 *             they do not translate — so the claim is geographically US by
 *             construction.
 *   us        Washington, DC. COPPA and FERPA are federal law.
 *
 * All four sit on the near hemisphere at the composition's rest rotation
 * (centre longitude -25°), so every leader line is drawn without the reader
 * having to touch the globe. Reaching a node is never a prerequisite for
 * reading it: the card text is always in the DOM.
 *
 * SOT: docs/site/copy-deck.md §5, §12 F-01 · tooling/check-copy-law.mjs
 * SOT-KEYWORDS: globe nodes learning cards copy deck chapter 04 world anchors
 *               swahili moyo grade bands coppa ferpa
 */
import type { GlobeRegionId } from './generated/manifest';

export type GlobeNodeId = 'name' | 'language' | 'bands' | 'us';

/**
 * Where a card is parked on the stage. Cards do NOT ride the globe: a label
 * that sits on the landmass is unreadable at half the rotations it passes
 * through, and one that moves cannot hold a stable tab order. The card stays
 * put and a leader line reaches down to the anchor — the Braintrust move from
 * `docs/site/mobbin/globe.md`.
 */
export type NodeCorner = 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';

export interface GlobeNode {
  readonly id: GlobeNodeId;
  /** `site.world.card.<id>.title` in the copy deck. */
  readonly title: string;
  /** `site.world.card.<id>.body`. */
  readonly body: string;
  /** [lon, lat] in degrees. */
  readonly anchor: readonly [number, number];
  /** The place the anchor is, for the screen-reader description of the line. */
  readonly anchorName: string;
  readonly region: GlobeRegionId;
  readonly corner: NodeCorner;
}

export const GLOBE_NODES = [
  {
    id: 'name',
    title: 'The name',
    body: 'Moyo is Swahili for heart. "Learn it by heart" is the whole product in four words.',
    anchor: [34.9, -6.4],
    anchorName: 'Tanzania',
    region: 'africa',
    corner: 'bottom-end',
  },
  {
    id: 'language',
    title: 'English today. Spanish next.',
    body: 'A language becomes a tutoring language only when Moyo’s safety checks pass in that language — not when the translation is finished.',
    anchor: [-3.7, 40.4],
    anchorName: 'Spain',
    region: 'europe',
    corner: 'top-end',
  },
  {
    id: 'bands',
    title: 'Four ways of speaking',
    body: 'K–2, 3–5, 6–8, 9–12. A first grader and a fifth grader don’t share a language, so Moyo doesn’t hand them one.',
    anchor: [-98.6, 39.8],
    anchorName: 'the United States',
    region: 'americas',
    corner: 'top-start',
  },
  {
    id: 'us',
    title: 'Built to US rules',
    body: 'COPPA, FERPA and state student-privacy law shape how a child’s data is handled here. That’s the market Moyo serves first.',
    anchor: [-77, 38.9],
    anchorName: 'Washington, DC',
    region: 'americas',
    corner: 'bottom-start',
  },
] as const satisfies readonly GlobeNode[];

/**
 * The text alternative for the WebGL canvas (and for the Tier C SVG, which is
 * `aria-hidden` for the same reason: it is a picture of claims that are already
 * in the DOM as text).
 *
 * WCAG 1.1.1 wants a non-text alternative that serves the equivalent purpose.
 * The equivalent purpose of this globe is NOT "here is a sphere" — it is the
 * set of claims the map makes by colouring one continent differently from the
 * rest and by pointing at four places. So that is what this string says, and it
 * is deliberately the one place on the page where the composition's argument is
 * written out rather than drawn.
 *
 * `site.world.availability` is included verbatim because the copy deck's
 * rejected-strings table is explicit: "Learning has no borders — *as the only
 * line in the viewport* … reads as an availability claim. It ships only
 * alongside `site.world.availability`." A screen-reader user reaching this
 * description without it would be in exactly that viewport.
 */
export const GLOBE_ALT_TEXT =
  'An illustrated globe centred on the Atlantic, drawn as a printed puzzle map. ' +
  'Africa is picked out in mustard; North and Central America are clay, South America is ' +
  'teal and Canada is deep plum — the two colours of the Moyo logo. Europe and Asia are ' +
  'green, Antarctica is cream, and the oceans are cobalt blue. ' +
  'Four places are marked, each described in full in the list that follows: ' +
  'Tanzania, Spain, the United States and Washington, DC. ' +
  'Moyo is available in the United States, in English, today.';
