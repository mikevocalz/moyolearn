/**
 * The art register — the part of it a client needs.
 *
 * One entry per piece of artwork that ships on an app surface, carrying only
 * what the markup is made of: the class, the alt string, the intrinsic size,
 * the emitted widths, and which bands may render it. Provenance — licence,
 * source, photographer or illustrator, what the frame depicts, why it was
 * cast, and which surface mounts it — lives next door in
 * `./registry.provenance.ts` and is imported by build scripts and review
 * tooling alone.
 *
 * THE SPLIT IS A BUDGET DECISION. It copies
 * `apps/web-vite/src/components/photography.ts`, where it was made after
 * measuring: a paragraph of casting prose per asset is a paragraph that ships
 * to every reader, and property strings inside an object literal are not
 * something a bundler can tree-shake. The two halves cannot drift, because the
 * provenance map is `satisfies Record<ArtName, …>` — adding art here without
 * its provenance is a type error there.
 *
 * A MISSING ASSET IS A COMPILE ERROR, NOT A FALLBACK. Components take an
 * `ArtName` (or one of the narrowed aliases below), never a bare URL or a
 * string built at run time. `SubjectArt` for a subject that has no artwork
 * yet does not render an emoji or a grey box — it does not typecheck. While a
 * class is empty its narrowed name type is `never`, so every call site fails
 * until real art exists. That is the intended state before
 * `docs/design/art-direction.md` is approved.
 *
 * ALT IS CARRIED HERE, NOT AT THE CALL SITE. An image with no alt text is a
 * possible state if the caller supplies the string; carrying it beside the
 * file makes it impossible. `altSource` in the provenance file records which
 * register each string is quoted from.
 *
 * SOT: ./registry.provenance.ts · docs/design/art-direction.md ·
 *      docs/design/moyo-design-reset-v2-brief.md §9 ·
 *      docs/pack/08-visual-hierarchy-spacing-spec.md §6 (imagery policy, ink frame) ·
 *      docs/pack/37-onboarding-dual-pane.md §2 (casting law)
 * SOT-KEYWORDS: art registry asset scene subject manipulative figure photography
 *               licence alt band cut-paper natalie
 */

/** Which register a piece of art belongs to. Drives which component may mount it. */
export type ArtClass = 'photo' | 'scene' | 'object' | 'figure';

/**
 * Grade bands, matching the composition registers in
 * `docs/design/moyo-design-reset-v2-brief.md` §3 rule 6. `adult` covers
 * guardian, teacher, tutor and school surfaces, which share one register.
 */
export type Band = 'k2' | 'g35' | 'g68' | 'g912' | 'adult';

interface ArtCommon {
  /**
   * Source-image pixels. The component derives the `width`/`height`
   * attributes from this rather than taking them as props — a hand-typed pair
   * is a layout-shift bug waiting for the first re-crop.
   */
  readonly intrinsic: { readonly width: number; readonly height: number };
  /**
   * Emitted widths, ascending. A non-empty tuple so "art with no renditions"
   * is not a state the register can be put into.
   */
  readonly widths: readonly [number, ...number[]];
  readonly alt: string;
  /**
   * Bands allowed to render this asset. A K–2 scene mounted on a 9–12 surface
   * is a review failure, and this is where that is caught.
   */
  readonly bands: readonly [Band, ...Band[]];
}

/**
 * A photograph. Adult and onboarding surfaces only — the casting law in
 * `docs/pack/37-onboarding-dual-pane.md` §2 bars photoreal child faces from
 * learner surfaces, so `bands` on a photo entry may not include a learner band.
 */
export interface PhotoArtEntry extends ArtCommon {
  readonly class: 'photo';
  /**
   * Adult only, and not merely adult-first. The casting law bars photoreal
   * child faces from learner surfaces, and a photograph cleared for a parent
   * screen has not been cleared for a child's. Widening this tuple is the way
   * that rule would get broken, so it does not widen.
   */
  readonly bands: readonly ['adult'];
}

/**
 * A cut-paper world for the Scene archetype. `slots` names the layers the
 * asset actually ships, so `Scene` can refuse to promise a figure layer that
 * is not in the file.
 */
