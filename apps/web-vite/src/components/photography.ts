/**
 * The photography register — the part of it a browser needs.
 *
 * One entry per photograph that ships on the site, carrying only what the
 * markup is made of: the alt string, the crop the aspect ratio comes from, and
 * the widths that were emitted. Provenance — Pexels id, photographer, source
 * URL, what the frame depicts, which surface renders it — lives next door in
 * `./photography.provenance.ts` and is imported by the build script alone.
 *
 * THE SPLIT IS A BUDGET DECISION, NOT TIDINESS. Both halves were one object
 * until the built bundle was measured: a paragraph of casting prose per
 * photograph is a paragraph that ships to every reader, and property strings
 * inside an object literal are not something a bundler can tree-shake. The
 * initial JS on `/` is a fixed budget, and photography is not allowed to spend
 * any of it. The two halves cannot drift, because the provenance map is
 * `satisfies Record<PhotoName, …>` — adding a photograph here without its
 * provenance is a type error there.
 *
 * WHY THE INTRINSIC SIZE IS DERIVED. `crop` is in source-image pixels and every
 * emitted file is a straight scale of it, so the aspect ratio is the crop's
 * ratio by construction. `photo.tsx` computes the `width`/`height` attributes
 * from `crop` rather than taking them as props — a hand-typed pair is a CLS bug
 * waiting for the first re-crop.
 *
 * ALT IS CARRIED HERE, NOT AT THE CALL SITE. An image with no alt text is a
 * possible state if the caller supplies the string; carrying it beside the file
 * makes it impossible. Each string is quoted from a register that owns it —
 * `altSource` in the provenance file records which.
 *
 * SOT: ./photography.provenance.ts · docs/38-front-door-and-flow.md §5 FD-01 ·
 *      docs/site/copy-deck.md §11 (alt-text register) ·
 *      docs/pack/08-visual-hierarchy-spacing-spec.md §6 (imagery policy, ink frame,
 *      editorial grayscale treatment) · docs/pack/37-onboarding-dual-pane.md §2 (casting law)
 * SOT-KEYWORDS: web-vite photography pexels register crop grayscale color hover alt ink frame
 *               avif webp marketing hero parents schools
 */

/** A crop in source-image pixels. Fed straight to sharp's `extract`. */
export interface PhotoCrop {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface PhotoEntry {
  readonly crop: PhotoCrop;
  /**
   * Emitted widths, ascending. Typed as a non-empty tuple so "a photograph with
   * no renditions" is not a state the register can be put into — the component
   * derives the `<img>`'s intrinsic size from the largest of them, and an empty
   * list would make that `-Infinity` at run time instead of an error here.
   */
  readonly widths: readonly [number, ...number[]];
  readonly alt: string;
}

export const PHOTOGRAPHY = {
  'hero-kitchen-table': {
    crop: { left: 330, top: 1050, width: 1650, height: 2200 },
    widths: [420, 840],
    alt: 'A child working through a math problem at a kitchen table while a parent looks on',
  },
  'parents-homework': {
    crop: { left: 0, top: 0, width: 2400, height: 1600 },
    widths: [720, 1440],
    alt: 'A girl writing in a notebook at a classroom desk while another student works behind her',
  },
  'schools-operations': {
    crop: { left: 0, top: 1, width: 2400, height: 1600 },
    widths: [720, 1440],
    alt: 'Four staff members working around laptops and files in a shared office',
  },
  'schools-instruction': {
    crop: { left: 0, top: 0, width: 2400, height: 3200 },
    widths: [480, 960],
    alt: 'A teacher addressing students in a classroom while a student writes in a notebook',
  },
  'schools-educator': {
    crop: { left: 0, top: 190, width: 2400, height: 3200 },
    widths: [480, 960],
    alt: 'A teacher holding a notebook in front of a classroom wall',
  },
  'schools-classroom': {
    crop: { left: 0, top: 0, width: 2400, height: 1600 },
    widths: [720, 1440],
    alt: 'A teacher standing at the front of a classroom with students at their desks',
  },
} as const satisfies Record<string, PhotoEntry>;

export type PhotoName = keyof typeof PHOTOGRAPHY;

/**
 * The formats emitted per width, best first — the order `<picture>` offers them
 * in, and the order `scripts/build-photography.mjs` encodes them in. `jpg` last
 * is not a preference: it is the `<img>` `src` that a browser understanding
 * neither of the others still gets.
 *
 * `photo.tsx` writes its two `<source>`s out literally rather than mapping this
 * array, so nothing here reaches a bundle — the list exists so the encoder and
 * the markup are demonstrably talking about the same set of files.
 */
export const PHOTO_FORMATS = ['avif', 'webp'] as const;
export const PHOTO_FALLBACK_EXTENSION = 'jpg';
