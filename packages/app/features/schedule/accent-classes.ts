import type { ResourceAccent } from './model';

/**
 * Per-resource accent classes.
 *
 * SPELLED OUT ON PURPOSE. Tailwind scans source files as TEXT, so a class built
 * at runtime (`bg-${accent}-500`) is never emitted and the block renders
 * unstyled. Every class a resource column can use has to appear literally in a
 * scanned file, which is what this record is for.
 *
 * Shape follows the target: a thick saturated bar on the leading edge, the
 * block tinted to ~10% of that accent, and the title in the accent hue. The
 * selected state is the same accent at full saturation with inverse text, so it
 * reads as one system rather than a one-off style.
 *
 * Each entry carries a `dark:` counterpart. A single fixed shade cannot serve
 * both themes: the 700 title that reads well on a light 10% tint disappears
 * against the dark surface, so dark mode lifts the text to 200 and the tint to
 * 20% to hold contrast.
 */
export interface AccentClasses {
  /** Leading edge bar. */
  bar: string;
  /** Default block background — the ~10% tint. */
  surface: string;
  /** Title colour on the tinted background. */
  title: string;
  /** Solid selected block. */
  selectedSurface: string;
  /**
   * Title colour on the solid block.
   *
   * `text-white`, deliberately, and NOT `text-text-inverse`: the block beneath
   * it is a saturated accent that does not change between light and dark, so a
   * foreground that flips with the theme would be wrong half the time.
   *
   * The block is the 600 step rather than the 500 used by the bar and the dot.
   * At 500 white cleared 4.5 on only two of the five accents — ember 3.44, sky
   * 4.32, gold 4.46 — and the title renders at 14px semibold with a 12px time
   * line beneath it, both body text, so 4.5 is the bar and the 3.0 large-text
   * allowance does not apply. Every accent passes at 600.
   *
   * One step, applied uniformly, rather than per-accent tuning: these five are
   * peers in a legend, and an ember that had to travel two steps while the rest
   * moved one would read as a different weight of thing. A selected block that
   * sits deeper than its own bar also reads correctly as selected.
   */
  selectedTitle: string;
  /** Resource header dot. */
  dot: string;
}

export const ACCENT_CLASSES: Record<ResourceAccent, AccentClasses> = {
  ember: {
    bar: 'bg-ember-500',
    surface: 'bg-ember-500/10 dark:bg-ember-500/20',
    title: 'text-ember-700 dark:text-ember-200',
    selectedSurface: 'bg-ember-600',
    selectedTitle: 'text-white',
    dot: 'bg-ember-500',
  },
  gold: {
    bar: 'bg-gold-500',
    surface: 'bg-gold-500/10 dark:bg-gold-500/20',
    title: 'text-gold-700 dark:text-gold-200',
    selectedSurface: 'bg-gold-600',
    selectedTitle: 'text-white',
    dot: 'bg-gold-500',
  },
  forest: {
    bar: 'bg-forest-500',
    surface: 'bg-forest-500/10 dark:bg-forest-500/20',
    title: 'text-forest-700 dark:text-forest-200',
    selectedSurface: 'bg-forest-600',
    selectedTitle: 'text-white',
    dot: 'bg-forest-500',
  },
  sky: {
    bar: 'bg-sky-500',
    surface: 'bg-sky-500/10 dark:bg-sky-500/20',
    title: 'text-sky-700 dark:text-sky-200',
    selectedSurface: 'bg-sky-600',
    selectedTitle: 'text-white',
    dot: 'bg-sky-500',
  },
  rose: {
    bar: 'bg-rose-500',
    surface: 'bg-rose-500/10 dark:bg-rose-500/20',
    title: 'text-rose-700 dark:text-rose-200',
    selectedSurface: 'bg-rose-600',
    selectedTitle: 'text-white',
    dot: 'bg-rose-500',
  },
};
