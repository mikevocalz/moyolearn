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
 * selected state is a solid accent block carrying ink — the same
 * carried-foreground rule as every other fill in this design (`on-primary`,
 * `on-highlighter`, `on-role-accent` all resolve to ink) — so it reads as one
 * system rather than a one-off style.
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
   * `text-on-accent` — the semantic carried-foreground for accent fills, which
   * resolves to ink[950] in BOTH themes. The block beneath it is a saturated
   * accent that does not change between light and dark, so its foreground must
   * not either: `text-text-inverse` would flip with the theme and be wrong half
   * the time, and raw `text-white` (which this replaces) is banned by CLAUDE.md
   * and shipped under AA on three accents — white on the 500 step measured
   * ember 3.44, sky 4.32, gold 4.46 against the 4.5 body-text bar.
   *
   * The block is the 400 step rather than the 500 used by the bar and the dot:
   * ink-on-accent is the system, and 400 is the deepest step where ink clears
   * AA on all five accents (ember 7.38, sky 6.71, gold 6.08, rose 5.83, forest
   * 5.80). The title renders at 14px semibold with a 12px time line beneath it,
   * both body text, so 4.5 is the bar and the 3.0 large-text allowance does not
   * apply. One step, applied uniformly, rather than per-accent tuning: these
   * five are peers in a legend, and an accent that had to sit on a different
   * step than the rest would read as a different weight of thing.
   *
   * tooling/check-contrast.mjs parses these exact class strings and gates the
   * pairing, so a colour or step change here cannot ship unmeasured.
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
    selectedSurface: 'bg-ember-400',
    selectedTitle: 'text-on-accent',
    dot: 'bg-ember-500',
  },
  gold: {
    bar: 'bg-gold-500',
    surface: 'bg-gold-500/10 dark:bg-gold-500/20',
    title: 'text-gold-700 dark:text-gold-200',
    selectedSurface: 'bg-gold-400',
    selectedTitle: 'text-on-accent',
    dot: 'bg-gold-500',
  },
  forest: {
    bar: 'bg-forest-500',
    surface: 'bg-forest-500/10 dark:bg-forest-500/20',
    title: 'text-forest-700 dark:text-forest-200',
    selectedSurface: 'bg-forest-400',
    selectedTitle: 'text-on-accent',
    dot: 'bg-forest-500',
  },
  sky: {
    bar: 'bg-sky-500',
    surface: 'bg-sky-500/10 dark:bg-sky-500/20',
    title: 'text-sky-700 dark:text-sky-200',
    selectedSurface: 'bg-sky-400',
    selectedTitle: 'text-on-accent',
    dot: 'bg-sky-500',
  },
  rose: {
    bar: 'bg-rose-500',
    surface: 'bg-rose-500/10 dark:bg-rose-500/20',
    title: 'text-rose-700 dark:text-rose-200',
    selectedSurface: 'bg-rose-400',
    selectedTitle: 'text-on-accent',
    dot: 'bg-rose-500',
  },
};
