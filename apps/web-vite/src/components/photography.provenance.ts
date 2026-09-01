/**
 * Where every photograph came from, why it was cast, and where it is used.
 *
 * BUILD-TIME ONLY. `scripts/build-photography.mjs` imports this to fetch the
 * originals and to write `public/images/MANIFEST.md`; nothing in `src/` does,
 * and nothing should. The runtime half of the register — alt, crop, widths — is
 * `./photography.ts`, and the split exists because this file is prose and prose
 * in a bundle is bytes every reader pays for. `satisfies Record<PhotoName, …>`
 * is what stops the two halves drifting: a photograph added to the runtime
 * register without an entry here fails typecheck.
 *
 * LICENCE. Every photograph is [Pexels](https://www.pexels.com/license/): free
 * for commercial use, no attribution required. Photographer and source URL are
 * recorded anyway so any pick can be re-verified against the licence, and
 * because a manifest that cannot be checked is decoration.
 *
 * THE CASTING LAW these were chosen against — doc 37 §2 and doc 08 §6: real
 * kitchen tables, real homework mess, diverse families; the MOMENT rather than
 * the category; window light, camera near child eye-level, no branded clothing,
 * no screens facing camera; an adult may be present but is not the subject; and
 * never, under any circumstances, the stock child smiling at a laptop.
 *
 * SOT: ./photography.ts · docs/pack/37-onboarding-dual-pane.md §2 ·
 *      docs/pack/08-visual-hierarchy-spacing-spec.md §6 ·
 *      docs/38-front-door-and-flow.md §5 FD-01 · docs/site/copy-deck.md §11
 * SOT-KEYWORDS: web-vite photography provenance pexels licence casting manifest
 *               attribution photographer crop hero parents schools
 */
import type { PhotoName } from './photography';

export interface PhotoProvenance {
  /** Pexels photo id — the numeral in both the page URL and the CDN filename. */
  readonly pexelsId: number;
  readonly photographer: string;
  readonly source: string;
  /** What is in the frame, plainly. */
  readonly depicts: string;
  /** Why this frame passed the casting law, for whoever has to replace it. */
  readonly cast: string;
  /** Which register the runtime `alt` string is quoted from. */
  readonly altSource: string;
  /** The surface that renders it. */
  readonly usedIn: string;
}

export const PHOTOGRAPHY_PROVENANCE = {
  'hero-kitchen-table': {
    pexelsId: 8055131,
    photographer: 'Annushka Ahuja',
    source: 'https://www.pexels.com/photo/8055131/',
    depicts:
      'A girl writing in a workbook at a kitchen table, pencil in hand, open textbook and spiral notebook in front of her; her father stands behind her, reading the page over her shoulder.',
    cast: 'The adult is in the frame and is not the subject — the child and the page hold the centre, which is the FD-01 brief exactly. Nobody looks at the camera and nobody is smiling at it. No screen appears anywhere, which matters more here than on any other surface: the hero is where "AI tutor" would otherwise be read as a camera-solver.',
    altSource: 'docs/38-front-door-and-flow.md §5 FD-01 (A11y)',
    usedIn: "src/components/chapters/parents.tsx — chapter 06, the article's plate",
  },
  'parents-homework': {
    pexelsId: 5905842,
    photographer: 'Katerina Holmes',
    source: 'https://www.pexels.com/photo/5905842/',
    depicts:
      'A boy leaning on one arm at a living-room table, pencil held over a notebook, two textbooks open and overlapping in front of him.',
    cast: 'The chapter argues that Moyo reports what happened rather than what flatters, so its photograph had to be the work actually happening. He is part-way through a page and slightly fed up with it — the moment, not the category. Chosen over every "family doing homework together" frame in the same shoot because nobody in it is performing.',
    altSource:
      'docs/site/copy-deck.md §11 rules 1–6. No row in the register describes this frame: `site.alt.parents.report` describes a session report on a phone, which is a product screenshot rather than photography. The string is written to the register’s rules instead — it names the work, describes what is happening, and carries no adjective about how it feels.',
    usedIn: 'src/components/chapters/hero.tsx — chapter 01, the plate in the headline’s notch',
  },
  'schools-operations': {
    pexelsId: 7654178,
    photographer: 'Thirdman',
    source: 'https://www.pexels.com/photo/7654178/',
    depicts:
      'Four staff members working with laptops, folders, calculators and paper files around a shared office table.',
    cast: 'The schools chapter promises infrastructure beneath the lesson, so the bento begins with the operational work itself rather than another generic classroom. The frame is busy but legible: people, tools and paper all share the same working surface.',
    altSource: 'docs/site/copy-deck.md §11 rules 1–6',
    usedIn: 'src/components/chapters/schools.tsx — chapter 07, operations bento tile',
  },
  'schools-instruction': {
    pexelsId: 37476309,
    photographer: 'Pexels contributor',
    source: 'https://www.pexels.com/photo/37476309/',
    depicts:
      'A teacher speaking beside a whiteboard while students in uniform work at individual classroom desks.',
    cast: 'The photograph holds instruction and independent work in the same frame. The teacher is present without performing for the camera, and the writing student keeps the lesson—not the room—as the subject.',
    altSource: 'docs/site/copy-deck.md §11 rules 1–6',
    usedIn: 'src/components/chapters/schools.tsx — chapter 07, instruction bento tile',
  },
  'schools-educator': {
    pexelsId: 8423069,
    photographer: 'Pavel Danilyuk',
    source: 'https://www.pexels.com/photo/8423069/',
    depicts:
      'A teacher holding an open notebook and pen in front of drawings pinned to a classroom wall.',
    cast: 'A direct educator portrait gives the people running sessions equal visual weight with the operations around them. The notebook keeps the role grounded in preparation and observation rather than in a generic corporate headshot.',
    altSource: 'docs/site/copy-deck.md §11 rules 1–6',
    usedIn: 'src/components/chapters/schools.tsx — chapter 07, educator bento tile',
  },
  'schools-classroom': {
    pexelsId: 5212703,
    photographer: 'Max Fischer',
    source: 'https://www.pexels.com/photo/5212703/',
    depicts:
      'A teacher standing at the front of a classroom while students sit at desks facing her.',
    cast: 'The wide classroom frame closes the bento at the scale of the whole room. Teacher and students remain distinct and readable, which makes the chapter’s promise of operations underneath learning visible without putting software on a screen.',
    altSource: 'docs/site/copy-deck.md §11 rules 1–6',
    usedIn: 'src/components/chapters/schools.tsx — chapter 07, classroom bento tile',
  },
} as const satisfies Record<PhotoName, PhotoProvenance>;
