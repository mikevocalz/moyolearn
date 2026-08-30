/**
 * `Photo` — the site's one way to put a photograph on the page.
 *
 * RAW `<picture>`, DELIBERATELY. `@acme/ui` ships an `Image`, but it is the
 * react-native-web seam: one `source`, one format, no `<source>` children. A
 * `<picture>` has no react-native-web mapping at all, and the AVIF/WebP/JPEG
 * negotiation this site needs is *the* reason to reach for one. So this file
 * takes the same exemption the chapters already take for `<svg>` — the element
 * has no kit primitive on this surface and no RNW equivalent — and it is the
 * only place on the site that takes it, which is what keeps it an exemption
 * rather than a habit.
 *
 * THE FOUR THINGS THAT ARE NOT NEGOTIABLE HERE, because each of them is a
 * regression nobody sees in review:
 *
 *  1. `alt` is not a prop. It comes from the register with the file, so an
 *     image without alt text is not a state this component can be put into.
 *  2. `width`/`height` are DERIVED from the register's crop, never passed.
 *     They are what keeps CLS at zero, and a hand-typed pair silently stops
 *     matching the moment anyone re-crops.
 *  3. `sizes` is required. Without it the browser assumes `100vw` and a
 *     640px-wide plate downloads the 1440px file on a phone — the srcset then
 *     costs bytes instead of saving them.
 *  4. The JPEG is the `src`, and the modern formats are `<source>`s. A browser
 *     that understands none of them still gets the picture.
 *
 * The ink frame is NOT drawn here. doc 08 §6's frame is `border-2 border-strong`
 * + card radius + hard offset shadow, but chapter 01 mounts its plate in the
 * heavier hero slab the shape ladder reserves for a display moment. Those are
 * two different frames around the same treatment, so the frame stays with the
 * chapter that knows which one it is, and this component draws only the image.
 *
 * SOT: ./photography.ts · docs/pack/08-visual-hierarchy-spacing-spec.md §6
 *      docs/site/tokens.md §5.1 (shape and elevation)
 * SOT-KEYWORDS: web-vite photo picture avif webp srcset sizes alt cls lazy
 *               grayscale color hover photography marketing
 */
import { PHOTOGRAPHY, type PhotoName } from './photography';

export interface PhotoProps {
  /** The register key. Everything else about the file follows from it. */
  name: PhotoName;
  /**
   * The CSS width the image will occupy, as a `sizes` list. Required: see the
   * header. Written in `rem`/`vw` rather than `px` because the site's whole
   * layout is `rem`, and a `px` breakpoint here would ignore a reader who has
   * changed their root font size.
   */
  sizes: string;
  /**
   * The hero plate is above the fold and is the page's largest paint; every
   * other photograph is below it. Eager also switches decoding to synchronous,
   * so the first frame is not painted without the picture in it.
   */
  priority?: boolean;
}

/**
 * `/images/a-420.avif 420w, /images/a-840.avif 840w` — one entry per emitted
 * width. The path is templated here rather than behind a `photoFile()` helper
 * because this is the only caller, and an exported one-line helper is a byte in
 * everybody's bundle in exchange for nothing.
 */
function srcSet(name: PhotoName, widths: readonly number[], extension: string): string {
  return widths.map((w) => `/images/${name}-${w}.${extension} ${w}w`).join(', ');
}

export function Photo({ name, sizes, priority = false }: PhotoProps) {
  const { alt, crop, widths } = PHOTOGRAPHY[name];

  /*
    The intrinsic size the markup promises. Every emitted file is a straight
    scale of the same crop, so the largest one's dimensions carry the ratio for
    all of them — and the ratio is the only thing the browser needs to reserve
    the box before a byte of image has arrived.
  */
  const width = Math.max(...widths);
  const height = Math.round((width * crop.height) / crop.width);

  /*
    The two modern sources are written out rather than mapped over a format
    list: a literal pair is smaller in the bundle than an array plus a `.map`
    plus the keys React would then need, and this list changes about as often as
    the image formats of the web do.
  */
  return (
    <picture className="moyo-photo block overflow-hidden">
      <source type="image/avif" srcSet={srcSet(name, widths, 'avif')} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet(name, widths, 'webp')} sizes={sizes} />
      <img
        src={`/images/${name}-${width}.jpg`}
        srcSet={srcSet(name, widths, 'jpg')}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : 'auto'}
        /*
          `block` kills the inline baseline gap an `<img>` otherwise leaves
          under itself inside the frame; `w-full h-auto` lets the reserved
          aspect ratio do the sizing, so the box never changes height between
          the empty frame and the decoded image.
        */
        className="moyo-photo-image block h-auto w-full"
      />
    </picture>
  );
}
