/**
 * The art register — the part of it a reviewer needs.
 *
 * Licence, source, who made it, what it depicts, why it was cast that way, and
 * which surface mounts it. BUILD-TIME AND REVIEW ONLY: encoding scripts and
 * `tooling/ui-sweep.mjs` import this; nothing under `packages/ui` or
 * `packages/app` does, and nothing should. The runtime half — class, alt,
 * intrinsic size, widths, bands — is `./registry.ts`, and the split exists so
 * this file's prose never reaches a bundle.
 *
 * `satisfies Record<ArtName, ArtProvenance>` stops the two halves drifting: art
 * added to the runtime register without an entry here fails typecheck.
 *
 * LICENCE. Every photograph below is [Pexels](https://www.pexels.com/license/):
 * free for commercial use, no attribution required. Photographer and source URL
 * are recorded anyway so any pick can be re-verified against the licence.
 * Illustration entries record the illustrator or the generation route and the
 * review that cleared them against the art-direction plates; a generated asset
 * with no recorded review is not a licensed asset.
 *
 * THE CASTING LAW, chosen against — docs/pack/37-onboarding-dual-pane.md §2 and
 * docs/pack/08-visual-hierarchy-spacing-spec.md §6: real kitchen tables, real
 * homework mess, diverse families; a MOMENT rather than a category; window
 * light, camera near child eye-level, no branded clothing, no screens facing
 * the camera; an adult may be present but is not the subject; never a stock
 * child smiling at a laptop. Photoreal child faces do not appear on learner
 * surfaces at all, which the `bands` field in the runtime register enforces.
 *
 * SOT: ./registry.ts · docs/design/art-direction.md ·
 *      apps/web-vite/src/components/photography.provenance.ts (the pattern this copies) ·
 *      docs/pack/37-onboarding-dual-pane.md §2 · docs/pack/08-visual-hierarchy-spacing-spec.md §6
 * SOT-KEYWORDS: art provenance licence pexels casting illustrator generated review
 *               attribution photographer alt source
 */

import type { ArtName } from './registry';

export interface ArtProvenance {
  /** Pexels for photography; the illustrator or generation route otherwise. */
  readonly origin: string;
  /** Licence the asset travels under, named so it can be re-verified. */
  readonly licence: string;
  /** Where the original came from. A URL for stock, a commission id otherwise. */
  readonly source: string;
  /** What is in the frame, described plainly. */
  readonly depicts: string;
  /** Why this frame and not another one from the same set. */
  readonly cast: string;
  /**
   * For generated art only: who reviewed it against which plates in
   * `docs/design/art-direction.md`, and when. Absent on photography.
   */
  readonly plateReview?: string;
  /** The register the runtime `alt` string is quoted from. */
  readonly altSource: string;
  /** The surface that mounts it. */
  readonly usedIn: string;
}

export const ART_PROVENANCE = {
  'hero-kitchen-table': {
    origin: 'Pexels · Annushka Ahuja',
    licence: 'Pexels licence — free for commercial use, no attribution required',
    source: 'https://www.pexels.com/photo/8055131/',
    depicts:
      'A girl writing in a workbook at a kitchen table, pencil in hand, an open textbook and spiral notebook in front of her; her father stands behind her, reading the page over her shoulder.',
    cast: 'The adult is in frame and is not the subject — the child and the page hold the centre. Nobody looks at the camera. No screen appears anywhere, which matters more here than on any other surface: this is where "AI tutor" would otherwise read as a camera-solver.',
    altSource: 'docs/38-front-door-and-flow.md §5 FD-01 (A11y)',
    usedIn: 'apps/web-vite/src/components/chapters/hero.tsx — chapter 01',
  },
  'parents-homework': {
    origin: 'Pexels · Katerina Holmes',
    licence: 'Pexels licence — free for commercial use, no attribution required',
    source: 'https://www.pexels.com/photo/5905842/',
    depicts:
      'A boy leaning on one arm at a living-room table, pencil held over a notebook, two textbooks open and overlapping in front of him.',
    cast: 'The chapter argues that Moyo reports what happened rather than flattering it, so the photograph shows work actually happening. He is part-way through a page and slightly fed up — a moment, not a category. Chosen over every "family doing homework together" frame in the same shoot because nobody in it is performing.',
    altSource: 'docs/site/copy-deck.md §11 rules 1–6',
    usedIn: 'apps/web-vite/src/components/chapters/parents.tsx — chapter 06',
  },
  'schools-operations': {
    origin: 'Pexels contributor',
    licence: 'Pexels licence — free for commercial use, no attribution required',
    source: 'https://www.pexels.com/photo/7654178/',
    depicts: 'Four staff members working around laptops and files in a shared office.',
    cast: 'The frame shows operational work itself rather than another generic classroom. Busy but legible: people, tools and paper all share one working surface.',
    altSource: 'docs/site/copy-deck.md §11 rules 1–6',
    usedIn: 'apps/web-vite/src/components/chapters/schools.tsx — chapter 07, operations bento tile',
  },
  'schools-instruction': {
    origin: 'Pexels contributor',
    licence: 'Pexels licence — free for commercial use, no attribution required',
    source: 'https://www.pexels.com/photo/37476309/',
    depicts:
      'A teacher speaking beside a whiteboard while students in uniform work at individual classroom desks.',
    cast: 'The photograph holds instruction and independent work in the same frame. The teacher is present without performing for the camera, and a writing student keeps the lesson — not the room — as the subject.',
    altSource: 'docs/site/copy-deck.md §11 rules 1–6',
    usedIn: 'apps/web-vite/src/components/chapters/schools.tsx — chapter 07, instruction bento tile',
  },
  'schools-educator': {
    origin: 'Pexels · Pavel Danilyuk',
    licence: 'Pexels licence — free for commercial use, no attribution required',
    source: 'https://www.pexels.com/photo/8423069/',
    depicts:
      'A teacher holding an open notebook and pen in front of drawings pinned to a classroom wall.',
    cast: 'A direct educator portrait gives the people running sessions equal visual weight to the operations around them. The notebook keeps the role grounded in preparation and observation rather than a generic corporate headshot.',
    altSource: 'docs/site/copy-deck.md §11 rules 1–6',
    usedIn: 'apps/web-vite/src/components/chapters/schools.tsx — chapter 07, educator bento tile',
  },
  'schools-classroom': {
    origin: 'Pexels · Max Fischer',
    licence: 'Pexels licence — free for commercial use, no attribution required',
    source: 'https://www.pexels.com/photo/5212703/',
    depicts: 'A teacher standing at the front of a classroom while students sit at desks facing her.',
    cast: 'The wide classroom frame closes the bento at the scale of a whole room.',
    altSource: 'docs/site/copy-deck.md §11 rules 1–6',
    usedIn: 'apps/web-vite/src/components/chapters/schools.tsx — chapter 07, classroom bento tile',
  },
} as const satisfies Record<ArtName, ArtProvenance>;