export interface SceneArtEntry extends ArtCommon {
  readonly class: 'scene';
  readonly slots: readonly ['background', ...('objects' | 'figure')[]];
}

/**
 * A subject object — the thing being learned, rendered as art. Keyed by the
 * pair `SubjectArt` resolves against so a skill cannot silently borrow another
 * skill's picture.
 */
export interface ObjectArtEntry extends ArtCommon {
  readonly class: 'object';
  readonly subject: string;
  readonly skill: string;
}

/** A still of Natalie, used where the 3D runtime is off or still loading. */
export interface FigureArtEntry extends ArtCommon {
  readonly class: 'figure';
}

export type ArtEntry =
  | PhotoArtEntry
  | SceneArtEntry
  | ObjectArtEntry
  | FigureArtEntry;

/**
 * The register.
 *
 * The photographs below are the six already licensed, cropped and encoded for
 * the marketing site; they are recorded here so the register starts with real
 * entries, a working licence field, and a migration a reviewer can check.
 * Their files live at `apps/web-vite/public/images/<name>-<width>.<ext>`; an
 * app that mounts one resolves the path from the key and `widths`.
 *
 * `scene`, `object` and `figure` are deliberately empty. No cut-paper asset,
 * subject object or Natalie still exists yet, and inventing keys for files
 * that are not on disk would defeat the point of the register.
 * `docs/design/art-direction.md` gates the first entry in each.
 */
export const ART = {
  'hero-kitchen-table': {
    class: 'photo',
    intrinsic: { width: 1650, height: 2200 },
    widths: [420, 840],
    bands: ['adult'],
    alt: 'A child working through a math problem at a kitchen table while a parent looks on',
  },
  'parents-homework': {
    class: 'photo',
    intrinsic: { width: 2400, height: 1600 },
    widths: [720, 1440],
    bands: ['adult'],
    alt: 'A boy part-way through a page of homework, pencil in hand, two textbooks open in front of him',
  },
  'schools-operations': {
    class: 'photo',
    intrinsic: { width: 2400, height: 1600 },
    widths: [720, 1440],
    bands: ['adult'],
    alt: 'Four staff members working around laptops and files in a shared office',
  },
  'schools-instruction': {
    class: 'photo',
    intrinsic: { width: 2400, height: 3200 },
    widths: [480, 960],
    bands: ['adult'],
    alt: 'A teacher addressing students in a classroom while a student writes in a notebook',
  },
  'schools-educator': {
    class: 'photo',
    intrinsic: { width: 2400, height: 3200 },
    widths: [480, 960],
    bands: ['adult'],
    alt: 'A teacher holding a notebook in front of a classroom wall',
  },
  'schools-classroom': {
    class: 'photo',
    intrinsic: { width: 2400, height: 1600 },
    widths: [720, 1440],
    bands: ['adult'],
    alt: 'A teacher standing at the front of a classroom with students at desks',
  },
} as const satisfies Record<string, ArtEntry>;

export type ArtName = keyof typeof ART;

/**
 * Names narrowed to one class. A component takes the alias for the class it
 * can render, so mounting a photograph where a scene belongs fails at compile
 * time instead of rendering the wrong thing. An empty class resolves to
 * `never`, which is why `SubjectArt` cannot be called until subject art exists.
 */
type NamesOfClass<C extends ArtClass> = {
  [K in ArtName]: (typeof ART)[K]['class'] extends C ? K : never;
}[ArtName];

export type PhotoArtName = NamesOfClass<'photo'>;
export type SceneArtName = NamesOfClass<'scene'>;
export type ObjectArtName = NamesOfClass<'object'>;
export type FigureArtName = NamesOfClass<'figure'>;

/**
 * Formats emitted per width, best first — the order a `<picture>` offers them
 * in. `jpg` is last and is not a preference: it is the `src` every browser
 * understands, including ones that take neither of the others.
 */
export const ART_FORMATS = ['avif', 'webp'] as const;
export const ART_FALLBACK_EXTENSION = 'jpg';
